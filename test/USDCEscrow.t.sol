// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/contracts/USDCEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10**6); // 1M USDC with 6 decimals
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract USDCEscrowTest is Test {
    USDCEscrow public escrow;
    MockUSDC public usdc;
    
    address public owner;
    address public trustedSigner;
    address public sender;
    address public recipient;
    address public attacker;
    
    uint256 public trustedSignerKey;
    bytes32 public transferId;
    uint256 public amount;
    
    // Events to test
    event TransferDeposited(bytes32 indexed transferId, address indexed sender, uint256 amount, uint256 expiryTime);
    event TransferClaimed(bytes32 indexed transferId, address indexed recipient, uint256 amount);
    event TransferRefunded(bytes32 indexed transferId, address indexed sender, uint256 amount);
    event TransferDisputed(bytes32 indexed transferId, address indexed sender);

    function setUp() public virtual {
        owner = address(this);
        trustedSignerKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        trustedSigner = vm.addr(trustedSignerKey);
        sender = makeAddr("sender");
        recipient = makeAddr("recipient");
        attacker = makeAddr("attacker");
        
        // Deploy contracts
        usdc = new MockUSDC();
        escrow = new USDCEscrow(address(usdc), trustedSigner);
        
        // Setup test data
        transferId = keccak256("test-transfer-1");
        amount = 100 * 10**6; // 100 USDC
        
        // Fund accounts
        usdc.mint(sender, 1000 * 10**6);
        usdc.mint(attacker, 1000 * 10**6);
        
        // Approve escrow to spend
        vm.prank(sender);
        usdc.approve(address(escrow), type(uint256).max);
        
        vm.prank(attacker);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ CORE FUNCTIONALITY TESTS ============

    function test_SuccessfulDeposit() public {
        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));
        
        vm.expectEmit(true, true, false, true);
        emit TransferDeposited(transferId, sender, amount, block.timestamp + 7 days);
        
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0); // 0 = use default timeout
        
        // Check balances
        assertEq(usdc.balanceOf(sender), senderBalanceBefore - amount);
        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore + amount);
        assertEq(escrow.totalEscrowed(), amount);
        
        // Check transfer details
        (address storedSender, uint256 storedAmount, uint256 expiryTime, bool claimed, bool refunded, bool disputed) 
            = escrow.getTransfer(transferId);
        
        assertEq(storedSender, sender);
        assertEq(storedAmount, amount);
        assertEq(expiryTime, block.timestamp + 7 days);
        assertFalse(claimed);
        assertFalse(refunded);
        assertFalse(disputed);
    }

    function test_SuccessfulClaimWithValidSignature() public {
        // First deposit
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Generate valid signature
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(recipient);
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        
        vm.expectEmit(true, true, false, true);
        emit TransferClaimed(transferId, recipient, amount);
        
        // Claim the transfer
        escrow.claim(transferId, recipient, deadline, signature);
        
        // Check results
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + amount);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(escrow.nonces(recipient), nonce + 1); // Nonce incremented
        
        // Check transfer is marked as claimed
        (, , , bool claimed, bool refunded, bool disputed) = escrow.getTransfer(transferId);
        assertTrue(claimed);
        assertFalse(refunded);
        assertFalse(disputed);
    }

    function test_SuccessfulRefundAfterExpiry() public {
        // Deposit with 1 second timeout for quick testing
        vm.prank(sender);
        escrow.deposit(transferId, amount, 1);
        
        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        
        // Fast forward past expiry
        vm.warp(block.timestamp + 2);
        
        vm.expectEmit(true, true, false, true);
        emit TransferRefunded(transferId, sender, amount);
        
        vm.prank(sender);
        escrow.refund(transferId);
        
        // Check refund
        assertEq(usdc.balanceOf(sender), senderBalanceBefore + amount);
        assertEq(escrow.totalEscrowed(), 0);
        
        // Check transfer is marked as refunded
        (, , , bool claimed, bool refunded, bool disputed) = escrow.getTransfer(transferId);
        assertFalse(claimed);
        assertTrue(refunded);
        assertFalse(disputed);
    }

    function test_DisputeAndImmediateRefund() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        
        // Dispute transfer (wrong recipient)
        vm.expectEmit(true, true, false, true);
        emit TransferDisputed(transferId, sender);
        
        vm.prank(sender);
        escrow.disputeTransfer(transferId);
        
        // Now can refund immediately (no need to wait for expiry)
        vm.expectEmit(true, true, false, true);
        emit TransferRefunded(transferId, sender, amount);
        
        vm.prank(sender);
        escrow.refund(transferId);
        
        // Check refund worked
        assertEq(usdc.balanceOf(sender), senderBalanceBefore + amount);
        
        // Check status
        (, , , bool claimed, bool refunded, bool disputed) = escrow.getTransfer(transferId);
        assertFalse(claimed);
        assertTrue(refunded);
        assertTrue(disputed);
    }

    // ============ SECURITY TESTS ============

    function test_RevertInvalidSignature() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Generate signature with wrong parameters
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(recipient);
        bytes32 wrongMessageHash = keccak256(abi.encodePacked(
            transferId,
            attacker, // Wrong recipient!
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", wrongMessageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectRevert(USDCEscrow.InvalidSignature.selector);
        escrow.claim(transferId, recipient, deadline, signature);
    }

    function test_RevertExpiredSignature() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Generate signature that's already expired
        uint256 deadline = block.timestamp - 1; // In the past!
        uint256 nonce = escrow.nonces(recipient);
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectRevert(USDCEscrow.SignatureExpired.selector);
        escrow.claim(transferId, recipient, deadline, signature);
    }

    function test_RevertReplayAttack() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // First claim (legitimate)
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(recipient);
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        escrow.claim(transferId, recipient, deadline, signature);
        
        // Try to replay the same signature (should fail)
        bytes32 newTransferId = keccak256("test-transfer-2");
        vm.prank(sender);
        escrow.deposit(newTransferId, amount, 0);
        
        vm.expectRevert(USDCEscrow.InvalidSignature.selector);
        escrow.claim(newTransferId, recipient, deadline, signature); // Same signature!
    }

    function test_RevertUnauthorizedRefund() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Attacker tries to refund (not the sender)
        vm.warp(block.timestamp + 8 days); // Past expiry
        
        vm.expectRevert(USDCEscrow.UnauthorizedSender.selector);
        vm.prank(attacker);
        escrow.refund(transferId);
    }

    function test_RevertDoubleSpend() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // First claim
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(recipient);
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        escrow.claim(transferId, recipient, deadline, signature);
        
        // Try to claim again
        vm.expectRevert(USDCEscrow.TransferAlreadyProcessed.selector);
        escrow.claim(transferId, recipient, deadline, signature);
    }

    function test_RevertClaimAfterRefund() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 1); // 1 second timeout
        
        // Fast forward and refund
        vm.warp(block.timestamp + 2);
        vm.prank(sender);
        escrow.refund(transferId);
        
        // Try to claim after refund
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(recipient);
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(trustedSignerKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectRevert(USDCEscrow.TransferAlreadyProcessed.selector);
        escrow.claim(transferId, recipient, deadline, signature);
    }

    function test_RevertEarlyRefund() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Try to refund before expiry (without dispute)
        vm.expectRevert(USDCEscrow.TransferNotExpired.selector);
        vm.prank(sender);
        escrow.refund(transferId);
    }

    // ============ ADMIN FUNCTIONS TESTS ============

    function test_EmergencyClaim() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        
        // Owner can emergency claim to any address
        vm.expectEmit(true, true, false, true);
        emit TransferClaimed(transferId, recipient, amount);
        
        escrow.emergencyClaim(transferId, recipient);
        
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + amount);
        
        // Check transfer is marked as claimed
        (, , , bool claimed, , ) = escrow.getTransfer(transferId);
        assertTrue(claimed);
    }

    function test_EmergencyRefund() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        
        // Owner can emergency refund even before expiry
        vm.expectEmit(true, true, false, true);
        emit TransferRefunded(transferId, sender, amount);
        
        escrow.emergencyRefund(transferId);
        
        assertEq(usdc.balanceOf(sender), senderBalanceBefore + amount);
        
        // Check transfer is marked as refunded
        (, , , , bool refunded, ) = escrow.getTransfer(transferId);
        assertTrue(refunded);
    }

    function test_UpdateTrustedSigner() public {
        address newSigner = makeAddr("newSigner");
        
        escrow.updateTrustedSigner(newSigner);
        
        assertEq(escrow.trustedSigner(), newSigner);
    }

    function test_PauseUnpause() public {
        // Pause
        escrow.pause();
        assertTrue(escrow.paused());
        
        // Try to deposit while paused (should fail)
        vm.expectRevert();
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Unpause
        escrow.unpause();
        assertFalse(escrow.paused());
        
        // Now deposit should work
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
    }

    // ============ HELPER FUNCTION TESTS ============

    function test_IsClaimable() public {
        // Should be false before deposit
        assertFalse(escrow.isClaimable(transferId));
        
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Should be true after deposit
        assertTrue(escrow.isClaimable(transferId));
        
        // Should be false after expiry
        vm.warp(block.timestamp + 8 days);
        assertFalse(escrow.isClaimable(transferId));
    }

    function test_IsRefundable() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        // Should be false before expiry
        assertFalse(escrow.isRefundable(transferId));
        
        // Should be true after expiry
        vm.warp(block.timestamp + 8 days);
        assertTrue(escrow.isRefundable(transferId));
        
        // Should also be true after dispute (even before expiry)
        bytes32 newTransferId = keccak256("test-transfer-2");
        vm.prank(sender);
        escrow.deposit(newTransferId, amount, 0);
        
        vm.prank(sender);
        escrow.disputeTransfer(newTransferId);
        
        assertTrue(escrow.isRefundable(newTransferId));
    }

    // ============ EDGE CASES ============

    function test_ZeroAmountReverts() public {
        vm.expectRevert(USDCEscrow.InvalidAmount.selector);
        vm.prank(sender);
        escrow.deposit(transferId, 0, 0);
    }

    function test_ExcessiveTimeoutReverts() public {
        vm.expectRevert(USDCEscrow.InvalidTimeout.selector);
        vm.prank(sender);
        escrow.deposit(transferId, amount, 31 days); // Over MAX_TIMEOUT
    }

    function test_DuplicateTransferIdReverts() public {
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0);
        
        vm.expectRevert(USDCEscrow.TransferAlreadyProcessed.selector);
        vm.prank(sender);
        escrow.deposit(transferId, amount, 0); // Same transferId
    }

    function test_NonExistentTransferReverts() public {
        bytes32 fakeTransferId = keccak256("fake-transfer");
        
        vm.expectRevert(USDCEscrow.TransferNotFound.selector);
        vm.prank(sender);
        escrow.refund(fakeTransferId);
    }
}
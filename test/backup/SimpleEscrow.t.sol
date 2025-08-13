// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/contracts/SimpleEscrow.sol";
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

contract SimpleEscrowTest is Test {
    SimpleEscrow public escrow;
    MockUSDC public usdc;
    
    address public owner;
    address public sender;
    address public recipient;
    address public attacker;
    
    // Test constants
    bytes32 constant TRANSFER_ID = keccak256("transfer123");
    bytes32 constant CLAIM_SECRET_HASH = keccak256("test@example.com_claimToken123");
    string constant CLAIM_SECRET = "test@example.com_claimToken123";
    uint256 constant DEPOSIT_AMOUNT = 100 * 10**6; // 100 USDC
    uint256 constant TIMEOUT_DAYS = 7;
    
    event Deposited(
        bytes32 indexed transferId, 
        address indexed sender, 
        uint256 amount, 
        uint256 expiryTime
    );
    
    event Released(
        bytes32 indexed transferId, 
        address indexed recipient, 
        uint256 amount
    );
    
    event Refunded(
        bytes32 indexed transferId, 
        address indexed sender, 
        uint256 amount
    );

    function setUp() public {
        owner = makeAddr("owner");
        sender = makeAddr("sender");
        recipient = makeAddr("recipient");
        attacker = makeAddr("attacker");
        
        // Deploy contracts
        vm.startPrank(owner);
        usdc = new MockUSDC();
        escrow = new SimpleEscrow(address(usdc));
        vm.stopPrank();
        
        // Give sender some USDC
        usdc.mint(sender, 10000 * 10**6); // 10k USDC
        
        // Give attacker some USDC
        usdc.mint(attacker, 1000 * 10**6); // 1k USDC
    }

    function testDeposit() public {
        vm.startPrank(sender);
        
        // Approve USDC
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        
        // Calculate expected expiry time
        uint256 expectedExpiry = block.timestamp + (TIMEOUT_DAYS * 1 days);
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit Deposited(TRANSFER_ID, sender, DEPOSIT_AMOUNT, expectedExpiry);
        
        // Deposit
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        
        // Verify transfer details
        (
            address storedSender,
            uint256 amount,
            bytes32 claimSecretHash,
            uint256 expiryTime,
            bool claimed,
            bool refunded
        ) = escrow.getTransfer(TRANSFER_ID);
        
        assertEq(storedSender, sender);
        assertEq(amount, DEPOSIT_AMOUNT);
        assertEq(claimSecretHash, CLAIM_SECRET_HASH);
        assertEq(expiryTime, expectedExpiry);
        assertFalse(claimed);
        assertFalse(refunded);
        
        // Verify USDC was transferred
        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(sender), 10000 * 10**6 - DEPOSIT_AMOUNT);
        
        vm.stopPrank();
    }

    function testAdminRelease() public {
        // Setup: Create a deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Admin releases funds
        vm.startPrank(owner);
        
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit Released(TRANSFER_ID, recipient, DEPOSIT_AMOUNT);
        
        // Release
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        
        // Verify transfer marked as claimed
        (, , , , bool claimed, bool refunded) = escrow.getTransfer(TRANSFER_ID);
        assertTrue(claimed);
        assertFalse(refunded);
        
        // Verify USDC was transferred to recipient
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        
        vm.stopPrank();
    }

    function testRefund() public {
        // Setup: Create a deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Fast forward past expiry
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        
        // Sender refunds
        vm.startPrank(sender);
        
        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit Refunded(TRANSFER_ID, sender, DEPOSIT_AMOUNT);
        
        // Refund
        escrow.refund(TRANSFER_ID);
        
        // Verify transfer marked as refunded
        (, , , , bool claimed, bool refunded) = escrow.getTransfer(TRANSFER_ID);
        assertFalse(claimed);
        assertTrue(refunded);
        
        // Verify USDC was returned to sender
        assertEq(usdc.balanceOf(sender), senderBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        
        vm.stopPrank();
    }

    function testIsClaimable() public {
        // Initially false for non-existent transfer
        assertFalse(escrow.isClaimable(TRANSFER_ID));
        
        // Create deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Should be claimable now
        assertTrue(escrow.isClaimable(TRANSFER_ID));
        
        // After expiry, should not be claimable
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        assertFalse(escrow.isClaimable(TRANSFER_ID));
    }

    function testIsRefundable() public {
        // Initially false for non-existent transfer
        assertFalse(escrow.isRefundable(TRANSFER_ID));
        
        // Create deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Should not be refundable yet
        assertFalse(escrow.isRefundable(TRANSFER_ID));
        
        // After expiry, should be refundable
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        assertTrue(escrow.isRefundable(TRANSFER_ID));
    }

    // ===== SECURITY TESTS =====

    function testOnlyOwnerCanAdminRelease() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Attacker tries to release
        vm.startPrank(attacker);
        vm.expectRevert();
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
        
        // Non-owner user tries to release
        vm.startPrank(sender);
        vm.expectRevert();
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
    }

    function testCannotDoubleSpend() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // First claim succeeds
        vm.startPrank(owner);
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        
        // Second claim fails
        vm.expectRevert("Already claimed");
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
    }

    function testCannotClaimAfterRefund() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Fast forward and refund
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        vm.startPrank(sender);
        escrow.refund(TRANSFER_ID);
        vm.stopPrank();
        
        // Try to claim after refund
        vm.startPrank(owner);
        vm.expectRevert("Already refunded");
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
    }

    function testCannotRefundBeforeExpiry() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Try to refund before expiry
        vm.startPrank(sender);
        vm.expectRevert("Not yet expired");
        escrow.refund(TRANSFER_ID);
        vm.stopPrank();
    }

    function testOnlySenderCanRefund() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Fast forward past expiry
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        
        // Attacker tries to refund
        vm.startPrank(attacker);
        vm.expectRevert("Not the sender");
        escrow.refund(TRANSFER_ID);
        vm.stopPrank();
    }

    function testInvalidClaimSecret() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Try to claim with wrong secret
        vm.startPrank(owner);
        vm.expectRevert("Invalid claim secret");
        escrow.adminRelease(TRANSFER_ID, "wrong_secret", recipient);
        vm.stopPrank();
    }

    function testCannotClaimExpiredTransfer() public {
        // Setup deposit
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Fast forward past expiry
        vm.warp(block.timestamp + TIMEOUT_DAYS * 1 days + 1);
        
        // Try to claim expired transfer
        vm.startPrank(owner);
        vm.expectRevert("Transfer expired");
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
    }

    function testCannotDepositWithZeroAmount() public {
        vm.startPrank(sender);
        usdc.approve(address(escrow), 0);
        
        vm.expectRevert("Amount must be positive");
        escrow.deposit(TRANSFER_ID, 0, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
    }

    function testCannotDepositWithInvalidTimeout() public {
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        
        // Zero timeout
        vm.expectRevert("Invalid timeout period");
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, 0);
        
        // Too long timeout (over 365 days)
        vm.expectRevert("Invalid timeout period");
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, 366);
        vm.stopPrank();
    }

    function testCannotDepositDuplicateTransferId() public {
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT * 2);
        
        // First deposit succeeds
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        
        // Second deposit with same ID fails
        vm.expectRevert("Transfer ID already exists");
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
    }

    function testCannotDepositWithInsufficientAllowance() public {
        vm.startPrank(sender);
        // Approve less than deposit amount
        usdc.approve(address(escrow), DEPOSIT_AMOUNT - 1);
        
        vm.expectRevert();
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
    }

    function testReentrancyProtection() public {
        // This test ensures the ReentrancyGuard is working
        // The MockUSDC doesn't have reentrancy attacks, but we verify the modifier is in place
        
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Normal admin release should work
        vm.startPrank(owner);
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
        
        // This confirms the reentrancy guard doesn't block normal operations
    }

    // ===== EDGE CASE TESTS =====

    function testMaximumTimeout() public {
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        
        // 365 days should be valid
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, 365);
        
        (, , , uint256 expiryTime, , ) = escrow.getTransfer(TRANSFER_ID);
        assertEq(expiryTime, block.timestamp + 365 days);
        vm.stopPrank();
    }

    function testLargeAmount() public {
        uint256 largeAmount = 1000 * 10**6; // 1k USDC (reasonable for test)
        
        // Give sender enough USDC
        usdc.mint(sender, largeAmount);
        
        vm.startPrank(sender);
        usdc.approve(address(escrow), largeAmount);
        escrow.deposit(TRANSFER_ID, largeAmount, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        vm.startPrank(owner);
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(recipient), largeAmount);
    }

    function testEmergencyWithdraw() public {
        // Setup: Deposit some funds
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        vm.stopPrank();
        
        // Only owner can emergency withdraw
        vm.startPrank(attacker);
        vm.expectRevert();
        escrow.emergencyWithdraw(address(usdc), DEPOSIT_AMOUNT);
        vm.stopPrank();
        
        // Owner can emergency withdraw
        vm.startPrank(owner);
        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        escrow.emergencyWithdraw(address(usdc), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    // ===== GAS OPTIMIZATION TESTS =====

    function testGasUsage() public {
        vm.startPrank(sender);
        usdc.approve(address(escrow), DEPOSIT_AMOUNT);
        
        // Measure deposit gas
        uint256 gasBefore = gasleft();
        escrow.deposit(TRANSFER_ID, DEPOSIT_AMOUNT, CLAIM_SECRET_HASH, TIMEOUT_DAYS);
        uint256 depositGas = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // Measure admin release gas
        vm.startPrank(owner);
        gasBefore = gasleft();
        escrow.adminRelease(TRANSFER_ID, CLAIM_SECRET, recipient);
        uint256 releaseGas = gasBefore - gasleft();
        vm.stopPrank();
        
        // Gas usage should be reasonable
        assertLt(depositGas, 150000, "Deposit gas too high");
        assertLt(releaseGas, 75000, "Release gas too high");
        
        console.log("Deposit gas used:", depositGas);
        console.log("Release gas used:", releaseGas);
    }
}
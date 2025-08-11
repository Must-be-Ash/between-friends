// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "./USDCEscrow.t.sol";

/**
 * Integration tests that simulate real-world usage scenarios
 * These test the complete flow from your application's perspective
 */
contract USDCEscrowIntegrationTest is USDCEscrowTest {
    
    // Simulate multiple users
    address public alice;
    address public bob;
    address public charlie;
    address public backend;
    uint256 public backendKey;
    
    function setUp() public override {
        super.setUp();
        
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        
        // Use a different backend signer for integration tests
        backendKey = 0xbeef;
        backend = vm.addr(backendKey);
        
        // Deploy new escrow with backend signer
        escrow = new USDCEscrow(address(usdc), backend);
        
        // Fund users
        usdc.mint(alice, 10000 * 10**6);
        usdc.mint(bob, 10000 * 10**6);
        usdc.mint(charlie, 10000 * 10**6);
        
        // Approve escrow
        vm.prank(alice);
        usdc.approve(address(escrow), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(escrow), type(uint256).max);
        
        vm.prank(charlie);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ COMPLETE USER JOURNEY TESTS ============

    function test_CompleteHappyPath_EmailTransfer() public {
        // Alice sends $100 to bob@email.com (Bob doesn't have wallet yet)
        bytes32 aliceToBobTransfer = keccak256("alice-to-bob-100");
        uint256 sendAmount = 100 * 10**6;
        
        console.log("=== Alice sends $100 to bob@email.com (escrow) ===");
        
        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        
        vm.prank(alice);
        escrow.deposit(aliceToBobTransfer, sendAmount, 0);
        
        assertEq(usdc.balanceOf(alice), aliceBalanceBefore - sendAmount);
        assertTrue(escrow.isClaimable(aliceToBobTransfer));
        
        console.log("Funds escrowed successfully");
        
        // Time passes... Bob signs up and verifies his email with CDP
        vm.warp(block.timestamp + 2 hours);
        
        console.log("=== Bob signs up and claims his $100 ===");
        
        // Backend verifies Bob owns bob@email.com and signs authorization
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = escrow.nonces(bob);
        
        bytes memory signature = _generateBackendSignature(
            aliceToBobTransfer, 
            bob, 
            deadline, 
            nonce
        );
        
        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        
        // Bob claims the funds
        escrow.claim(aliceToBobTransfer, bob, deadline, signature);
        
        assertEq(usdc.balanceOf(bob), bobBalanceBefore + sendAmount);
        
        // Transfer is complete
        (, , , bool claimed, bool refunded, bool disputed) = escrow.getTransfer(aliceToBobTransfer);
        assertTrue(claimed);
        assertFalse(refunded);
        assertFalse(disputed);
        
        console.log("Bob successfully claimed $100!");
    }

    function test_WrongRecipient_DisputeAndRefund() public {
        // Alice accidentally sends $50 to wrong-email@domain.com
        bytes32 wrongTransfer = keccak256("alice-wrong-email");
        uint256 sendAmount = 50 * 10**6;
        
        console.log("=== Alice accidentally sends to wrong email ===");
        
        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        
        vm.prank(alice);
        escrow.deposit(wrongTransfer, sendAmount, 0);
        
        assertEq(usdc.balanceOf(alice), aliceBalanceBefore - sendAmount);
        
        console.log("$50 sent to escrow for wrong email");
        
        // Alice realizes her mistake and disputes
        vm.prank(alice);
        escrow.disputeTransfer(wrongTransfer);
        
        console.log("Alice disputes the transfer");
        
        // Alice can immediately refund (no need to wait 7 days)
        uint256 aliceBalanceBeforeRefund = usdc.balanceOf(alice);
        
        vm.prank(alice);
        escrow.refund(wrongTransfer);
        
        assertEq(usdc.balanceOf(alice), aliceBalanceBeforeRefund + sendAmount);
        
        console.log("Alice got her $50 back immediately!");
        
        // Transfer is marked as disputed and refunded
        (, , , bool claimed, bool refunded, bool disputed) = escrow.getTransfer(wrongTransfer);
        assertFalse(claimed);
        assertTrue(refunded);
        assertTrue(disputed);
    }

    function test_UnclaimedFunds_AutoRefundAfterExpiry() public {
        // Bob sends $75 to charlie@email.com but Charlie never claims
        bytes32 bobToCharlieTransfer = keccak256("bob-to-charlie-unclaimed");
        uint256 sendAmount = 75 * 10**6;
        
        console.log("=== Bob sends $75 to Charlie (who never claims) ===");
        
        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        
        vm.prank(bob);
        escrow.deposit(bobToCharlieTransfer, sendAmount, 0);
        
        assertEq(usdc.balanceOf(bob), bobBalanceBefore - sendAmount);
        
        console.log("$75 escrowed for Charlie");
        
        // 7 days pass, Charlie never claims
        vm.warp(block.timestamp + 7 days + 1 hours);
        
        console.log("7 days passed, Charlie never claimed");
        
        assertFalse(escrow.isClaimable(bobToCharlieTransfer));
        assertTrue(escrow.isRefundable(bobToCharlieTransfer));
        
        // Bob refunds his unclaimed money
        uint256 bobBalanceBeforeRefund = usdc.balanceOf(bob);
        
        vm.prank(bob);
        escrow.refund(bobToCharlieTransfer);
        
        assertEq(usdc.balanceOf(bob), bobBalanceBeforeRefund + sendAmount);
        
        console.log("Bob got his $75 back after timeout!");
    }

    function test_MultipleTransfers_DifferentUsers() public {
        console.log("=== Testing multiple concurrent transfers ===");
        
        // Alice -> Bob: $200
        bytes32 transfer1 = keccak256("transfer-1");
        vm.prank(alice);
        escrow.deposit(transfer1, 200 * 10**6, 0);
        
        // Bob -> Charlie: $150  
        bytes32 transfer2 = keccak256("transfer-2");
        vm.prank(bob);
        escrow.deposit(transfer2, 150 * 10**6, 0);
        
        // Charlie -> Alice: $300
        bytes32 transfer3 = keccak256("transfer-3");
        vm.prank(charlie);
        escrow.deposit(transfer3, 300 * 10**6, 0);
        
        console.log("Three transfers escrowed");
        
        assertEq(escrow.totalEscrowed(), 650 * 10**6);
        
        // All should be claimable
        assertTrue(escrow.isClaimable(transfer1));
        assertTrue(escrow.isClaimable(transfer2));
        assertTrue(escrow.isClaimable(transfer3));
        
        // Bob claims Alice's transfer
        bytes memory sig1 = _generateBackendSignature(transfer1, bob, block.timestamp + 1 hours, escrow.nonces(bob));
        escrow.claim(transfer1, bob, block.timestamp + 1 hours, sig1);
        
        // Charlie claims Bob's transfer
        bytes memory sig2 = _generateBackendSignature(transfer2, charlie, block.timestamp + 1 hours, escrow.nonces(charlie));
        escrow.claim(transfer2, charlie, block.timestamp + 1 hours, sig2);
        
        // Alice claims Charlie's transfer
        bytes memory sig3 = _generateBackendSignature(transfer3, alice, block.timestamp + 1 hours, escrow.nonces(alice));
        escrow.claim(transfer3, alice, block.timestamp + 1 hours, sig3);
        
        // All transfers claimed
        assertEq(escrow.totalEscrowed(), 0);
        
        console.log("All three transfers claimed successfully!");
    }

    function test_CustomerSupport_EmergencyIntervention() public {
        // Customer support scenario: User lost access but we can verify ownership
        bytes32 supportTransfer = keccak256("support-case-123");
        uint256 supportAmount = 500 * 10**6;
        
        console.log("=== Customer Support Emergency Case ===");
        
        vm.prank(alice);
        escrow.deposit(supportTransfer, supportAmount, 0);
        
        // Bob lost access to his email but contacted support with proof of ownership
        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        
        console.log("Customer support verifies Bob's identity");
        
        // Owner (support) can emergency claim to Bob's wallet
        escrow.emergencyClaim(supportTransfer, bob);
        
        assertEq(usdc.balanceOf(bob), bobBalanceBefore + supportAmount);
        
        console.log("Support successfully helped Bob recover $500!");
    }

    // ============ STRESS TESTS ============

    function test_HighVolumeTransfers() public {
        console.log("=== High Volume Stress Test ===");
        
        uint256 numTransfers = 10; // Reduced for faster testing
        bytes32[] memory transferIds = new bytes32[](numTransfers);
        
        // Create many transfers
        for(uint256 i = 0; i < numTransfers; i++) {
            transferIds[i] = keccak256(abi.encodePacked("stress-test-", i));
            
            vm.prank(alice);
            escrow.deposit(transferIds[i], 10 * 10**6, 0); // $10 each
        }
        
        assertEq(escrow.totalEscrowed(), numTransfers * 10 * 10**6);
        
        console.log("Created multiple transfers");
        
        // Claim half, refund half
        for(uint256 i = 0; i < numTransfers; i++) {
            if(i % 2 == 0) {
                // Claim even transfers
                bytes memory sig = _generateBackendSignature(
                    transferIds[i], 
                    bob, 
                    block.timestamp + 1 hours, 
                    escrow.nonces(bob)
                );
                escrow.claim(transferIds[i], bob, block.timestamp + 1 hours, sig);
            } else {
                // Dispute and refund odd transfers
                vm.prank(alice);
                escrow.disputeTransfer(transferIds[i]);
                
                vm.prank(alice);
                escrow.refund(transferIds[i]);
            }
        }
        
        assertEq(escrow.totalEscrowed(), 0);
        
        console.log("All transfers processed successfully!");
    }

    // ============ SECURITY STRESS TESTS ============

    function test_CannotStealFundsWithFakeSignature() public {
        bytes32 stealTransfer = keccak256("steal-attempt");
        
        vm.prank(alice);
        escrow.deposit(stealTransfer, 1000 * 10**6, 0);
        
        // Attacker tries to create fake signature
        uint256 fakeKey = 0xdeadbeef;
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            stealTransfer,
            charlie,
            block.timestamp + 1 hours,
            escrow.nonces(charlie),
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakeKey, ethSignedMessageHash);
        bytes memory fakeSignature = abi.encodePacked(r, s, v);
        
        // Should fail with InvalidSignature
        vm.expectRevert(USDCEscrow.InvalidSignature.selector);
        escrow.claim(stealTransfer, charlie, block.timestamp + 1 hours, fakeSignature);
        
        console.log("Fake signature attack prevented!");
    }

    // ============ HELPER FUNCTIONS ============

    function _generateBackendSignature(
        bytes32 transferId,
        address recipient,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            recipient,
            deadline,
            nonce,
            address(escrow),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(backendKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }
}
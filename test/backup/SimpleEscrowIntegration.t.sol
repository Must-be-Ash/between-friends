// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/contracts/SimpleEscrow.sol";
import "./SimpleEscrow.t.sol"; // Import MockUSDC

/**
 * Integration tests for SimpleEscrow that simulate real-world usage patterns
 * These tests verify the contract works as expected with the TypeScript library
 */
contract SimpleEscrowIntegrationTest is Test {
    SimpleEscrow public escrow;
    MockUSDC public usdc;
    
    address public admin;
    address public alice;
    address public bob;
    address public charlie;
    
    function setUp() public {
        admin = makeAddr("admin");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        
        // Deploy contracts
        vm.startPrank(admin);
        usdc = new MockUSDC();
        escrow = new SimpleEscrow(address(usdc));
        vm.stopPrank();
        
        // Give users USDC
        usdc.mint(alice, 10000 * 10**6);
        usdc.mint(bob, 5000 * 10**6);
        usdc.mint(charlie, 1000 * 10**6);
    }

    function testCompleteEmailTransferFlow() public {
        // Simulate: Alice sends $100 to bob@example.com
        string memory email = "bob@example.com";
        string memory claimToken = "abc123def456";
        string memory claimSecret = string(abi.encodePacked(email, claimToken));
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        bytes32 transferId = keccak256("transfer_alice_to_bob");
        uint256 amount = 100 * 10**6;
        
        // Step 1: Alice deposits USDC for Bob
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.deposit(transferId, amount, claimSecretHash, 7);
        vm.stopPrank();
        
        // Verify deposit
        assertTrue(escrow.isClaimable(transferId));
        assertEq(usdc.balanceOf(address(escrow)), amount);
        
        // Step 2: Bob signs up and claims (admin releases)
        vm.startPrank(admin);
        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
        
        // Verify Bob received the USDC
        assertEq(usdc.balanceOf(bob), bobBalanceBefore + amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        
        // Verify transfer is marked as claimed
        (, , , , bool claimed, bool refunded) = escrow.getTransfer(transferId);
        assertTrue(claimed);
        assertFalse(refunded);
    }

    function testMultipleSimultaneousTransfers() public {
        // Alice sends to multiple people
        bytes32 transferId1 = keccak256("transfer1");
        bytes32 transferId2 = keccak256("transfer2");
        bytes32 transferId3 = keccak256("transfer3");
        
        string memory secret1 = "bob@example.com_token1";
        string memory secret2 = "charlie@example.com_token2";
        string memory secret3 = "dave@example.com_token3";
        
        bytes32 hash1 = keccak256(abi.encodePacked(secret1));
        bytes32 hash2 = keccak256(abi.encodePacked(secret2));
        bytes32 hash3 = keccak256(abi.encodePacked(secret3));
        
        uint256 amount1 = 50 * 10**6;
        uint256 amount2 = 75 * 10**6;
        uint256 amount3 = 100 * 10**6;
        
        // Alice deposits all three
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount1 + amount2 + amount3);
        escrow.deposit(transferId1, amount1, hash1, 7);
        escrow.deposit(transferId2, amount2, hash2, 7);
        escrow.deposit(transferId3, amount3, hash3, 7);
        vm.stopPrank();
        
        // Verify all are claimable
        assertTrue(escrow.isClaimable(transferId1));
        assertTrue(escrow.isClaimable(transferId2));
        assertTrue(escrow.isClaimable(transferId3));
        
        // Different people claim at different times
        vm.startPrank(admin);
        
        // Bob claims first
        escrow.adminRelease(transferId1, secret1, bob);
        assertEq(usdc.balanceOf(bob), 5000 * 10**6 + amount1);
        
        // Charlie claims second
        escrow.adminRelease(transferId2, secret2, charlie);
        assertEq(usdc.balanceOf(charlie), 1000 * 10**6 + amount2);
        
        // Dave (new address) claims third
        address dave = makeAddr("dave");
        escrow.adminRelease(transferId3, secret3, dave);
        assertEq(usdc.balanceOf(dave), amount3);
        
        vm.stopPrank();
        
        // Verify escrow is empty
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testUnclaimedTransferRefundFlow() public {
        // Alice sends to bob@example.com but Bob never claims
        bytes32 transferId = keccak256("unclaimed_transfer");
        string memory claimSecret = "bob@example.com_token123";
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        uint256 amount = 200 * 10**6;
        
        // Alice deposits
        vm.startPrank(alice);
        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        usdc.approve(address(escrow), amount);
        escrow.deposit(transferId, amount, claimSecretHash, 7);
        vm.stopPrank();
        
        // Transfer is claimable initially
        assertTrue(escrow.isClaimable(transferId));
        assertFalse(escrow.isRefundable(transferId));
        
        // Fast forward 7 days
        vm.warp(block.timestamp + 7 days + 1);
        
        // Now it's refundable but not claimable
        assertFalse(escrow.isClaimable(transferId));
        assertTrue(escrow.isRefundable(transferId));
        
        // Alice refunds
        vm.startPrank(alice);
        escrow.refund(transferId);
        vm.stopPrank();
        
        // Verify Alice got her money back
        assertEq(usdc.balanceOf(alice), aliceBalanceBefore);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testEmailPrivacyPreservation() public {
        // Verify that email addresses are never stored on-chain
        string memory email = "secret@example.com";
        string memory claimToken = "verysecrettoken";
        string memory claimSecret = string(abi.encodePacked(email, claimToken));
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        bytes32 transferId = keccak256("privacy_test");
        uint256 amount = 50 * 10**6;
        
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.deposit(transferId, amount, claimSecretHash, 7);
        vm.stopPrank();
        
        // Get transfer details
        (
            address sender,
            uint256 storedAmount,
            bytes32 storedHash,
            uint256 expiryTime,
            bool claimed,
            bool refunded
        ) = escrow.getTransfer(transferId);
        
        // Only hash is stored, not the actual email
        assertEq(storedHash, claimSecretHash);
        
        // The actual email cannot be retrieved from the hash
        assertNotEq(storedHash, keccak256(abi.encodePacked(email)));
        assertNotEq(storedHash, keccak256(abi.encodePacked(claimToken)));
        
        // But the correct claim secret works
        vm.startPrank(admin);
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
    }

    function testGasOptimizationForMultipleClaims() public {
        // Test gas usage when admin processes multiple claims in batch
        bytes32[] memory transferIds = new bytes32[](5);
        string[] memory secrets = new string[](5);
        uint256 baseAmount = 10 * 10**6;
        
        // Setup 5 transfers
        vm.startPrank(alice);
        usdc.approve(address(escrow), baseAmount * 5);
        
        for (uint i = 0; i < 5; i++) {
            transferIds[i] = keccak256(abi.encodePacked("transfer", i));
            secrets[i] = string(abi.encodePacked("user", vm.toString(i), "@example.com_token"));
            bytes32 hash = keccak256(abi.encodePacked(secrets[i]));
            
            escrow.deposit(transferIds[i], baseAmount, hash, 7);
        }
        vm.stopPrank();
        
        // Measure gas for batch claiming
        vm.startPrank(admin);
        uint256 totalGas = 0;
        
        for (uint i = 0; i < 5; i++) {
            address recipient = makeAddr(string(abi.encodePacked("user", vm.toString(i))));
            uint256 gasBefore = gasleft();
            escrow.adminRelease(transferIds[i], secrets[i], recipient);
            totalGas += gasBefore - gasleft();
        }
        vm.stopPrank();
        
        uint256 averageGasPerClaim = totalGas / 5;
        console.log("Average gas per claim:", averageGasPerClaim);
        
        // Should be efficient (less than 75k gas per claim)
        assertLt(averageGasPerClaim, 75000, "Gas usage too high for batch claims");
    }

    function testOwnershipTransfer() public {
        address newAdmin = makeAddr("newAdmin");
        
        // Only current owner can transfer ownership
        vm.startPrank(alice);
        vm.expectRevert();
        escrow.transferOwnership(newAdmin);
        vm.stopPrank();
        
        // Current owner transfers ownership
        vm.startPrank(admin);
        escrow.transferOwnership(newAdmin);
        vm.stopPrank();
        
        // Old admin can no longer perform admin functions
        bytes32 transferId = keccak256("test_transfer");
        string memory claimSecret = "test@example.com_token";
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        
        vm.startPrank(alice);
        usdc.approve(address(escrow), 100 * 10**6);
        escrow.deposit(transferId, 100 * 10**6, claimSecretHash, 7);
        vm.stopPrank();
        
        vm.startPrank(admin);
        vm.expectRevert();
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
        
        // New admin can perform admin functions
        vm.startPrank(newAdmin);
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
    }

    function testContractStateConsistency() public {
        // Test that contract state remains consistent across operations
        bytes32 transferId = keccak256("consistency_test");
        string memory claimSecret = "test@example.com_token";
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        uint256 amount = 100 * 10**6;
        
        // Initial state
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertFalse(escrow.isClaimable(transferId));
        assertFalse(escrow.isRefundable(transferId));
        
        // After deposit
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.deposit(transferId, amount, claimSecretHash, 7);
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(address(escrow)), amount);
        assertTrue(escrow.isClaimable(transferId));
        assertFalse(escrow.isRefundable(transferId));
        
        // After claim
        vm.startPrank(admin);
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertFalse(escrow.isClaimable(transferId));
        assertFalse(escrow.isRefundable(transferId));
        
        // Verify final balances
        assertEq(usdc.balanceOf(bob), 5000 * 10**6 + amount);
    }

    function testRealWorldClaimSecretGeneration() public {
        // Test with actual email + claim token patterns used by the app
        string memory email = "user@example.com";
        string memory claimToken = "abc123def456ghi789";
        
        // This matches the TypeScript function: email.toLowerCase().trim() + claimToken
        string memory normalizedEmail = "user@example.com"; // already lowercase
        string memory claimSecret = string(abi.encodePacked(normalizedEmail, claimToken));
        bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
        
        bytes32 transferId = keccak256("real_world_test");
        uint256 amount = 250 * 10**6;
        
        // Deposit
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount);
        escrow.deposit(transferId, amount, claimSecretHash, 7);
        vm.stopPrank();
        
        // Claim with the exact same secret format
        vm.startPrank(admin);
        escrow.adminRelease(transferId, claimSecret, bob);
        vm.stopPrank();
        
        // Verify success
        assertEq(usdc.balanceOf(bob), 5000 * 10**6 + amount);
    }

    function testEdgeCaseEmails() public {
        // Test with various email formats
        string[] memory emails = new string[](4);
        emails[0] = "simple@test.com";
        emails[1] = "user.name@domain.co.uk";
        emails[2] = "user+tag@gmail.com";
        emails[3] = "123@test.com";
        
        string memory claimToken = "token123";
        uint256 amount = 25 * 10**6;
        
        vm.startPrank(alice);
        usdc.approve(address(escrow), amount * 4);
        
        for (uint i = 0; i < 4; i++) {
            string memory claimSecret = string(abi.encodePacked(emails[i], claimToken));
            bytes32 claimSecretHash = keccak256(abi.encodePacked(claimSecret));
            bytes32 transferId = keccak256(abi.encodePacked("edge_case", i));
            
            escrow.deposit(transferId, amount, claimSecretHash, 7);
            
            // Immediately claim to test different email formats
            vm.stopPrank();
            vm.startPrank(admin);
            address recipient = makeAddr(string(abi.encodePacked("user", vm.toString(i))));
            escrow.adminRelease(transferId, claimSecret, recipient);
            assertEq(usdc.balanceOf(recipient), amount);
            vm.stopPrank();
            vm.startPrank(alice);
        }
        vm.stopPrank();
    }
}
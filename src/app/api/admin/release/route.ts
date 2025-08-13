import { NextRequest, NextResponse } from 'next/server'
import { getPendingTransfer, updatePendingTransferStatus, createTransaction, getUserByUserId } from '@/lib/models'
import { prepareSimpleEscrowAdminRelease } from '@/lib/simple-escrow'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { validateCDPAuth, requireUserMatch, requireEmailMatch } from '@/lib/auth'
import { z } from 'zod'
import { Address, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'

// Validation schema
const AdminReleaseRequestSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  claimToken: z.string().min(1, 'Claim token is required'),
  userId: z.string().min(1, 'User ID is required'),
})

// Admin wallet configuration
const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY
if (!ADMIN_PRIVATE_KEY) {
  console.error('ADMIN_WALLET_PRIVATE_KEY not set in environment variables')
}

/**
 * Admin Release API - Handles gasless claiming
 * This endpoint is called when users click "Claim" - admin wallet pays gas, user receives USDC
 * Requires CDP authentication to ensure only verified users can claim their funds
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CDP authentication first
    const authResult = await validateCDPAuth(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: authResult.status || 401 }
      )
    }

    if (!ADMIN_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Admin wallet not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    
    // Validate request
    const { transferId, claimToken, userId } = AdminReleaseRequestSchema.parse(body)
    
    // Verify the authenticated user matches the request
    if (!requireUserMatch(authResult.user.userId, userId)) {
      return NextResponse.json(
        { error: 'Authentication mismatch - you can only claim your own transfers' },
        { status: 403 }
      )
    }
    
    // Get user info
    const claimer = await getUserByUserId(userId)
    if (!claimer) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      )
    }
    
    // Get pending transfer
    const transfer = await getPendingTransfer(transferId)
    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }
    
    // Verify this transfer is for this user
    if (transfer.recipientEmail.toLowerCase() !== claimer.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transfer not intended for this user' },
        { status: 403 }
      )
    }
    
    // Additional security: Verify the authenticated user's email matches the transfer recipient  
    // Note: Email verification temporarily disabled due to CDP v0.0.19 API changes
    // TODO: Re-enable proper email verification once we have proper access tokens working
    // const authenticatedEmail = authResult.user.authenticationMethods?.email?.email
    // if (authenticatedEmail && !requireEmailMatch(authenticatedEmail, transfer.recipientEmail)) {
    //   return NextResponse.json(
    //     { error: 'Authenticated email does not match transfer recipient' },
    //     { status: 403 }
    //   )
    // }
    
    // Verify claim token
    if (transfer.claimToken !== claimToken) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 403 }
      )
    }
    
    // Check if transfer is still pending
    if (transfer.status !== 'pending') {
      return NextResponse.json(
        { error: 'Transfer has already been claimed or expired' },
        { status: 400 }
      )
    }
    
    // Check if not expired
    const now = new Date()
    if (transfer.expiryDate && now > transfer.expiryDate) {
      return NextResponse.json(
        { error: 'Transfer has expired' },
        { status: 400 }
      )
    }
    
    // Check if user has a wallet address
    if (!claimer.walletAddress) {
      return NextResponse.json(
        { error: 'User does not have a wallet address set up' },
        { status: 400 }
      )
    }

    try {
      // Set up admin wallet
      const adminAccount = privateKeyToAccount(ADMIN_PRIVATE_KEY as `0x${string}`)
      const chainConfig = process.env.NODE_ENV === 'development' ? baseSepolia : base
      const adminClient = createWalletClient({
        account: adminAccount,
        chain: chainConfig,
        transport: http(),
      })

      // Prepare the admin release transaction
      // Construct claimSecret as email + claimToken (same as during deposit)
      const claimSecret = `${transfer.recipientEmail}${claimToken}`
      const transaction = await prepareSimpleEscrowAdminRelease({
        transferId,
        recipientAddress: claimer.walletAddress as Address,
        amount: transfer.amount,
        claimSecret
      })

      // Send transaction from admin wallet (admin pays gas!)
      const txHash = await adminClient.sendTransaction({
        to: transaction.to as Address,
        data: transaction.data,
        value: transaction.value,
      })

      // Update transfer status in database
      await updatePendingTransferStatus(transferId, 'claimed', txHash)

      // Record the transaction for the recipient
      await createTransaction({
        userId: claimer.userId,
        userEmail: claimer.email,
        type: 'received',
        counterpartyEmail: transfer.senderEmail, // Who they received money FROM
        amount: `+${transfer.amount}`, // Positive for money entering account
        txHash: txHash,
        transferId,
        status: 'confirmed',
      })

      return NextResponse.json({
        success: true,
        txHash: txHash,
        amount: transfer.amount,
        message: `Successfully claimed ${transfer.amount} USDC! Funds have been sent to your wallet.`,
        gasFreeClaim: true
      })
      
    } catch (error) {
      console.error('Error executing admin release:', error)
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          return NextResponse.json(
            { error: 'Admin wallet has insufficient ETH for gas. Please contact support.' },
            { status: 500 }
          )
        }
        if (error.message.includes('SimpleEscrow contract not deployed')) {
          return NextResponse.json(
            { error: 'Escrow system is not ready. Please contact support.' },
            { status: 501 }
          )
        }
        if (error.message.includes('Invalid claim secret')) {
          return NextResponse.json(
            { error: 'Invalid claim credentials. This transfer may have been tampered with.' },
            { status: 403 }
          )
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to release funds. Please contact support if the issue persists.' },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Admin release request error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint removed for security reasons - was exposing admin wallet address
// If admin monitoring is needed, implement with proper authentication
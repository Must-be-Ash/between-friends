import { NextRequest, NextResponse } from 'next/server'
import { lookupRecipient } from '@/lib/recipient-lookup'
import { prepareUSDCTransfer, hasSufficientBalance } from '@/lib/usdc'
import { prepareEscrowDeposit, generateTransferId, calculateExpiryDate } from '@/lib/escrow'
import { createPendingTransfer, createTransaction, getUserByUserId } from '@/lib/models'
import { generateSecureToken } from '@/lib/utils'
import { z } from 'zod'
import { Address } from 'viem'

// Validation schema
const SendRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  senderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sender address'),
  recipientEmail: z.string().email('Invalid recipient email'),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { userId, senderAddress, recipientEmail, amount } = SendRequestSchema.parse(body)
    
    // Get sender's email from userId
    const sender = await getUserByUserId(userId)
    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 400 }
      )
    }
    const senderEmail = sender.email
    
    // Validate amount range
    const amountNum = parseFloat(amount)
    if (amountNum < 0.01 || amountNum > 1000000) {
      return NextResponse.json(
        { error: 'Amount must be between $0.01 and $1,000,000' },
        { status: 400 }
      )
    }
    
    // Check if sender has sufficient balance
    const hasSufficient = await hasSufficientBalance(senderAddress as Address, amount)
    if (!hasSufficient) {
      return NextResponse.json(
        { error: 'Insufficient USDC balance' },
        { status: 400 }
      )
    }
    
    // Lookup recipient to determine transfer type
    const recipient = await lookupRecipient(recipientEmail)
    
    if (recipient.transferType === 'direct') {
      // Direct transfer to existing user
      if (!recipient.walletAddress) {
        return NextResponse.json(
          { error: 'Recipient wallet address not found' },
          { status: 400 }
        )
      }
      
      try {
        // Prepare USDC transfer transaction
        const transaction = await prepareUSDCTransfer(
          senderAddress as Address,
          recipient.walletAddress as Address,
          amount
        )
        
        return NextResponse.json({
          success: true,
          transferType: 'direct',
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            walletAddress: recipient.walletAddress,
          },
          transaction,
          message: `Ready to send ${amount} USDC directly to ${recipient.displayName || recipient.email}`
        })
      } catch (error) {
        console.error('Direct transfer preparation error:', error)
        return NextResponse.json(
          { error: 'Failed to prepare direct transfer' },
          { status: 500 }
        )
      }
    } else {
      // Escrow transfer for new user
      try {
        // Generate transfer ID and claim token
        const transferId = generateTransferId()
        const claimToken = generateSecureToken(32)
        const expiryDate = calculateExpiryDate(7) // 7 days
        
        // Prepare escrow deposit transaction (no email data on-chain)
        const transaction = await prepareEscrowDeposit(
          senderAddress as Address,
          amount,
          transferId,
          7 // 7 days timeout
        )
        
        // Store pending transfer in database
        const pendingTransfer = await createPendingTransfer({
          transferId,
          senderEmail,
          recipientEmail,
          amount,
          claimToken,
          expiryDate,
        })
        
        return NextResponse.json({
          success: true,
          transferType: 'escrow',
          recipient: {
            email: recipient.email,
          },
          transfer: {
            transferId,
            expiryDate,
          },
          transaction,
          message: `Ready to send ${amount} USDC via escrow to ${recipient.email}. They will receive an email to claim the funds.`
        })
      } catch (error) {
        console.error('Escrow transfer preparation error:', error)
        return NextResponse.json(
          { error: 'Failed to prepare escrow transfer' },
          { status: 500 }
        )
      }
    }
  } catch (error) {
    console.error('Send request error:', error)
    
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

// POST - Confirm transaction (after user signs)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { transferId, txHash, transferType } = body
    
    if (!transferId || !txHash || !transferType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    if (transferType === 'escrow') {
      // Update pending transfer with deposit transaction hash
      const { updatePendingTransferStatus } = await import('@/lib/models')
      await updatePendingTransferStatus(transferId, 'pending', txHash)
      
      // TODO: Send email notification to recipient
      // This will be implemented when we set up Resend
    }
    
    return NextResponse.json({
      success: true,
      message: 'Transaction confirmed'
    })
  } catch (error) {
    console.error('Transaction confirmation error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm transaction' },
      { status: 500 }
    )
  }
}
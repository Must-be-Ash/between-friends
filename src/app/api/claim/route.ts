import { NextRequest, NextResponse } from 'next/server'
import { updatePendingTransferStatus, createTransaction, getPendingTransfer, getUserByEmail } from '@/lib/models'
import { sendClaimSuccessEmail } from '@/lib/email'
import { z } from 'zod'

// Validation schema
const ClaimRequestSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  recipientEmail: z.string().email('Invalid recipient email'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { transferId, txHash, recipientEmail } = ClaimRequestSchema.parse(body)

    // Get transfer details before updating status
    const transfer = await getPendingTransfer(transferId)
    
    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }

    // Update pending transfer status to claimed
    await updatePendingTransferStatus(transferId, 'claimed', txHash)

    // Get recipient display name for email and create transaction record
    const recipient = await getUserByEmail(recipientEmail)
    
    // Create transaction history record for recipient (if they have an account)
    if (recipient) {
      await createTransaction({
        userId: recipient.userId,
        userEmail: recipientEmail,
        type: 'received',
        counterpartyEmail: transfer.senderEmail, // Who they received the claim FROM
        amount: `+${transfer.amount}`, // Positive amount for received
        txHash,
        transferId,
        status: 'confirmed',
      })
    }
    const recipientDisplayName = recipient?.displayName || recipientEmail.split('@')[0]

    // Send claim success email
    const emailResult = await sendClaimSuccessEmail({
      recipientEmail,
      senderEmail: transfer.senderEmail,
      amount: transfer.amount,
      txHash,
      recipientName: recipientDisplayName,
      claimTxHash: txHash
    })

    if (!emailResult.success) {
      console.error('Failed to send claim success email:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Claim processed successfully',
      emailSent: emailResult.success
    })
  } catch (error) {
    console.error('Claim processing error:', error)
    
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
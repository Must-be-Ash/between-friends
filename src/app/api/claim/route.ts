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

    // Create transaction history record for recipient
    await createTransaction({
      userEmail: recipientEmail,
      type: 'received_claim',
      amount: transfer.amount,
      txHash,
      transferId,
      status: 'confirmed',
      senderEmail: transfer.senderEmail,
    })

    // Get recipient display name for email
    const recipient = await getUserByEmail(recipientEmail)
    const recipientDisplayName = recipient?.displayName || recipientEmail.split('@')[0]

    // Send claim success email
    const emailResult = await sendClaimSuccessEmail({
      recipientEmail,
      recipientName: recipientDisplayName,
      senderEmail: transfer.senderEmail,
      amount: transfer.amount,
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
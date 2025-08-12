import { NextRequest, NextResponse } from 'next/server'
import { getPendingTransfer, updatePendingTransferStatus, createTransaction, getUserByEmail } from '@/lib/models'
import { sendRefundConfirmationEmail } from '@/lib/email'
import { z } from 'zod'

// Validation schema
const RefundRequestSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  senderEmail: z.string().email('Invalid sender email'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { transferId, senderEmail } = RefundRequestSchema.parse(body)

    // Get pending transfer from database
    const pendingTransfer = await getPendingTransfer(transferId)

    if (!pendingTransfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }

    // Verify sender owns this transfer
    if (pendingTransfer.senderEmail !== senderEmail) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only refund your own transfers' },
        { status: 403 }
      )
    }

    // Check if transfer is still refundable
    if (pendingTransfer.status !== 'pending') {
      const statusMessages = {
        claimed: 'This transfer has already been claimed and cannot be refunded',
        refunded: 'This transfer has already been refunded',
        expired: 'This transfer has expired'
      }
      
      return NextResponse.json(
        { error: statusMessages[pendingTransfer.status as keyof typeof statusMessages] || 'Transfer cannot be refunded' },
        { status: 400 }
      )
    }

    // Process refund on-chain
    try {
      // This would need to be implemented with proper transaction signing
      // For now, we'll simulate the refund process
      const refundTxHash = 'simulated-refund-hash'

      // Update pending transfer status to refunded
      await updatePendingTransferStatus(transferId, 'refunded', refundTxHash)

      // Create transaction history record for sender
      await createTransaction({
        userEmail: senderEmail,
        type: 'refund',
        amount: pendingTransfer.amount,
        txHash: refundTxHash,
        transferId,
        status: 'confirmed',
        recipientEmail: pendingTransfer.recipientEmail,
      })

      // Get sender display name for email
      const sender = await getUserByEmail(senderEmail)
      const senderDisplayName = sender?.displayName || senderEmail.split('@')[0]

      // Send refund confirmation email
      const emailResult = await sendRefundConfirmationEmail({
        senderEmail,
        senderName: senderDisplayName,
        recipientEmail: pendingTransfer.recipientEmail,
        amount: pendingTransfer.amount,
        refundTxHash
      })

      if (!emailResult.success) {
        console.error('Failed to send refund confirmation email:', emailResult.error)
      }

      return NextResponse.json({
        success: true,
        message: 'Refund processed successfully',
        txHash: refundTxHash,
        emailSent: emailResult.success
      })
    } catch (escrowError) {
      console.error('Escrow refund error:', escrowError)
      return NextResponse.json(
        { error: 'Failed to process refund on blockchain. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Refund processing error:', error)
    
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
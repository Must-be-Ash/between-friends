import { NextRequest, NextResponse } from 'next/server'
import { updatePendingTransferStatus, createTransaction, getUserByEmail } from '@/lib/models'
import { sendClaimNotificationEmail } from '@/lib/email'
import { z } from 'zod'

// Validation schema
const ConfirmTransferSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  senderEmail: z.string().email('Invalid sender email'),
  transferType: z.enum(['escrow', 'direct']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { transferId, txHash, senderEmail, transferType } = ConfirmTransferSchema.parse(body)

    if (transferType === 'escrow') {
      // Update pending transfer with deposit transaction hash
      await updatePendingTransferStatus(transferId, 'pending', txHash)

      // Get transfer details for email
      const { getPendingTransfer } = await import('@/lib/models')
      const transfer = await getPendingTransfer(transferId)
      
      if (transfer) {
        // Get sender display name
        const sender = await getUserByEmail(senderEmail)
        const senderDisplayName = sender?.displayName || senderEmail.split('@')[0]

        // Generate claim URL
        const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/claim?id=${transferId}&token=${transfer.claimToken}`

        // Send claim notification email
        const emailResult = await sendClaimNotificationEmail({
          recipientEmail: transfer.recipientEmail,
          senderName: senderDisplayName,
          senderEmail,
          amount: transfer.amount,
          claimUrl,
          expiryDate: transfer.expiryDate
        })

        if (!emailResult.success) {
          console.error('Failed to send claim notification email:', emailResult.error)
        }

        // Create transaction record for sender (if they have an account)
        if (sender) {
          await createTransaction({
            userId: sender.userId,
            userEmail: senderEmail,
            type: 'sent',
            counterpartyEmail: transfer.recipientEmail, // Who they sent money TO
            amount: `-${transfer.amount}`, // Negative for money leaving account
            txHash,
            transferId,
            status: 'confirmed',
          })
        }

        return NextResponse.json({
          success: true,
          message: 'Escrow transfer confirmed and claim email sent',
          emailSent: emailResult.success
        })
      } else {
        return NextResponse.json(
          { error: 'Transfer not found' },
          { status: 404 }
        )
      }
    } else {
      // Direct transfer - just create transaction record
      // The recipient should already have the funds in their wallet
      const body = await request.json()
      const { recipientEmail, amount } = body

      // Get sender information for transaction record
      const sender = await getUserByEmail(senderEmail)

      // Create transaction record for sender (if they have an account)
      if (sender) {
        await createTransaction({
          userId: sender.userId,
          userEmail: senderEmail,
          type: 'sent',
          counterpartyEmail: recipientEmail, // Who they sent money TO
          amount: `-${amount}`, // Negative for money leaving account
          txHash,
          status: 'confirmed',
        })
      }

      // Create transaction record for recipient (if they have an account)
      try {
        const recipient = await getUserByEmail(recipientEmail)
        if (recipient) {
          await createTransaction({
            userId: recipient.userId,
            userEmail: recipientEmail,
            type: 'received',
            counterpartyEmail: senderEmail, // Who they received money FROM
            amount: `+${amount}`, // Positive for money entering account
            txHash,
            status: 'confirmed',
          })
        }
      } catch (error) {
        // Recipient may not have an account yet - that's okay
        console.log('Recipient does not have an account yet')
      }

      return NextResponse.json({
        success: true,
        message: 'Direct transfer confirmed'
      })
    }
  } catch (error) {
    console.error('Transfer confirmation error:', error)
    
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
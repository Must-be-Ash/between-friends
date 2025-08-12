import { NextRequest, NextResponse } from 'next/server'
import { createTransaction, getUserByUserId, getUserByEmail } from '@/lib/models'
import { z } from 'zod'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// Validation schema
const CompleteTransferSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  txHash: z.string().min(1, 'Transaction hash is required'),
  transferType: z.enum(['direct', 'escrow']),
  recipient: z.object({
    email: z.string().email('Invalid recipient email'),
    displayName: z.string().optional(),
    exists: z.boolean(),
  }),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
  transferId: z.string().optional(), // For escrow transfers
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { userId, txHash, transferType, recipient, amount, transferId } = CompleteTransferSchema.parse(body)
    
    // Get sender's information
    const sender = await getUserByUserId(userId)
    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 400 }
      )
    }
    
    const senderEmail = sender.email
    const recipientEmail = recipient.email
    
    // Create transaction record for sender
    const senderTransactionType = transferType === 'direct' ? 'sent_direct' : 'sent_escrow'
    
    await createTransaction({
      userEmail: senderEmail,
      type: senderTransactionType,
      recipientEmail: recipientEmail,
      amount: amount,
      txHash: txHash,
      transferId: transferId,
      status: transferType === 'direct' ? 'confirmed' : 'pending',
      message: `Sent ${amount} USDC to ${recipient.displayName || '[EMAIL_REDACTED]'}`
    })
    
    console.log(`✅ TRANSACTION HISTORY CREATED FOR SENDER:`, {
      userEmail: '[EMAIL_REDACTED]',
      type: senderTransactionType,
      recipientEmail: '[EMAIL_REDACTED]',
      amount,
      txHash,
      status: transferType === 'direct' ? 'confirmed' : 'pending'
    })
    
    // For direct transfers to existing users, also create transaction record for recipient
    if (transferType === 'direct' && recipient.exists) {
      try {
        const recipientUser = await getUserByEmail(recipientEmail)
        if (recipientUser) {
          await createTransaction({
            userEmail: recipientEmail,
            type: 'received_direct',
            senderEmail: senderEmail,
            amount: amount,
            txHash: txHash,
            status: 'confirmed',
            message: `Received ${amount} USDC from ${sender.displayName || '[EMAIL_REDACTED]'}`
          })
          
          console.log(`✅ TRANSACTION HISTORY CREATED FOR RECIPIENT:`, {
            userEmail: '[EMAIL_REDACTED]',
            type: 'received_direct',
            senderEmail: '[EMAIL_REDACTED]',
            amount,
            txHash,
            status: 'confirmed'
          })
        }
      } catch (recipientError) {
        console.error('Failed to create recipient transaction record:', recipientError)
        // Don't fail the entire request if recipient record creation fails
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Transaction completed and recorded in history',
      transactionType: senderTransactionType,
      senderRecord: true,
      recipientRecord: transferType === 'direct' && recipient.exists
    })
    
  } catch (error) {
    console.error('Transaction completion error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to complete transaction' },
      { status: 500 }
    )
  }
}
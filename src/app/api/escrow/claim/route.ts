import { NextRequest, NextResponse } from 'next/server'
import { getPendingTransfer } from '@/lib/models'
import { prepareEscrowClaim, getRecipientNonce, generateClaimMessageHash } from '@/lib/escrow'
import { z } from 'zod'
import { Address } from 'viem'

// Validation schema
const EscrowClaimRequestSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID is required'),
  claimToken: z.string().min(1, 'Claim token is required'),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const { transferId, claimToken, recipientAddress } = EscrowClaimRequestSchema.parse(body)
    
    // Get pending transfer
    const transfer = await getPendingTransfer(transferId)
    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }
    
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
    if (now > transfer.expiryDate) {
      return NextResponse.json(
        { error: 'Transfer has expired' },
        { status: 400 }
      )
    }

    try {
      // Get recipient nonce for signature
      const nonce = await getRecipientNonce(recipientAddress as Address)
      
      // Calculate deadline (current time + 1 hour)
      const deadline = Math.floor(Date.now() / 1000) + 3600
      
      // Generate message hash for signing
      const messageHash = generateClaimMessageHash(
        transferId,
        recipientAddress as Address,
        BigInt(deadline),
        nonce
      )
      
      // For now, we'll create a simple signature (this would normally be signed by the original sender)
      // In a production app, this would require the sender's signature or use a different approach
      const signature = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
      
      // Prepare the claim transaction
      const transaction = await prepareEscrowClaim(
        transferId,
        recipientAddress as Address,
        deadline,
        signature
      )
      
      // Convert BigInt values to strings for JSON serialization
      const serializedTransaction = {
        ...transaction,
        value: transaction.value?.toString(),
        gas: transaction.gas?.toString(),
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
      }
      
      return NextResponse.json({
        success: true,
        transaction: serializedTransaction,
        messageHash,
        deadline,
        nonce: nonce.toString()
      })
      
    } catch (error) {
      console.error('Error preparing claim transaction:', error)
      return NextResponse.json(
        { error: 'Failed to prepare claim transaction' },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Escrow claim request error:', error)
    
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
import { NextRequest, NextResponse } from 'next/server'
import { lookupRecipient } from '@/lib/recipient-lookup'
import { prepareUSDCTransfer, hasSufficientBalance, hasSufficientAllowance, prepareUSDCApproval } from '@/lib/usdc'
import { prepareSimpleEscrowDeposit, generateTransferId as generateSimpleTransferId } from '@/lib/simple-escrow'
import { createPendingTransfer, getUserByUserId } from '@/lib/models'
import { generateSecureToken } from '@/lib/utils'
import { CONTRACT_ADDRESSES } from '@/lib/cdp'
import { z } from 'zod'
import { Address } from 'viem'

// Helper function to calculate expiry date
function calculateExpiryDate(days: number): Date {
  const now = new Date()
  now.setDate(now.getDate() + days)
  return now
}

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
          transferType: 'direct',
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            walletAddress: recipient.walletAddress,
          },
          transaction: serializedTransaction,
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
        // Generate transfer ID and claim token for SimpleEscrow
        const transferId = generateSimpleTransferId()
        const claimToken = generateSecureToken(32)
        const expiryDate = calculateExpiryDate(7) // 7 days
        
        // For SimpleEscrow, we need to check allowance for the new contract
        // First, try to import the new escrow address
        const { SIMPLE_ESCROW_ADDRESS } = await import('@/lib/simple-escrow')
        
        // Check if SimpleEscrow is deployed, otherwise fallback to old escrow
        const useSimpleEscrow = SIMPLE_ESCROW_ADDRESS && SIMPLE_ESCROW_ADDRESS !== '0x0000000000000000000000000000000000000000'
        const escrowAddress = useSimpleEscrow ? SIMPLE_ESCROW_ADDRESS : CONTRACT_ADDRESSES.ESCROW
        
        const hasAllowance = await hasSufficientAllowance(
          senderAddress as Address,
          escrowAddress as Address,
          amount
        )
        
        // Prepare transactions - approval first if needed, then deposit
        const transactions: Array<Record<string, unknown>> = []
        
        if (!hasAllowance) {
          // Prepare approval transaction for the correct escrow contract
          const approvalTx = await prepareUSDCApproval(
            senderAddress as Address,
            escrowAddress as Address,
            amount
          )
          // Serialize BigInt values
          const serializedApprovalTx = {
            ...approvalTx,
            value: approvalTx.value.toString(),
            gas: approvalTx.gas.toString(),
            maxFeePerGas: approvalTx.maxFeePerGas.toString(),
            maxPriorityFeePerGas: approvalTx.maxPriorityFeePerGas.toString(),
            description: `Approve USDC for ${useSimpleEscrow ? 'new' : 'legacy'} escrow contract`
          }
          transactions.push(serializedApprovalTx)
        }
        
        // Prepare escrow deposit transaction (no email data on-chain)
        // Only prepare if we have allowance, otherwise just store the parameters
        if (hasAllowance) {
          let depositTx
          
          if (useSimpleEscrow) {
            // Use new SimpleEscrow contract
            depositTx = await prepareSimpleEscrowDeposit(
              senderAddress as Address,
              amount,
              transferId,
              recipientEmail, // email for claim secret generation
              claimToken,
              7 // 7 days timeout
            )
          } else {
            // Only SimpleEscrow is supported
            throw new Error('Simple escrow is required')
          }
          
          // Serialize BigInt values
          const serializedDepositTx = {
            ...depositTx,
            value: depositTx.value?.toString(),
            gas: depositTx.gas?.toString(),
            maxFeePerGas: depositTx.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: depositTx.maxPriorityFeePerGas?.toString(),
            description: `Deposit USDC to ${useSimpleEscrow ? 'new' : 'legacy'} escrow`
          }
          transactions.push(serializedDepositTx)
        } else {
          // Store deposit parameters for later preparation after approval
          transactions.push({
            type: useSimpleEscrow ? 'simple_escrow_deposit' : 'escrow_deposit',
            parameters: {
              senderAddress,
              amount,
              transferId,
              recipientEmail,
              claimToken,
              timeoutDays: 7,
              useSimpleEscrow
            },
            description: `Deposit USDC to ${useSimpleEscrow ? 'new' : 'legacy'} escrow`
          })
        }
        
        // Store pending transfer in database
        await createPendingTransfer({
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
          transactions,
          requiresApproval: !hasAllowance,
          message: `Ready to send ${amount} USDC via escrow to ${recipient.email}. ${!hasAllowance ? 'Approval required first. ' : ''}They will receive an email to claim the funds.`
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
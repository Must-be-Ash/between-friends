import { NextRequest, NextResponse } from 'next/server'
import { lookupRecipientServer } from '@/lib/recipient-lookup'
import { prepareUSDCTransfer, hasSufficientBalance, hasSufficientAllowance, prepareUSDCApproval, hasSufficientETHForGas } from '@/lib/usdc'
import { prepareSimpleEscrowDeposit, generateTransferId as generateSimpleTransferId } from '@/lib/simple-escrow'
import { createPendingTransfer, getUserByUserId } from '@/lib/models'
import { generateSecureToken } from '@/lib/utils'
import { CONTRACT_ADDRESSES, CURRENT_NETWORK, calculateExpiryDate } from '@/lib/cdp'
import { z } from 'zod'
import { Address } from 'viem'

// calculateExpiryDate is imported from @/lib/cdp

// Helper function to recursively serialize BigInt values
function serializeBigInt(obj: unknown): unknown {
  if (typeof obj === 'bigint') {
    return obj.toString()
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value)
    }
    return result
  }
  return obj
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
    const recipient = await lookupRecipientServer(recipientEmail)
    console.log('🔍 RECIPIENT LOOKUP RESULT:', {
      email: recipientEmail,
      recipient,
      transferType: recipient.transferType,
      exists: recipient.exists,
      hasWallet: !!recipient.walletAddress
    })
    
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
        
        // Check if user has sufficient ETH for gas
        const hasETHForGas = await hasSufficientETHForGas(
          senderAddress as Address,
          transaction.gas || BigInt(60000),
          transaction.maxFeePerGas || BigInt(1000000000)
        )
        
        // Convert BigInt values to strings for JSON serialization
        const serializedTransaction: Record<string, unknown> = {
          to: transaction.to,
          value: transaction.value?.toString() || '0',
          data: transaction.data,
          gas: transaction.gas?.toString(),
          maxFeePerGas: transaction.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
          chainId: transaction.chainId,
          type: transaction.type || 'eip1559',
          gasSponsored: !hasETHForGas // Flag to indicate if gas is sponsored
        }
        
        // Only include gasLimit if it exists
        if (transaction.gasLimit) {
          serializedTransaction.gasLimit = transaction.gasLimit.toString()
        }
        
        console.log('🔍 DIRECT TRANSFER TRANSACTION:', {
          original: {
            to: transaction.to,
            value: transaction.value?.toString(),
            gas: transaction.gas?.toString(),
            maxFeePerGas: transaction.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
            type: transaction.type
          },
          serialized: serializedTransaction
        })

        // Transaction record will be created in /send/complete after successful signing
        // Don't create transaction here to avoid duplicates

        const response = {
          success: true,
          transferType: 'direct',
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            walletAddress: recipient.walletAddress,
          },
          transaction: serializedTransaction,
          message: `Ready to send ${amount} USDC directly to ${recipient.displayName || recipient.email}`
        }
        
        return NextResponse.json(serializeBigInt(response))
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
        const claimToken = generateSecureToken()
        const expiryDate = calculateExpiryDate(7) // 7 days
        
        // For SimpleEscrow, we need to check allowance for the new contract
        // First, try to import the new escrow address
        const { SIMPLE_ESCROW_ADDRESS } = await import('@/lib/simple-escrow')
        
        // Check if SimpleEscrow is deployed, otherwise fallback to old escrow
        const useSimpleEscrow = SIMPLE_ESCROW_ADDRESS && SIMPLE_ESCROW_ADDRESS !== '0x0000000000000000000000000000000000000001'
        const escrowAddress = useSimpleEscrow ? SIMPLE_ESCROW_ADDRESS : CONTRACT_ADDRESSES.ESCROW[CURRENT_NETWORK as keyof typeof CONTRACT_ADDRESSES.ESCROW]
        
        const hasAllowance = await hasSufficientAllowance(
          senderAddress as Address,
          escrowAddress as Address,
          amount
        )
        
        // Prepare transactions - approval first if needed, then deposit
        const transactions: Array<Record<string, unknown>> = []
        
        if (!hasAllowance) {
          // Prepare approval transaction for the correct escrow contract
          const approvalTx = prepareUSDCApproval(
            senderAddress as string,
            escrowAddress as string,
            amount
          )
          // Serialize BigInt values
          const serializedApprovalTx = {
            ...approvalTx,
            value: approvalTx.value.toString(),
            gas: approvalTx.gas?.toString(),
            maxFeePerGas: approvalTx.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: approvalTx.maxPriorityFeePerGas?.toString(),
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
            depositTx = prepareSimpleEscrowDeposit({
              transferId,
              recipientEmail,
              amount
            })
          } else {
            // Only SimpleEscrow is supported
            throw new Error('Simple escrow is required')
          }
          
          // Serialize BigInt values
          const serializedDepositTx = {
            ...depositTx,
            value: depositTx.value?.toString() || '0',
            gas: depositTx.gas?.toString(),
            gasLimit: depositTx.gasLimit?.toString(),
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
          senderUserId: userId,
          senderEmail,
          recipientEmail,
          amount,
          status: 'pending',
          type: 'escrow',
          claimToken,
          expiryDate,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        
        // Transaction record will be created in /send/complete after successful signing
        // Don't create transaction here to avoid duplicates
        
        const response = {
          success: true,
          transferType: 'escrow',
          recipient: {
            email: recipient.email,
          },
          transfer: {
            transferId,
            expiryDate: expiryDate.toISOString(),
          },
          transactions,
          requiresApproval: !hasAllowance,
          message: `Ready to send ${amount} USDC via escrow to ${recipient.email}. ${!hasAllowance ? 'Approval required first. ' : ''}They will receive an email to claim the funds.`
        }
        
        return NextResponse.json(serializeBigInt(response))
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
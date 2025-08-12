"use client";

import { useState } from 'react'
import { useSendEvmTransaction } from '@coinbase/cdp-hooks'
import { formatUSDCWithSymbol } from '@/lib/utils'

interface RecipientInfo {
  email: string
  exists: boolean
  displayName?: string
  transferType: 'direct' | 'escrow'
}

interface TransferData {
  recipient: RecipientInfo
  amount: string
}

interface CDPUser {
  userId: string
  email?: string
}

interface SendConfirmationProps {
  transferData: TransferData
  currentUser: CDPUser
  evmAddress: string
  onSuccess: (txHash: string) => void
  onBack: () => void
}

export function SendConfirmation({ transferData, currentUser, evmAddress, onSuccess, onBack }: SendConfirmationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('')
  // const [showTransactionConfirmation, setShowTransactionConfirmation] = useState(false)
  // const [pendingTransactionData, setPendingTransactionData] = useState<any>(null)
  
  const { recipient, amount } = transferData
  const isDirect = recipient.transferType === 'direct'
  const sendEvmTransaction = useSendEvmTransaction()

  const handleConfirmSend = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setError(null)
    setCurrentStep('Preparing transaction...')

    try {
      // Get transaction data from API
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.userId,
          senderAddress: evmAddress,
          recipientEmail: recipient.email,
          amount: amount
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process transfer')
      }

      const result = await response.json()
      let finalTxHash: string | null = null

      if (result.transferType === 'direct') {
        // Check if gas sponsorship is needed
        if (result.transaction.gasSponsored) {
          setCurrentStep('Processing gas-sponsored transfer...')
          
          // TODO: Implement gas-sponsored flow
          // This would require user to sign an approval and let admin handle gas
          console.log('🎁 GAS SPONSORSHIP NEEDED - User has insufficient ETH for gas')
          
          // For now, show a message and exit - in production this would trigger the sponsored flow
          alert('✨ Gas sponsorship detected! This feature will cover your gas fees when you have insufficient ETH.')
          onSuccess('gas-sponsored-pending')
          return // Skip normal flow for now
        }
        
        // Single transaction - direct USDC transfer
        setCurrentStep('Sending USDC...')
        
        // Convert string values back to BigInt for CDP
        console.log('🔍 RAW TRANSACTION FROM API:', result.transaction)
        
        const transaction = {
          to: result.transaction.to as `0x${string}`,
          data: result.transaction.data as `0x${string}`,
          value: result.transaction.value ? BigInt(result.transaction.value) : 0n,
          gas: result.transaction.gas ? BigInt(result.transaction.gas) : undefined,
          maxFeePerGas: result.transaction.maxFeePerGas ? BigInt(result.transaction.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: result.transaction.maxPriorityFeePerGas ? BigInt(result.transaction.maxPriorityFeePerGas) : undefined,
          chainId: result.transaction.chainId as number,
          type: result.transaction.type as "eip1559",
          ...(result.transaction.gasLimit && { gasLimit: BigInt(result.transaction.gasLimit) })
        }
        
        console.log('🔍 CONVERTED TRANSACTION FOR CDP:', transaction)
        
        console.log('🔐 CDP TRANSACTION SIGNING:', {
          type: 'Direct Transfer',
          transaction: transaction,
          evmAccount: evmAddress,
          network: 'base-sepolia',
          timestamp: new Date().toISOString()
        })
        
        const txResult = await sendEvmTransaction({
          transaction,
          evmAccount: evmAddress as `0x${string}`,
          network: 'base-sepolia',
        })
        
        console.log('✅ CDP TRANSACTION RESULT:', {
          transactionHash: txResult.transactionHash,
          timestamp: new Date().toISOString()
        })
        
        finalTxHash = txResult.transactionHash
      } else {
        // Multi-transaction - approval + escrow deposit
        const transactions = result.transactions
        
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          setCurrentStep(tx.description || `Transaction ${i + 1} of ${transactions.length}`)
          
          // If this is an escrow deposit that needs to be prepared after approval
          if ((tx.type === 'escrow_deposit' || tx.type === 'simple_escrow_deposit') && tx.parameters) {
            let depositTx
            
            if (tx.type === 'simple_escrow_deposit') {
              // Prepare the new SimpleEscrow deposit transaction
              const { prepareSimpleEscrowDeposit } = await import('@/lib/simple-escrow')
              const { amount, transferId, recipientEmail } = tx.parameters
              
              depositTx = prepareSimpleEscrowDeposit({
                transferId,
                recipientEmail,
                amount
              })
            } else {
              // This should not happen - only SimpleEscrow is supported
              throw new Error('Legacy escrow deposit is no longer supported')
            }
            
            console.log('🔐 CDP ESCROW DEPOSIT SIGNING:', {
              type: tx.type === 'simple_escrow_deposit' ? 'SimpleEscrow Deposit' : 'Legacy Escrow Deposit',
              transaction: depositTx,
              evmAccount: evmAddress,
              network: 'base-sepolia',
              step: `${i + 1}/${transactions.length}`,
              timestamp: new Date().toISOString()
            })
            
            const txResult = await sendEvmTransaction({
              transaction: depositTx,
              evmAccount: evmAddress as `0x${string}`,
              network: 'base-sepolia',
            })
            
            console.log('✅ CDP ESCROW DEPOSIT RESULT:', {
              transactionHash: txResult.transactionHash,
              timestamp: new Date().toISOString()
            })
            
            finalTxHash = txResult.transactionHash
          } else {
            // Regular pre-prepared transaction - convert strings back to BigInt
            const transaction = {
              ...tx,
              value: tx.value ? BigInt(tx.value) : 0n,
              gas: tx.gas ? BigInt(tx.gas) : undefined,
              maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
              maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
            }
            
            console.log('🔐 CDP APPROVAL SIGNING:', {
              type: 'USDC Approval',
              transaction: transaction,
              evmAccount: evmAddress,
              network: 'base-sepolia',
              step: `${i + 1}/${transactions.length}`,
              description: tx.description,
              timestamp: new Date().toISOString()
            })
            
            const txResult = await sendEvmTransaction({
              transaction,
              evmAccount: evmAddress as `0x${string}`,
              network: 'base-sepolia',
            })
            
            console.log('✅ CDP APPROVAL RESULT:', {
              transactionHash: txResult.transactionHash,
              step: `${i + 1}/${transactions.length}`,
              timestamp: new Date().toISOString()
            })
            
            // Store the final transaction hash (deposit transaction)
            if (i === transactions.length - 1) {
              finalTxHash = txResult.transactionHash
            }
          }
        }
        
        // Update the transfer status in database
        if (finalTxHash && result.transfer?.transferId) {
          await fetch('/api/send', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transferId: result.transfer.transferId,
              txHash: finalTxHash,
              transferType: 'escrow'
            }),
          })
        }
      }
      
      // Call completion API to record transaction in history
      if (finalTxHash) {
        try {
          console.log('📝 RECORDING TRANSACTION IN HISTORY:', {
            txHash: finalTxHash,
            transferType: isDirect ? 'direct' : 'escrow',
            recipient,
            amount
          })
          
          await fetch('/api/send/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: currentUser.userId,
              txHash: finalTxHash,
              transferType: isDirect ? 'direct' : 'escrow',
              recipient: {
                email: recipient.email,
                displayName: recipient.displayName,
                exists: recipient.exists,
              },
              amount: amount,
              transferId: result.transfer?.transferId
            }),
          })
          
          console.log('✅ TRANSACTION HISTORY RECORDED SUCCESSFULLY')
        } catch (historyError) {
          console.error('Failed to record transaction history:', historyError)
          // Don't fail the entire flow if history recording fails
        }
        
        onSuccess(finalTxHash)
      } else {
        throw new Error('Transaction completed but no hash received')
      }
      
    } catch (error) {
      console.error('Transfer error:', error)
      setError(error instanceof Error ? error.message : 'Failed to process transfer')
    } finally {
      setIsProcessing(false)
      setCurrentStep('')
    }
  }

  return (
    <div className="bg-[#222222] rounded-3xl p-6 space-y-6">
      {/* Final Confirmation Card */}
      <div className=" rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 bg-[#4A4A4A] border border-[#6B6B6B]">
            <svg className="w-8 h-8 text-[#B8B8B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold text-white mb-3">
            Confirm Your Transfer
          </h3>
          
          <p className="text-[#B8B8B8]">
            Ready to send money via email
          </p>
        </div>

                {/* Transfer Details */}
       <div className="bg-[#2A2A2A] rounded-xl py-6 px-6 border border-[#4A4A4A] space-y-5 -mx-8">
         <div className="flex justify-between items-center">
            <span className="text-[#B8B8B8]">Sending</span>
            <span className="text-xl font-bold text-white">
              {formatUSDCWithSymbol(amount)}
            </span>
          </div>
          
          <div className="flex justify-between items-start">
            <span className="text-[#B8B8B8]">To</span>
            <div className="text-right">
              <div className="font-medium text-white">
                {recipient.displayName || recipient.email}
              </div>
              {recipient.displayName && (
                <div className="text-sm text-[#999999] mt-1">{recipient.email}</div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Error Display */}
      {error && (
        <div className="bg-[#4A2A2A] rounded-2xl p-6 border border-[#6B3B3B] shadow-2xl">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-[#CC6666] mt-1 mr-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-[#FFAAAA] mb-2">Transaction Failed</h4>
              <p className="text-[#CCAAAA] text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4 pt-2">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 py-4 px-6 border border-[#5A5A5A] rounded-xl font-medium text-[#CCCCCC] bg-[#333333] hover:bg-[#4A4A4A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        
        <button
          onClick={handleConfirmSend}
          disabled={isProcessing}
          className="flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed bg-[#5A5A5A] hover:bg-[#6B6B6B] border border-[#7A7A7A]"
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Processing...
            </div>
          ) : (
            'Confirm'
          )}
        </button>
      </div>

      {/* Processing status */}
      {isProcessing && (
        <div className="text-center pt-2">
          <p className="text-sm text-[#B8B8B8]">
            {currentStep || 'Setting up escrow and sending email notification...'}
          </p>
        </div>
      )}
    </div>
  )
}
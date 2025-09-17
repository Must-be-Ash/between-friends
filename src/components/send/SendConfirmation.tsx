"use client";

import { useState } from 'react'
import { useSendEvmTransaction, useGetAccessToken } from '@coinbase/cdp-hooks'
import { formatUSDCWithSymbol } from '@/lib/utils'
import { getCDPNetworkName } from '@/lib/cdp'
import { useSmartAccount } from '@/hooks/useSmartAccount'

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
  evmAddress: string | null
  onSuccess: (txHash: string) => void
  onBack: () => void
}

export function SendConfirmation({ transferData, currentUser, evmAddress, onSuccess, onBack }: SendConfirmationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [useSmartAccountMode, setUseSmartAccountMode] = useState(true) // Default to smart account
  
  const { recipient, amount } = transferData
  const isDirect = recipient.transferType === 'direct'
  
  // Smart account hook
  const smartAccountHook = useSmartAccount()
  const {
    hasSmartAccount,
    getGasSponsoringStatus,
    getErrorMessage,
    paymasterEnabled
  } = smartAccountHook

  const gasSponsoringStatus = getGasSponsoringStatus()
  
  // Fallback to regular EOA transaction
  const { sendEvmTransaction } = useSendEvmTransaction()
  const { getAccessToken } = useGetAccessToken()

  const handleConfirmSend = async () => {
    if (isProcessing || !evmAddress) return

    setIsProcessing(true)
    setError(null)
    setCurrentStep('Preparing transaction...')

    try {
      // Use smart account if available and enabled
      if (useSmartAccountMode && smartAccountHook.hasSmartAccount) {
        await handleSmartAccountSend()
      } else {
        await handleEOASend()
      }
    } catch (error) {
      console.error('❌ Send failed:', error)
      // Use smart account error handler for better user-friendly messages
      const errorMessage = getErrorMessage(error)
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSmartAccountSend = async () => {
    setCurrentStep('Preparing smart account transaction...')
    
    if (isDirect) {
      // Direct transfer using smart account
      setCurrentStep('Sending USDC via smart account...')
      
      // For direct transfers, we need to get the recipient's wallet address from the API
      const accessToken = await getAccessToken()
      const userResponse = await fetch(`/api/users?email=${encodeURIComponent(recipient.email)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get recipient wallet address')
      }

      const { user: recipientUser } = await userResponse.json()
      const recipientAddress = recipientUser.walletAddress

      if (!recipientAddress) {
        throw new Error('Recipient wallet address not found')
      }

      const result = await smartAccountHook.sendDirectTransfer({
        recipientAddress: recipientAddress,
        amount: amount,
        useGasSponsoring: true // Enable gas sponsoring
      })
      
      console.log('✅ Smart Account Direct Transfer Result:', result)
      onSuccess(result.userOperationHash)
    } else {
      // Escrow deposit using smart account
      setCurrentStep('Creating escrow deposit via smart account...')
      
      // Generate a unique transfer ID
      const transferId = `escrow_${Date.now()}_${Math.random().toString(36).substring(2)}`
      
      const result = await smartAccountHook.sendEscrowDeposit({
        transferId,
        amount: amount,
        recipientEmail: recipient.email,
        timeoutDays: 7,
        useGasSponsoring: true // Enable gas sponsoring
      })
      
      console.log('✅ Smart Account Escrow Deposit Result:', result)
      onSuccess(result.userOperationHash)
    }
  }

  const handleEOASend = async () => {
    // Fallback to original EOA transaction logic
    try {
      // Get transaction data from API
      const accessToken = await getAccessToken()
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
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
          network: getCDPNetworkName(),
          timestamp: new Date().toISOString()
        })
        
        const txResult = await sendEvmTransaction({
          transaction,
          evmAccount: evmAddress as `0x${string}`,
          network: getCDPNetworkName(),
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
          if ((tx.type === 'escrow_deposit' || tx.type === 'simplified_escrow_deposit') && tx.parameters) {
            let depositTx
            
            if (tx.type === 'simplified_escrow_deposit') {
              // Prepare the new SimplifiedEscrow deposit transaction
              const { prepareSimplifiedEscrowDeposit } = await import('@/lib/simplified-escrow')
              const { amount, transferId, recipientEmail } = tx.parameters
              
              depositTx = prepareSimplifiedEscrowDeposit({
                transferId,
                recipientEmail,
                amount
              })
            } else {
              // This should not happen - only SimplifiedEscrow is supported
              throw new Error('Legacy escrow deposit is no longer supported')
            }
            
            console.log('🔐 CDP ESCROW DEPOSIT SIGNING:', {
              type: tx.type === 'simplified_escrow_deposit' ? 'SimplifiedEscrow Deposit' : 'Legacy Escrow Deposit',
              transaction: depositTx,
              evmAccount: evmAddress,
              network: getCDPNetworkName(),
              step: `${i + 1}/${transactions.length}`,
              timestamp: new Date().toISOString()
            })
            
            const txResult = await sendEvmTransaction({
              transaction: depositTx,
              evmAccount: evmAddress as `0x${string}`,
              network: getCDPNetworkName(),
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
              network: getCDPNetworkName(),
              step: `${i + 1}/${transactions.length}`,
              description: tx.description,
              timestamp: new Date().toISOString()
            })
            
            const txResult = await sendEvmTransaction({
              transaction,
              evmAccount: evmAddress as `0x${string}`,
              network: getCDPNetworkName(),
            })
            
            console.log('✅ CDP APPROVAL RESULT:', {
              transactionHash: txResult.transactionHash,
              step: `${i + 1}/${transactions.length}`,
              timestamp: new Date().toISOString()
            })
            
            // If this is an approval transaction and there are more transactions, wait for confirmation
            if (tx.description?.includes('Approve') && i < transactions.length - 1) {
              setCurrentStep('Waiting for approval confirmation...')
              console.log('⏳ Waiting for approval transaction to be confirmed before proceeding...')
              
              // Wait 2.5 seconds for the approval to be confirmed on-chain
              await new Promise(resolve => setTimeout(resolve, 2500))
            }
            
            // Store the final transaction hash (deposit transaction)
            if (i === transactions.length - 1) {
              finalTxHash = txResult.transactionHash
            }
          }
        }
        
        // Update the transfer status in database
        if (finalTxHash && result.transfer?.transferId) {
          const accessTokenForUpdate = await getAccessToken()
          await fetch('/api/send', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessTokenForUpdate}`,
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
          
          const accessTokenForComplete = await getAccessToken()
          await fetch('/api/send/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessTokenForComplete}`,
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


      {/* Smart Account Toggle */}
      {hasSmartAccount && (
        <div className="bg-[#2A2A2A] rounded-xl p-4 border border-[#4A4A4A]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-[#5CB0FF]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#5CB0FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">Smart Account</div>
                <div className="text-sm text-[#B8B8B8]">
                  {gasSponsoringStatus.available ? 'Gas-free transactions' : 'Enhanced features'}
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useSmartAccountMode}
                onChange={(e) => setUseSmartAccountMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#5CB0FF]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5CB0FF]"></div>
            </label>
          </div>
        </div>
      )}

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

      {/* Smart Account Status */}
      {useSmartAccountMode && hasSmartAccount && (
        <div className={`rounded-xl p-4 border ${
          gasSponsoringStatus.available
            ? 'bg-[#2A4A2A] border-[#4A6B4A]'
            : 'bg-[#4A2A2A] border-[#6B3B3B]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                gasSponsoringStatus.available ? 'bg-[#4CAF50]' : 'bg-[#F44336]'
              }`}>
                {gasSponsoringStatus.available ? (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <div className={`font-medium ${
                  gasSponsoringStatus.available ? 'text-[#4CAF50]' : 'text-[#F44336]'
                }`}>
                  {gasSponsoringStatus.available ? 'Gas Sponsored' : 'Gas Required'}
                </div>
                <div className="text-sm text-[#B8B8B8]">
                  {gasSponsoringStatus.message}
                </div>
              </div>
            </div>

            {paymasterEnabled && gasSponsoringStatus.available && (
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5CB0FF]"></div>
                <span className="text-xs text-[#5CB0FF] font-medium">CDP</span>
              </div>
            )}
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
            useSmartAccountMode && hasSmartAccount && gasSponsoringStatus.available ? 'Send (Gas-Free)' : 'Confirm'
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
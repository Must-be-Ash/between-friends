"use client";

import { useState } from 'react'
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

interface SendConfirmationProps {
  transferData: TransferData
  currentUser: any // CDP User object
  evmAddress: string
  onSuccess: (txHash: string) => void
  onBack: () => void
}

export function SendConfirmation({ transferData, currentUser, evmAddress, onSuccess, onBack }: SendConfirmationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { recipient, amount } = transferData
  const isDirect = recipient.transferType === 'direct'

  const handleConfirmSend = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setError(null)

    try {
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
      
      // Call onSuccess with the transaction hash
      onSuccess(result.txHash || result.transactionId)
      
    } catch (error) {
      console.error('Transfer error:', error)
      setError(error instanceof Error ? error.message : 'Failed to process transfer')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Final Confirmation Card */}
      <div className="card">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isDirect ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            {isDirect ? (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Confirm Your Transfer
          </h3>
          
          <p className="text-gray-600">
            {isDirect 
              ? 'Ready to send money instantly'
              : 'Ready to send money via email'
            }
          </p>
        </div>

        {/* Transfer Details */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Sending</span>
            <span className="text-xl font-bold text-gray-900">
              {formatUSDCWithSymbol(amount)}
            </span>
          </div>
          
          <div className="flex justify-between items-start">
            <span className="text-gray-600">To</span>
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {recipient.displayName || recipient.email}
              </div>
              {recipient.displayName && (
                <div className="text-sm text-gray-500">{recipient.email}</div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Method</span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isDirect 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isDirect ? 'Instant Transfer' : 'Email Claim'}
            </span>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Secure Transaction</h4>
            <p className="text-blue-800 text-sm">
              This transaction is secured by blockchain technology and cannot be reversed once confirmed.
              {!isDirect && ' Funds will be held safely in escrow until the recipient claims them.'}
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-red-900 mb-1">Transaction Failed</h4>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 py-4 px-6 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        
        <button
          onClick={handleConfirmSend}
          disabled={isProcessing}
          className={`flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
            isDirect
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isDirect ? 'Sending...' : 'Processing...'}
            </div>
          ) : (
            `Confirm ${isDirect ? 'Instant Transfer' : 'Email Transfer'}`
          )}
        </button>
      </div>

      {/* Processing status */}
      {isProcessing && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {isDirect 
              ? 'Processing your instant transfer...'
              : 'Setting up escrow and sending email notification...'
            }
          </p>
        </div>
      )}
    </div>
  )
}
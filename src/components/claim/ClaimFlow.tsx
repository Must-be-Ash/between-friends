"use client";

import { useState } from 'react'
import { useSendEvmTransaction } from '@coinbase/cdp-hooks'
import { prepareEscrowClaim } from '@/lib/escrow'
import { formatUSDCWithSymbol, formatTimeAgo } from '@/lib/utils'
import { Address } from 'viem'

interface ClaimFlowProps {
  transferData: any
  currentUser: any
  evmAddress: Address | undefined
}

export function ClaimFlow({ transferData, currentUser, evmAddress }: ClaimFlowProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [claimComplete, setClaimComplete] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState('')

  const sendEvmTransaction = useSendEvmTransaction()

  const handleClaim = async () => {
    if (!evmAddress || !currentUser) return

    setIsProcessing(true)
    setError('')

    try {
      // Get claim signature from backend API
      const claimResponse = await fetch('/api/claim/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId: transferData.transferId,
          recipientEmail: currentUser.email || transferData.recipientEmail,
          recipientAddress: evmAddress,
        }),
      })

      if (!claimResponse.ok) {
        const errorData = await claimResponse.json()
        throw new Error(errorData.error || 'Failed to prepare claim')
      }

      const { deadline, signature } = await claimResponse.json()

      // Prepare escrow claim transaction
      const transaction = await prepareEscrowClaim(
        transferData.transferId,
        evmAddress,
        deadline,
        signature
      )

      // Execute transaction via CDP
      const result = await sendEvmTransaction({
        transaction,
        evmAccount: evmAddress,
        network: 'base-sepolia', // or 'base' for mainnet
      })

      setTxHash(result.transactionHash)

      // Update transfer status in database
      await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId: transferData.transferId,
          txHash: result.transactionHash,
          recipientEmail: currentUser.email,
          recipientAddress: evmAddress,
        }),
      })

      setClaimComplete(true)
    } catch (error) {
      console.error('Claim error:', error)
      setError(error instanceof Error ? error.message : 'Failed to claim funds')
    } finally {
      setIsProcessing(false)
    }
  }

  if (claimComplete && txHash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Funds Claimed Successfully!</h2>
            <p className="text-gray-600 mb-6">
              {formatUSDCWithSymbol(transferData.amount)} has been transferred to your wallet.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Transaction Hash</p>
              <p className="text-sm font-mono text-gray-800 break-all">
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full py-3"
              >
                View on Block Explorer
              </a>
              
              <a
                href="/"
                className="btn-primary w-full py-3"
              >
                Go to Dashboard
              </a>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Welcome to Between Friends! Your secure wallet is ready to use.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary-900 mb-2">Claim Your USDC</h1>
          <p className="text-primary-600">
            Someone sent you money! Review the details and claim your funds.
          </p>
        </div>

        <div className="card">
          {/* Transfer Details */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg p-6 mb-6">
            <div className="text-center">
              <p className="text-primary-100 mb-1">You're receiving</p>
              <p className="text-3xl font-bold mb-2">{formatUSDCWithSymbol(transferData.amount)}</p>
              <p className="text-primary-200">
                From: {transferData.senderDisplayName || transferData.senderEmail}
              </p>
            </div>
          </div>

          {/* Transfer Info */}
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Sent</p>
              <p className="text-gray-900">{formatTimeAgo(new Date(transferData.createdAt))}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Expires</p>
              <p className="text-gray-900">{new Date(transferData.expiryDate).toLocaleDateString()}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Your wallet</p>
              <p className="text-gray-900 font-mono text-sm">
                {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : 'Loading...'}
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Claim Button */}
          <button
            onClick={handleClaim}
            disabled={isProcessing || !evmAddress}
            className="btn-primary w-full py-4"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#B8B8B8] border-t-transparent rounded-full animate-spin mr-2"></div>
                Claiming funds...
              </div>
            ) : (
              `Claim ${formatUSDCWithSymbol(transferData.amount)}`
            )}
          </button>

          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              By claiming, you acknowledge that the funds will be transferred to your wallet address shown above.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Secured by Coinbase Developer Platform
          </p>
        </div>
      </div>
    </div>
  )
}
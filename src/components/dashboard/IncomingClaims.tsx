"use client";

import { useState, useEffect } from 'react'
import { formatUSDCWithSymbol, formatRelativeTime } from '@/lib/utils'

interface IncomingClaim {
  transferId: string
  amount: string
  senderEmail: string
  expiryDate: Date
  createdAt: Date
  status: 'pending'
  claimToken: string
}

interface IncomingClaimsProps {
  userId: string
}

export function IncomingClaims({ userId }: IncomingClaimsProps) {
  const [incomingClaims, setIncomingClaims] = useState<IncomingClaim[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  useEffect(() => {
    fetchIncomingClaims()
  }, [userId])

  const fetchIncomingClaims = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/incoming-claims?userId=${encodeURIComponent(userId)}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch incoming claims')
      }
      
      const data = await response.json()
      setIncomingClaims(data.claims || [])
    } catch (error) {
      console.error('Error fetching incoming claims:', error)
      setError('Failed to load incoming claims')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClaim = async (transferId: string, claimToken: string) => {
    setClaimingId(transferId)
    
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId,
          claimToken,
          userId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to claim transfer')
      }

      // Refresh the list after successful claim
      fetchIncomingClaims()
      
      // TODO: Show success toast
      
    } catch (error) {
      console.error('Error claiming transfer:', error)
      // TODO: Show error toast
    } finally {
      setClaimingId(null)
    }
  }

  const getDaysRemaining = (expiryDate: Date) => {
    const now = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const getExpiryText = (expiryDate: Date) => {
    const daysRemaining = getDaysRemaining(expiryDate)
    
    if (daysRemaining === 0) {
      return { text: 'Expires today', color: 'text-red-600' }
    } else if (daysRemaining === 1) {
      return { text: 'Expires tomorrow', color: 'text-orange-600' }
    } else if (daysRemaining <= 3) {
      return { text: `Expires in ${daysRemaining} days`, color: 'text-orange-600' }
    } else {
      return { text: `Expires in ${daysRemaining} days`, color: 'text-gray-600' }
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Money to Claim</h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Money to Claim</h3>
        <div className="text-center py-6">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-3 text-sm">{error}</p>
          <button
            onClick={fetchIncomingClaims}
            className="btn-primary text-sm px-3 py-1"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (incomingClaims.length === 0) {
    return null // Don't show the section if there are no incoming claims
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Money to Claim</h3>
        <div className="flex items-center text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
          <span>{incomingClaims.length} waiting</span>
        </div>
      </div>

      <div className="space-y-3">
        {incomingClaims.map((claim) => {
          const expiryInfo = getExpiryText(claim.expiryDate)
          const isClaimingThis = claimingId === claim.transferId
          
          return (
            <div
              key={claim.transferId}
              className="border border-green-200 bg-green-50 rounded-lg p-4 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-green-900 text-xl mb-1">
                    {formatUSDCWithSymbol(claim.amount)}
                  </p>
                  <p className="text-sm text-green-700">
                    from {claim.senderEmail}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Sent {formatRelativeTime(new Date(claim.createdAt))}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${expiryInfo.color}`}>
                    {expiryInfo.text}
                  </p>
                </div>
              </div>

              {/* Claim Button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleClaim(claim.transferId, claim.claimToken)}
                  disabled={isClaimingThis}
                  className={`py-2 px-4 rounded-lg font-semibold transition-all ${
                    isClaimingThis
                      ? 'bg-green-400 text-green-100 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                  }`}
                >
                  {isClaimingThis ? (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Claiming...
                    </div>
                  ) : (
                    `Claim ${formatUSDCWithSymbol(claim.amount)}`
                  )}
                </button>

                {/* Progress bar showing time remaining */}
                <div className="flex-1 ml-4">
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        getDaysRemaining(claim.expiryDate) <= 1 
                          ? 'bg-red-500' 
                          : getDaysRemaining(claim.expiryDate) <= 3 
                          ? 'bg-orange-500' 
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.max(10, (getDaysRemaining(claim.expiryDate) / 7) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-800">
              These transfers were sent to you and are ready to claim. Click "Claim" to receive the USDC in your wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
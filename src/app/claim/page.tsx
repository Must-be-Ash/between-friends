"use client";

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useIsInitialized, useIsSignedIn, useCurrentUser, useEvmAddress } from '@coinbase/cdp-hooks'
import { AuthPage } from '@/components/auth/AuthPage'
import { ClaimFlow } from '@/components/claim/ClaimFlow'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

function ClaimPageContent() {
  const searchParams = useSearchParams()
  const isInitialized = useIsInitialized()
  const isSignedIn = useIsSignedIn()
  const currentUser = useCurrentUser()
  const evmAddress = useEvmAddress()
  
  interface TransferData {
    transferId: string
    senderEmail: string
    senderDisplayName?: string
    amount: string
    status: string
    recipientEmail: string
    expiryDate: string
    createdAt: string
  }
  
  const [transferData, setTransferData] = useState<TransferData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Get claim parameters from URL
  const transferId = searchParams.get('id')
  const token = searchParams.get('token')

  const fetchTransferDetails = useCallback(async () => {
    if (!transferId || !token) return

    try {
      const response = await fetch(`/api/claim/details?id=${transferId}&token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transfer details')
      }

      setTransferData(data.transfer)
    } catch (error) {
      console.error('Error fetching transfer details:', error)
      setError(error instanceof Error ? error.message : 'Failed to load claim details')
    } finally {
      setIsLoading(false)
    }
  }, [transferId, token])

  useEffect(() => {
    if (!transferId || !token) {
      setError('Invalid claim link')
      setIsLoading(false)
      return
    }

    // Fetch transfer details
    fetchTransferDetails()
  }, [transferId, token, fetchTransferDetails])

  // Show loading while CDP initializes or data loads
  if (!isInitialized || isLoading) {
    return <LoadingScreen message="Loading claim details..." />
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Claim Link Invalid</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              The link may have expired or been used already.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show authentication if not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="p-4">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-primary-900 mb-2">You&apos;ve got money!</h1>
              <p className="text-primary-600">
                Someone sent you USDC. Sign in to claim your funds.
              </p>
            </div>
          </div>
        </div>
        <AuthPage />
      </div>
    )
  }

  // Show claim flow for authenticated users
  return (
    <ClaimFlow 
      transferData={transferData}
      currentUser={currentUser}
      evmAddress={evmAddress || undefined}
    />
  )
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading..." />}>
      <ClaimPageContent />
    </Suspense>
  )
}
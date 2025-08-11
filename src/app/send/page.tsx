"use client";

// Force dynamic rendering for this page to avoid SSR issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsSignedIn, useEvmAddress, useCurrentUser } from '@coinbase/cdp-hooks'
import { getUSDCBalance } from '@/lib/usdc'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { RecipientInput } from '@/components/send/RecipientInput'
import { AmountInput } from '@/components/send/AmountInput'
import { TransferPreview } from '@/components/send/TransferPreview'
import { SendConfirmation } from '@/components/send/SendConfirmation'
import { SendSuccess } from '@/components/send/SendSuccess'

type SendStep = 'input' | 'preview' | 'confirm' | 'success'

interface RecipientInfo {
  email: string
  exists: boolean
  displayName?: string
  transferType: 'direct' | 'escrow'
}

interface TransferData {
  recipient: RecipientInfo
  amount: string
  transactionData?: any
}

export default function SendPage() {
  const router = useRouter()
  const isSignedIn = useIsSignedIn()
  const currentUser = useCurrentUser()
  const evmAddress = useEvmAddress()
  
  const [currentStep, setCurrentStep] = useState<SendStep>('input')
  const [balance, setBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [transferData, setTransferData] = useState<TransferData | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Redirect if not signed in
  if (!isSignedIn) {
    router.push('/')
    return <LoadingScreen message="Redirecting..." />
  }

  // Fetch balance on load
  useEffect(() => {
    if (evmAddress) {
      fetchBalance()
    }
  }, [evmAddress])

  const fetchBalance = async () => {
    if (!evmAddress) return
    
    setIsLoadingBalance(true)
    try {
      const usdcBalance = await getUSDCBalance(evmAddress)
      setBalance(usdcBalance)
    } catch (error) {
      console.error('Error fetching balance:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const handleRecipientAndAmountSubmit = (recipient: RecipientInfo, amount: string) => {
    setTransferData({ recipient, amount })
    setCurrentStep('preview')
  }

  const handlePreviewConfirm = () => {
    setCurrentStep('confirm')
  }

  const handleTransactionSuccess = (hash: string) => {
    setTxHash(hash)
    setCurrentStep('success')
  }

  const handleStartOver = () => {
    setTransferData(null)
    setTxHash(null)
    setCurrentStep('input')
    fetchBalance() // Refresh balance
  }

  const handleGoToDashboard = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 safe-area-inset">
        <div className="px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => {
                if (currentStep === 'input') {
                  router.back()
                } else if (currentStep === 'preview') {
                  setCurrentStep('input')
                } else if (currentStep === 'confirm') {
                  setCurrentStep('preview')
                }
              }}
              className="p-2 -ml-2 mr-3 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentStep === 'input' && 'Send Money'}
                {currentStep === 'preview' && 'Review Transfer'}
                {currentStep === 'confirm' && 'Confirm Transfer'}
                {currentStep === 'success' && 'Transfer Complete'}
              </h1>
              {currentStep === 'input' && (
                <p className="text-sm text-gray-600">
                  Balance: ${balance} USDC {isLoadingBalance && '(loading...)'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {currentStep === 'input' && (
          <div className="space-y-6">
            <RecipientInput
              onSubmit={(recipient, amount) => handleRecipientAndAmountSubmit(recipient, amount)}
              userBalance={balance}
              isLoadingBalance={isLoadingBalance}
            />
          </div>
        )}

        {currentStep === 'preview' && transferData && (
          <TransferPreview
            transferData={transferData}
            onConfirm={handlePreviewConfirm}
            onBack={() => setCurrentStep('input')}
          />
        )}

        {currentStep === 'confirm' && transferData && currentUser && evmAddress && (
          <SendConfirmation
            transferData={transferData}
            currentUser={currentUser}
            evmAddress={evmAddress}
            onSuccess={handleTransactionSuccess}
            onBack={() => setCurrentStep('preview')}
          />
        )}

        {currentStep === 'success' && transferData && txHash && (
          <SendSuccess
            transferData={transferData}
            txHash={txHash}
            onSendAnother={handleStartOver}
            onGoToDashboard={handleGoToDashboard}
          />
        )}
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-20"></div>
    </div>
  )
}
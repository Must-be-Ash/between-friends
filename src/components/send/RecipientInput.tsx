"use client";

import { useState, useEffect } from 'react'
import { isValidEmail, formatUSDCWithSymbol, parseUSDCAmount } from '@/lib/utils'
import { AmountInput } from './AmountInput'

interface RecipientInfo {
  email: string
  exists: boolean
  displayName?: string
  transferType: 'direct' | 'escrow'
}

interface RecipientInputProps {
  onSubmit: (recipient: RecipientInfo, amount: string) => void
  userBalance: string
  isLoadingBalance: boolean
}

export function RecipientInput({ onSubmit, userBalance, isLoadingBalance }: RecipientInputProps) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [showAmountInput, setShowAmountInput] = useState(false)

  // Validate email as user types
  useEffect(() => {
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address')
    } else {
      setEmailError('')
    }
  }, [email])

  // Validate amount as user types
  useEffect(() => {
    if (amount) {
      const numAmount = parseUSDCAmount(amount)
      const numBalance = parseFloat(userBalance)
      
      if (numAmount <= 0) {
        setAmountError('Amount must be greater than $0')
      } else if (numAmount > numBalance) {
        setAmountError('Amount exceeds your balance')
      } else {
        setAmountError('')
      }
    }
  }, [amount, userBalance])

  const handleEmailLookup = async () => {
    if (!email || !isValidEmail(email) || isLookingUp) return

    setIsLookingUp(true)
    setLookupError('')
    setRecipient(null)

    try {
      const response = await fetch(`/api/recipients/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        throw new Error('Failed to lookup recipient')
      }

      const { recipient: recipientInfo } = await response.json()
      setRecipient(recipientInfo)
      setShowAmountInput(true)
    } catch (error) {
      console.error('Recipient lookup error:', error)
      setLookupError('Failed to lookup recipient. Please try again.')
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleSubmit = () => {
    if (!recipient || !amount || emailError || amountError) return

    onSubmit(recipient, amount)
  }

  const canLookup = email && isValidEmail(email) && !isLookingUp
  const canSubmit = recipient && amount && !emailError && !amountError && !isLoadingBalance

  return (
    <div className="space-y-6">
      {/* Recipient Email Input */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Send to</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Email Address
            </label>
            <div className="flex space-x-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter recipient's email address"
                className={`input flex-1 ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canLookup) {
                    handleEmailLookup()
                  }
                }}
              />
              <button
                onClick={handleEmailLookup}
                disabled={!canLookup}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  canLookup
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLookingUp ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  'Lookup'
                )}
              </button>
            </div>
            {emailError && (
              <p className="text-red-600 text-sm mt-1">{emailError}</p>
            )}
            {lookupError && (
              <p className="text-red-600 text-sm mt-1">{lookupError}</p>
            )}
          </div>

          {/* Recipient Status */}
          {recipient && (
            <div className={`p-4 rounded-lg border-2 ${
              recipient.exists 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  recipient.exists ? 'bg-green-500' : 'bg-yellow-500'
                }`}>
                  {recipient.exists ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`font-medium ${
                    recipient.exists ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {recipient.exists ? 'Existing Between Friends User' : 'New User'}
                  </p>
                  <p className={`text-sm ${
                    recipient.exists ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {recipient.exists 
                      ? `${recipient.displayName ? `${recipient.displayName} (${recipient.email})` : recipient.email} - Instant transfer`
                      : `${recipient.email} will receive an email to claim funds`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Amount Input */}
      {showAmountInput && (
        <div className="card">
          <AmountInput
            amount={amount}
            onAmountChange={setAmount}
            userBalance={userBalance}
            isLoadingBalance={isLoadingBalance}
            error={amountError}
          />
        </div>
      )}

      {/* Continue Button */}
      {showAmountInput && (
        <div className="card bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              canSubmit
                ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-98'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {recipient?.exists ? 'Send Instantly' : 'Send via Email'}
          </button>
          
          {recipient && (
            <p className="text-center text-sm text-gray-600 mt-3">
              {recipient.exists 
                ? `${formatUSDCWithSymbol(amount)} will be sent directly to ${recipient.displayName || recipient.email}`
                : `${formatUSDCWithSymbol(amount)} will be held securely until ${recipient.email} claims it`
              }
            </p>
          )}
        </div>
      )}
    </div>
  )
}
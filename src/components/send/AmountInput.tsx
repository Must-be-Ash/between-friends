"use client";

import { useState, useEffect } from 'react'
import { formatUSDCWithSymbol, parseUSDCAmount } from '@/lib/utils'

interface AmountInputProps {
  amount: string
  onAmountChange: (amount: string) => void
  userBalance: string
  isLoadingBalance: boolean
  error?: string
}

export function AmountInput({ amount, onAmountChange, userBalance, isLoadingBalance, error }: AmountInputProps) {
  const [focused, setFocused] = useState(false)

  const handleAmountChange = (value: string) => {
    // Allow empty string
    if (value === '') {
      onAmountChange('')
      return
    }

    // Only allow numbers and single decimal point
    const regex = /^\d*\.?\d{0,6}$/
    if (regex.test(value)) {
      onAmountChange(value)
    }
  }

  const handleQuickAmount = (quickAmount: string) => {
    onAmountChange(quickAmount)
  }

  const handleMaxAmount = () => {
    const maxAmount = Math.max(0, parseFloat(userBalance) - 0.01) // Leave small buffer for gas
    onAmountChange(maxAmount.toFixed(2))
  }

  const numAmount = parseUSDCAmount(amount)
  const numBalance = parseFloat(userBalance)
  const isValidAmount = numAmount > 0 && numAmount <= numBalance

  // Quick amount suggestions
  const quickAmounts = ['5', '10', '25', '50']

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount to Send
        </label>
        
        {/* Main amount input */}
        <div className={`relative border-2 rounded-xl transition-colors ${
          focused 
            ? 'border-primary-500 ring-2 ring-primary-100' 
            : error 
              ? 'border-red-500' 
              : 'border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center px-4 py-6">
            <span className="text-2xl font-medium text-gray-500 mr-2">$</span>
            <input
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="0.00"
              className="flex-1 text-3xl font-semibold bg-transparent border-none outline-none placeholder-gray-400"
            />
            <span className="text-lg font-medium text-gray-500 ml-2">USDC</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}

        {/* Amount validation feedback */}
        {amount && !error && (
          <div className="mt-2">
            {isValidAmount ? (
              <p className="text-green-600 text-sm">
                ✓ Valid amount: {formatUSDCWithSymbol(amount)}
              </p>
            ) : numAmount > numBalance ? (
              <p className="text-red-600 text-sm">
                Amount exceeds your balance of ${userBalance} USDC
              </p>
            ) : numAmount <= 0 ? (
              <p className="text-red-600 text-sm">
                Amount must be greater than $0
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Balance display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Available balance: {isLoadingBalance ? (
            <span className="inline-flex items-center">
              <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loading...
            </span>
          ) : (
            <span className="font-medium">${userBalance} USDC</span>
          )}
        </span>
        
        {!isLoadingBalance && parseFloat(userBalance) > 0 && (
          <button
            onClick={handleMaxAmount}
            className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Use Max
          </button>
        )}
      </div>

      {/* Quick amount buttons */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Quick amounts:</p>
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => handleQuickAmount(quickAmount)}
              disabled={parseFloat(quickAmount) > numBalance}
              className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                parseFloat(quickAmount) > numBalance
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : amount === quickAmount
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ${quickAmount}
            </button>
          ))}
        </div>
      </div>

      {/* Low balance warning */}
      {!isLoadingBalance && parseFloat(userBalance) < 1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-yellow-800 font-medium text-sm">Low Balance</p>
              <p className="text-yellow-700 text-sm mt-1">
                Consider topping up your wallet to send larger amounts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zero balance message */}
      {!isLoadingBalance && parseFloat(userBalance) === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-blue-800 font-medium text-sm">No Balance</p>
              <p className="text-blue-700 text-sm mt-1">
                You need to add USDC to your wallet before sending money.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
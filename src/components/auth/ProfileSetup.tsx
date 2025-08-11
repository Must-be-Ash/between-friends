"use client";

import { useState } from 'react'
import { useEvmAddress } from '@coinbase/cdp-hooks'
import { getDisplayNameFromEmail } from '@/lib/utils'

interface ProfileSetupProps {
  user: any // CDP user object
  email: string
  onComplete: () => void
}

export function ProfileSetup({ user, email, onComplete }: ProfileSetupProps) {
  const [displayName, setDisplayName] = useState(getDisplayNameFromEmail(email))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const evmAddress = useEvmAddress()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters')
      return
    }

    setIsLoading(true)
    
    try {
      // Create user profile in our database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          email: email.toLowerCase(),
          walletAddress: evmAddress,
          displayName: displayName.trim(),
          profileSetupComplete: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create profile')
      }

      onComplete()
    } catch (error) {
      console.error('Profile setup failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to create profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Between Friends!</h2>
        <p className="text-gray-600 mb-4">
          Your secure wallet has been created. Let's set up your profile.
        </p>
      </div>

      {/* Wallet Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Wallet Created Successfully</h3>
            <p className="text-sm text-green-700">
              Address: {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : 'Loading...'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should others see your name?"
          disabled={isLoading}
          className={`input w-full ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
          maxLength={50}
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          This is how your name will appear to others when you send money.
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || !displayName.trim()}
        className="btn-primary w-full py-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Setting up your profile...
          </div>
        ) : (
          'Complete Setup'
        )}
      </button>

      <div className="text-xs text-gray-500 text-center">
        Your wallet is secured by Coinbase Developer Platform.<br />
        You maintain full custody of your assets.
      </div>
    </form>
  )
}
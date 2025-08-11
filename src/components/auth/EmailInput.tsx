"use client";

import { useState } from 'react'
import { isValidEmail } from '@/lib/utils'

interface EmailInputProps {
  onSubmit: (email: string) => void
  disabled?: boolean
}

export function EmailInput({ onSubmit, disabled }: EmailInputProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    onSubmit(email.toLowerCase().trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome!</h2>
        <p className="text-gray-600 mb-4">
          Enter your email to get started. We'll create a secure wallet for you instantly.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={disabled}
          className={`input w-full ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
          autoComplete="email"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !email.trim()}
        className="btn-primary w-full py-4"
      >
        {disabled ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Sending code...
          </div>
        ) : (
          'Continue with Email'
        )}
      </button>

      <div className="text-xs text-gray-500 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </form>
  )
}
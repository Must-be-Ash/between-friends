"use client";

import { useState, useRef, useEffect } from 'react'

interface OTPInputProps {
  email: string
  onSubmit: (otp: string) => void
  onBack: () => void
  disabled?: boolean
}

export function OTPInput({ email, onSubmit, onBack, disabled }: OTPInputProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value !== '' && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')

    // Auto-focus next input
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all fields are filled
    if (value !== '' && index === 5 && newOtp.every(digit => digit !== '')) {
      const otpCode = newOtp.join('')
      onSubmit(otpCode)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      // Move to previous input on backspace
      inputRefs.current[index - 1]?.focus()
    }
    
    if (e.key === 'Enter') {
      const otpCode = otp.join('')
      if (otpCode.length === 6) {
        onSubmit(otpCode)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    
    // Extract 6 digits from pasted content
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('')
    
    if (digits.length === 6) {
      setOtp(digits)
      onSubmit(digits.join(''))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join('')
    
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }
    
    onSubmit(otpCode)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-600 mb-4">
          We sent a 6-digit code to <span className="font-medium">{email}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verification code
        </label>
        <div className="flex space-x-3 justify-center" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={disabled}
              className={`w-12 h-12 text-center text-lg font-semibold border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                error ? 'border-red-300' : 'border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          ))}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="btn-secondary flex-1 py-4"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={disabled || otp.join('').length !== 6}
          className="btn-primary flex-1 py-4"
        >
          {disabled ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Verifying...
            </div>
          ) : (
            'Verify Code'
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          Didn't receive the code?{' '}
          <button
            type="button"
            onClick={onBack}
            disabled={disabled}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Try a different email
          </button>
        </p>
      </div>
    </form>
  )
}
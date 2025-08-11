"use client";

import { useState } from 'react'
import { useSignInWithEmail, useVerifyEmailOTP, useCurrentUser } from '@coinbase/cdp-hooks'
import { EmailInput } from './EmailInput'
import { OTPInput } from './OTPInput'
import { ProfileSetup } from './ProfileSetup'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

type AuthStep = 'email' | 'otp' | 'profile'

export function AuthPage() {
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [flowId, setFlowId] = useState<string | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const signInWithEmail = useSignInWithEmail()
  const verifyEmailOTP = useVerifyEmailOTP()
  const currentUser = useCurrentUser()

  const handleEmailSubmit = async (emailValue: string) => {
    setIsLoading(true)
    try {
      const result = await signInWithEmail({ email: emailValue })
      setEmail(emailValue)
      setFlowId(result.flowId)
      setStep('otp')
    } catch (error) {
      console.error('Email sign-in failed:', error)
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPSubmit = async (otp: string) => {
    if (!flowId) return
    
    setIsLoading(true)
    try {
      const result = await verifyEmailOTP({
        flowId,
        otp
      })
      
      setIsNewUser(result.isNewUser)
      
      // Store email for later use (needed for profile creation)
      localStorage.setItem('cdp_user_email', email)
      
      // If new user, show profile setup
      if (result.isNewUser) {
        setStep('profile')
      }
      // If existing user, auth is complete (currentUser will update)
    } catch (error) {
      console.error('OTP verification failed:', error)
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProfileComplete = () => {
    // Profile setup complete, user will be redirected to dashboard
    // via the main page logic
  }

  // Show loading overlay during async operations
  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-900 mb-2">Between Friends</h1>
          <p className="text-primary-600">Your pal shouldn't rip you off.</p>
        </div>

        <div className="card">
          {step === 'email' && (
            <EmailInput
              onSubmit={handleEmailSubmit}
              disabled={isLoading}
            />
          )}
          
          {step === 'otp' && (
            <OTPInput
              email={email}
              onSubmit={handleOTPSubmit}
              onBack={() => setStep('email')}
              disabled={isLoading}
            />
          )}
          
          {step === 'profile' && currentUser && (
            <ProfileSetup
              user={currentUser}
              email={email}
              onComplete={handleProfileComplete}
            />
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Powered by Coinbase Developer Platform
          </p>
        </div>
      </div>
    </div>
  )
}
"use client";

import { useIsInitialized, useIsSignedIn } from '@coinbase/cdp-hooks'
import { AuthPage } from '@/components/auth/AuthPage'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { useSessionEnhancer } from '@/lib/session-enhancer'

export function MainPage() {
  const { isInitialized } = useIsInitialized()
  const { isSignedIn } = useIsSignedIn()

  // Enhance session persistence for mobile browsers
  useSessionEnhancer()

  // Show loading while CDP initializes
  if (!isInitialized) {
    return <LoadingScreen message="loading..." />
  }

  // Show authentication if not signed in
  if (!isSignedIn) {
    return <AuthPage />
  }

  // Show main dashboard for authenticated users
  return <Dashboard />
}
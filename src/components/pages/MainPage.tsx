"use client";

import { useIsInitialized, useIsSignedIn } from '@coinbase/cdp-hooks'
import { AuthPage } from '@/components/auth/AuthPage'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

export function MainPage() {
  const isInitialized = useIsInitialized()
  const isSignedIn = useIsSignedIn()

  // Show loading while CDP initializes
  if (!isInitialized) {
    return <LoadingScreen message="Initializing Between Friends..." />
  }

  // Show authentication if not signed in
  if (!isSignedIn) {
    return <AuthPage />
  }

  // Show main dashboard for authenticated users
  return <Dashboard />
}
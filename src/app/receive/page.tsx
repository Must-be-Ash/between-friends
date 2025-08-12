"use client";

// Force dynamic rendering for this page to avoid SSR issues
export const dynamic = 'force-dynamic'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { SimpleReceive } from '@/components/receive/SimpleReceive'
import { NavigationDock } from '@/components/navigation/NavigationDock'
import { ArrowLeft } from 'lucide-react'

export default function ReceivePage() {
  const router = useRouter()
  const isSignedIn = useIsSignedIn()
  const evmAddress = useEvmAddress()

  // Redirect if not signed in
  if (!isSignedIn) {
    router.push('/')
    return <LoadingScreen message="Redirecting..." />
  }

  // Wait for address to load
  if (!evmAddress) {
    return <LoadingScreen message="Loading wallet..." />
  }

  return (
    <div className="min-h-screen bg-[#222222]">
      {/* Main Content with glassmorphism container */}
      <div className="px-4 pt-10 pb-6">
        <div className="max-w-md mx-auto md:backdrop-blur-xl md:bg-[#4A4A4A]/30 md:border md:border-white/20 md:rounded-3xl md:p-6 md:shadow-2xl space-y-6">
          
          {/* Back Button */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div></div>
          </div>

          <SimpleReceive address={evmAddress} />
        </div>
      </div>

      {/* Navigation Dock */}
      <NavigationDock />

      {/* Bottom spacing for mobile navigation */}
      <div className="h-32 md:h-16"></div>
    </div>
  )
}
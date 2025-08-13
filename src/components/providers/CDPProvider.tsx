"use client";

import { CDPReactProvider } from '@coinbase/cdp-react/components/CDPReactProvider'
import { CDP_CONFIG, APP_CONFIG } from '@/lib/cdp'

interface CDPProviderProps {
  children: React.ReactNode
}

export function CDPProvider({ children }: CDPProviderProps) {
  return (
    <CDPReactProvider 
      config={CDP_CONFIG} 
      app={APP_CONFIG}
    >
      {children}
    </CDPReactProvider>
  )
}
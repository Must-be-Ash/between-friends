"use client";

import { useState } from 'react'
import { Dock } from '@/components/ui/dock-two'
import { Home, Send, QrCode, History, ScanLine } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

export function NavigationDock() {
  const router = useRouter()
  const pathname = usePathname()
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  // Handle QR code button - tap for receive, long press for scan
  const handleQRCodePress = () => {
    router.push('/receive')
  }

  const handleQRCodeLongPress = () => {
    router.push('/scan')
  }

  // Handle touch events for long press detection
  const handleQRTouchStart = () => {
    const timer = setTimeout(() => {
      // Provide haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      handleQRCodeLongPress()
    }, 500) // 500ms for long press

    setLongPressTimer(timer)
  }

  const handleQRTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  // If we're on the scan page, show scan icon instead of QR code
  const isOnScanPage = pathname === '/scan'

  const navigationItems = [
    {
      icon: Home,
      label: "Dashboard",
      onClick: () => router.push('/')
    },
    {
      icon: Send,
      label: "Send Money",
      onClick: () => router.push('/send')
    },
    {
      icon: isOnScanPage ? ScanLine : QrCode,
      label: isOnScanPage ? "Scanner" : "Receive",
      onClick: isOnScanPage ? () => router.push('/scan') : handleQRCodePress,
      onTouchStart: isOnScanPage ? undefined : handleQRTouchStart,
      onTouchEnd: isOnScanPage ? undefined : handleQRTouchEnd,
      onMouseDown: isOnScanPage ? undefined : handleQRTouchStart,
      onMouseUp: isOnScanPage ? undefined : handleQRTouchEnd,
      onMouseLeave: isOnScanPage ? undefined : handleQRTouchEnd,
      longPressHint: isOnScanPage ? undefined : "Long press to scan QR codes"
    },
    {
      icon: History,
      label: "History",
      onClick: () => router.push('/history')
    }
  ]

  return <Dock items={navigationItems} />
}
"use client";

import { useState, useEffect, useRef } from 'react'
import { useCurrentUser, useEvmAddress, useSignOut } from '@coinbase/cdp-hooks'
import { getUSDCBalance } from '@/lib/usdc'
import { BalanceCard } from './BalanceCard'
import { AccountInfo } from './AccountInfo'
import { QuickActions } from './QuickActions'
import { RecentTransactions } from './RecentTransactions'
import { PendingClaims } from './PendingClaims'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

export function Dashboard() {
  const currentUser = useCurrentUser()
  const evmAddress = useEvmAddress()
  const signOut = useSignOut()
  
  const [balance, setBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch user profile and balance
  useEffect(() => {
    if (currentUser && evmAddress) {
      fetchUserProfile()
      fetchBalance()
    }
  }, [currentUser, evmAddress])

  // Click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLogoutMenu(false)
      }
    }

    if (showLogoutMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLogoutMenu])

  const createUserProfile = async (email: string) => {
    if (!currentUser || !evmAddress) return

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.userId,
          email: email.toLowerCase(),
          walletAddress: evmAddress,
          displayName: email.split('@')[0], // Use email prefix as default display name
          profileSetupComplete: true,
        }),
      })

      if (response.ok) {
        const { user } = await response.json()
        setUserProfile(user)
        console.log('Auto-created user profile for existing CDP user')
      } else {
        console.error('Failed to create user profile')
      }
    } catch (error) {
      console.error('Error creating user profile:', error)
    }
  }

  const fetchUserProfile = async () => {
    if (!currentUser) return

    try {
      // Use userId instead of email to fetch user profile
      const response = await fetch(`/api/users?userId=${encodeURIComponent(currentUser.userId)}`)
      if (response.ok) {
        const { user } = await response.json()
        setUserProfile(user)
      } else if (response.status === 404) {
        // User exists in CDP but not in our database
        // This can happen for existing CDP users
        console.log('User not found in our database, creating profile...')
        
        // Try to get email from localStorage (stored during auth)
        const storedEmail = localStorage.getItem('cdp_user_email')
        
        if (storedEmail && evmAddress) {
          // Auto-create profile for existing CDP user
          await createUserProfile(storedEmail)
        } else {
          // Fallback: set placeholder profile
          setUserProfile({
            userId: currentUser.userId,
            email: storedEmail || 'Unknown',
            displayName: 'User',
            profileSetupComplete: false
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchBalance = async () => {
    if (!evmAddress) return

    setIsLoadingBalance(true)
    try {
      const usdcBalance = await getUSDCBalance(evmAddress)
      setBalance(usdcBalance)
    } catch (error) {
      console.error('Error fetching balance:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const refreshBalance = () => {
    fetchBalance()
  }

  const handleLogout = async () => {
    try {
      await signOut()
      // Clean up stored email
      localStorage.removeItem('cdp_user_email')
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setShowLogoutMenu(false)
    }
  }

  if (!currentUser || !evmAddress) {
    return <LoadingScreen message="Loading dashboard..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with safe area */}
      <div className="bg-white border-b border-gray-200 safe-area-inset">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Between Friends</h1>
              <p className="text-gray-600">Welcome back, {userProfile?.displayName || 'User'}!</p>
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center hover:bg-primary-200 transition-colors"
                aria-label="User menu"
              >
                <span className="text-primary-700 font-semibold">
                  {(userProfile?.displayName || currentUser.userId || 'U').charAt(0).toUpperCase()}
                </span>
              </button>

              {/* Logout Menu */}
              {showLogoutMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{userProfile?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser.userId}</p>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Balance Card */}
        <BalanceCard 
          balance={balance}
          isLoading={isLoadingBalance}
          onRefresh={refreshBalance}
        />

        {/* Account Info */}
        <AccountInfo 
          user={userProfile}
          walletAddress={evmAddress}
        />

        {/* Pending Claims (if any) */}
        <PendingClaims userId={currentUser.userId} />

        {/* Quick Actions */}
        <QuickActions />

        {/* Recent Transactions */}
        <RecentTransactions userId={currentUser.userId} />
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-20"></div>
    </div>
  )
}
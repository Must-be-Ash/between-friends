"use client";

import { useState, useEffect, useRef } from 'react'
import { useCurrentUser, useEvmAddress, useSignOut } from '@coinbase/cdp-hooks'
import { getUSDCBalance } from '@/lib/usdc'
import { BalanceCard } from './BalanceCard'
import { AccountInfoWithAvatar } from '@/components/dashboard/AccountInfoWithAvatar'
import { NavigationDock } from '@/components/navigation/NavigationDock'
import { QuickActions } from './QuickActions'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { ClaimOnboarding } from '@/components/onboarding/ClaimOnboarding'

export function Dashboard() {
  const currentUser = useCurrentUser()
  const evmAddress = useEvmAddress()
  const signOut = useSignOut()
  
  const [balance, setBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [pendingClaims, setPendingClaims] = useState<any[]>([])
  const [showClaimOnboarding, setShowClaimOnboarding] = useState(false)
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
        const { user, pendingClaims: claims } = await response.json()
        setUserProfile(user)
        
        // If new user has pending claims, show onboarding flow
        if (claims && claims.length > 0) {
          setPendingClaims(claims)
          setShowClaimOnboarding(true)
        }
        
        console.log('Auto-created user profile for existing CDP user', claims ? `with ${claims.length} pending claims` : '')
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

  // Show claim onboarding for new users with pending transfers
  if (showClaimOnboarding && pendingClaims.length > 0 && userProfile && currentUser && evmAddress) {
    return (
      <ClaimOnboarding
        pendingClaims={pendingClaims}
        userEmail={userProfile.email}
        walletAddress={evmAddress}
        userId={currentUser.userId}
        onComplete={() => {
          setShowClaimOnboarding(false)
          setPendingClaims([])
          // Refresh balance after claims
          fetchBalance()
        }}
      />
    )
  }

  if (!currentUser || !evmAddress) {
    return <LoadingScreen message="Loading dashboard..." />
  }

  return (
    <div className="min-h-screen bg-[#222222]">
      {/* Main Content with glassmorphism container */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto md:backdrop-blur-xl md:bg-[#4A4A4A]/30 md:border md:border-white/20 md:rounded-3xl md:p-6 md:shadow-2xl space-y-6">
          {/* Balance Card */}
          <BalanceCard 
            balance={balance}
            isLoading={isLoadingBalance}
            onRefresh={refreshBalance}
          />

          {/* Quick Actions */}
          <QuickActions />

          {/* Account Info with Avatar */}
          <AccountInfoWithAvatar 
            user={userProfile}
            walletAddress={evmAddress}
            showLogoutMenu={showLogoutMenu}
            setShowLogoutMenu={setShowLogoutMenu}
            handleLogout={handleLogout}
            menuRef={menuRef}
            currentUser={currentUser}
          />
        </div>
      </div>

      {/* Navigation Dock */}
      <NavigationDock />

      {/* Bottom spacing for mobile navigation */}
      <div className="h-32 md:h-16"></div>
    </div>
  )
}
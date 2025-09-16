/**
 * CDP Session Enhancer for Mobile Browsers
 * Provides additional session persistence mechanisms for mobile browsers
 * where localStorage may be unreliable
 */

import { useEffect } from 'react'
import { useIsSignedIn, useCurrentUser, useGetAccessToken } from '@coinbase/cdp-hooks'
import { setStorageItem, getStorageItem } from './storage'

// Session backup key
const SESSION_BACKUP_KEY = 'cdp_session_backup'

/**
 * Hook that enhances CDP session persistence for mobile browsers
 * This provides additional fallbacks when localStorage is unreliable
 */
export function useSessionEnhancer() {
  const { isSignedIn } = useIsSignedIn()
  const { currentUser } = useCurrentUser()
  const { getAccessToken } = useGetAccessToken()

  // Backup session information when user signs in
  useEffect(() => {
    const backupSession = async () => {
      if (isSignedIn && currentUser) {
        try {
          // Get access token to verify session is valid
          const accessToken = await getAccessToken()

          if (accessToken) {
            // Create session backup
            const sessionBackup = {
              userId: currentUser.userId,
              evmAccounts: currentUser.evmAccounts,
              authMethods: currentUser.authenticationMethods,
              timestamp: Date.now(),
              hasValidToken: true
            }

            // Store backup in our safe storage
            setStorageItem(SESSION_BACKUP_KEY, JSON.stringify(sessionBackup))

            console.log('🔐 Session backup created for mobile persistence')
          }
        } catch (error) {
          console.warn('Failed to backup session:', error)
        }
      }
    }

    // Only backup if we have a valid session
    if (isSignedIn && currentUser) {
      backupSession()
    }
  }, [isSignedIn, currentUser, getAccessToken])

  // Clean up session backup when user signs out
  useEffect(() => {
    if (!isSignedIn) {
      try {
        // Clear session backup when user logs out
        setStorageItem(SESSION_BACKUP_KEY, '')
        console.log('🔐 Session backup cleared after logout')
      } catch (error) {
        console.warn('Failed to clear session backup:', error)
      }
    }
  }, [isSignedIn])

  return {
    // Utility to check if there's a session backup available
    hasSessionBackup: () => {
      try {
        const backup = getStorageItem(SESSION_BACKUP_KEY)
        if (!backup) return false

        const sessionData = JSON.parse(backup)
        const isRecent = Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000 // 24 hours

        return sessionData.hasValidToken && isRecent
      } catch {
        return false
      }
    },

    // Get session backup data
    getSessionBackup: () => {
      try {
        const backup = getStorageItem(SESSION_BACKUP_KEY)
        return backup ? JSON.parse(backup) : null
      } catch {
        return null
      }
    }
  }
}
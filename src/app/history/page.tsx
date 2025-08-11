"use client";

// Force dynamic rendering for this page to avoid SSR issues  
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsSignedIn, useCurrentUser } from '@coinbase/cdp-hooks'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { TransactionList } from '@/components/history/TransactionList'
import { TransactionFilters } from '@/components/history/TransactionFilters'
import { TransactionStats } from '@/components/history/TransactionStats'

interface Transaction {
  _id: string
  type: 'sent_direct' | 'sent_escrow' | 'received_direct' | 'received_claim'
  recipientEmail?: string
  senderEmail?: string
  amount: string
  txHash?: string
  transferId?: string
  status: 'confirmed' | 'pending' | 'failed' | 'claimed' | 'unclaimed'
  createdAt: string
  message?: string
}

type FilterType = 'all' | 'sent' | 'received' | 'pending'
type FilterStatus = 'all' | 'confirmed' | 'pending' | 'failed'

export default function HistoryPage() {
  const router = useRouter()
  const isSignedIn = useIsSignedIn()
  const currentUser = useCurrentUser()
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const ITEMS_PER_PAGE = 20

  // Redirect if not signed in
  if (!isSignedIn) {
    router.push('/')
    return <LoadingScreen message="Redirecting..." />
  }

  // Wait for user to load
  if (!currentUser) {
    return <LoadingScreen message="Loading user..." />
  }

  useEffect(() => {
    fetchTransactions(true)
  }, [currentUser, filterType, filterStatus, searchQuery])

  const fetchTransactions = async (reset = false) => {
    if (!currentUser?.userId) return
    
    const loadingState = reset ? setIsLoading : setIsLoadingMore
    loadingState(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: reset ? '1' : currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        type: filterType,
        status: filterStatus,
        ...(searchQuery && { search: searchQuery })
      })
      
      const response = await fetch(`/api/transactions?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      
      if (reset) {
        setTransactions(data.transactions)
        setCurrentPage(1)
      } else {
        setTransactions(prev => [...prev, ...data.transactions])
      }
      
      setHasMore(data.hasMore)
      if (!reset) {
        setCurrentPage(prev => prev + 1)
      }
      
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setError('Failed to load transactions')
    } finally {
      loadingState(false)
    }
  }

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchTransactions(false)
    }
  }

  const handleFilterChange = (type: FilterType, status: FilterStatus, search: string) => {
    setFilterType(type)
    setFilterStatus(status)
    setSearchQuery(search)
    setCurrentPage(1)
  }

  const handleRefresh = () => {
    setCurrentPage(1)
    fetchTransactions(true)
  }

  // Calculate stats from transactions
  const stats = {
    total: transactions.length,
    sent: transactions.filter(t => t.type.startsWith('sent')).length,
    received: transactions.filter(t => t.type.startsWith('received')).length,
    pending: transactions.filter(t => t.status === 'pending' || t.status === 'unclaimed').length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 safe-area-inset">
        <div className="px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 mr-3 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">Transaction History</h1>
              <p className="text-sm text-gray-600">
                Your complete USDC transfer history
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg 
                className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-4">
        <TransactionStats stats={stats} />
      </div>

      {/* Filters */}
      <div className="px-4 pb-4">
        <TransactionFilters
          currentType={filterType}
          currentStatus={filterStatus}
          currentSearch={searchQuery}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
              <p className="text-gray-600">Loading transactions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="card text-center py-8">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all' 
                ? 'No transactions match your current filters.'
                : 'You haven\'t made any USDC transfers yet.'
              }
            </p>
            {(searchQuery || filterType !== 'all' || filterStatus !== 'all') && (
              <button
                onClick={() => handleFilterChange('all', 'all', '')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors mr-3"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={() => router.push('/send')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Send Your First Payment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <TransactionList 
              transactions={transactions}
              currentUserId={currentUser.userId}
            />
            
            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Loading...
                    </div>
                  ) : (
                    'Load More Transactions'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacing for mobile navigation */}
      <div className="h-20"></div>
    </div>
  )
}
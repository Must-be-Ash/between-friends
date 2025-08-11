"use client";

import { useState } from 'react'

type FilterType = 'all' | 'sent' | 'received' | 'pending'
type FilterStatus = 'all' | 'confirmed' | 'pending' | 'failed'

interface TransactionFiltersProps {
  currentType: FilterType
  currentStatus: FilterStatus
  currentSearch: string
  onFilterChange: (type: FilterType, status: FilterStatus, search: string) => void
}

export function TransactionFilters({ 
  currentType, 
  currentStatus, 
  currentSearch, 
  onFilterChange 
}: TransactionFiltersProps) {
  const [localSearch, setLocalSearch] = useState(currentSearch)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleTypeChange = (type: FilterType) => {
    onFilterChange(type, currentStatus, currentSearch)
  }

  const handleStatusChange = (status: FilterStatus) => {
    onFilterChange(currentType, status, currentSearch)
  }

  const handleSearchSubmit = () => {
    onFilterChange(currentType, currentStatus, localSearch.trim())
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  const clearAllFilters = () => {
    setLocalSearch('')
    onFilterChange('all', 'all', '')
  }

  const hasActiveFilters = currentType !== 'all' || currentStatus !== 'all' || currentSearch.length > 0

  const typeFilters: { key: FilterType; label: string; count?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
    { key: 'pending', label: 'Pending' }
  ]

  const statusFilters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All Status' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' }
  ]

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by email, amount, or transaction ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-colors"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            onClick={handleSearchSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Type Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Filter by Type</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAdvanced ? 'Hide' : 'More'} Filters
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleTypeChange(filter.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                currentType === filter.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => handleStatusChange(filter.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      currentStatus === filter.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                Active Filters:
              </span>
              <div className="flex flex-wrap gap-1">
                {currentType !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Type: {currentType}
                  </span>
                )}
                {currentStatus !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Status: {currentStatus}
                  </span>
                )}
                {currentSearch && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Search: "{currentSearch}"
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={clearAllFilters}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Quick Filter Suggestions */}
      {!hasActiveFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Filters</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTypeChange('pending')}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              🕐 Pending Transfers
            </button>
            <button
              onClick={() => handleTypeChange('sent')}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              📤 Money Sent
            </button>
            <button
              onClick={() => handleTypeChange('received')}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              📥 Money Received
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ⚠️ Failed Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
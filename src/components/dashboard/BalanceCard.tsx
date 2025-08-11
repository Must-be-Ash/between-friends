import { formatUSDCWithSymbol } from '@/lib/utils'

interface BalanceCardProps {
  balance: string
  isLoading: boolean
  onRefresh: () => void
}

export function BalanceCard({ balance, isLoading, onRefresh }: BalanceCardProps) {
  return (
    <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-primary-100">USDC Balance</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg bg-primary-400/30 hover:bg-primary-400/50 transition-colors"
          aria-label="Refresh balance"
        >
          <svg 
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="mb-4">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-10 bg-primary-400/30 rounded-lg w-48"></div>
          </div>
        ) : (
          <p className="text-3xl font-bold mb-1">{formatUSDCWithSymbol(balance)}</p>
        )}
      </div>

      <div className="flex items-center text-primary-200 text-sm">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Secured by CDP</span>
      </div>
    </div>
  )
}
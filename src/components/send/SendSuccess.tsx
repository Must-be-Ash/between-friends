"use client";

import { formatUSDCWithSymbol, getBlockExplorerUrl } from '@/lib/utils'

interface RecipientInfo {
  email: string
  exists: boolean
  displayName?: string
  transferType: 'direct' | 'escrow'
}

interface TransferData {
  recipient: RecipientInfo
  amount: string
}

interface SendSuccessProps {
  transferData: TransferData
  txHash: string
  onSendAnother: () => void
  onGoToDashboard: () => void
}

export function SendSuccess({ transferData, txHash, onSendAnother, onGoToDashboard }: SendSuccessProps) {
  const { recipient, amount } = transferData
  const isDirect = recipient.transferType === 'direct'

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
          isDirect ? 'bg-green-100' : 'bg-yellow-100'
        }`}>
          {isDirect ? (
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isDirect ? 'Transfer Complete!' : 'Email Sent!'}
        </h1>
        
        <p className="text-lg text-gray-600">
          {formatUSDCWithSymbol(amount)} {isDirect ? 'sent to' : 'reserved for'} {recipient.displayName || recipient.email}
        </p>
      </div>

      {/* Transfer Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer Details</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Amount</span>
            <span className="font-semibold text-gray-900">
              {formatUSDCWithSymbol(amount)}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2">
            <span className="text-gray-600">Recipient</span>
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {recipient.displayName || recipient.email}
              </div>
              {recipient.displayName && (
                <div className="text-sm text-gray-500">{recipient.email}</div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Status</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
              isDirect 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isDirect ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Completed
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Pending Claim
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className={`card ${isDirect ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <h3 className={`font-semibold mb-3 ${isDirect ? 'text-green-900' : 'text-yellow-900'}`}>
          What happens next?
        </h3>
        
        <div className={`space-y-2 text-sm ${isDirect ? 'text-green-800' : 'text-yellow-800'}`}>
          {isDirect ? (
            <>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>The USDC has been transferred directly to {recipient.displayName || recipient.email}'s wallet</span>
              </div>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>The transaction has been confirmed on the blockchain</span>
              </div>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>The recipient can access their funds immediately</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>{recipient.email} will receive an email with claim instructions</span>
              </div>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Your USDC is held safely in escrow until they claim it</span>
              </div>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>If unclaimed after 7 days, you can request a refund</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Link */}
      {txHash && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Blockchain Record</h3>
          <p className="text-blue-800 text-sm mb-3">
            Your transaction has been recorded on the blockchain and can be viewed publicly.
          </p>
          <a
            href={getBlockExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            <span>View on Block Explorer</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <button
          onClick={onSendAnother}
          className="w-full py-4 px-6 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors active:scale-98"
        >
          Send Another Payment
        </button>
        
        <button
          onClick={onGoToDashboard}
          className="w-full py-4 px-6 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Additional Actions */}
      <div className="flex justify-center space-x-6 pt-4">
        <button 
          onClick={() => {
            const text = `I just sent you ${formatUSDCWithSymbol(amount)} USDC${isDirect ? '' : '. Check your email to claim it!'}`
            if (typeof navigator !== 'undefined') {
              if (navigator.share) {
                navigator.share({ text })
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(text)
              }
            }
          }}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          Share Receipt
        </button>
        
        {!isDirect && (
          <button 
            onClick={() => {
              // This could navigate to a page showing pending transfers
              onGoToDashboard()
            }}
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Track Transfer
          </button>
        )}
      </div>
    </div>
  )
}
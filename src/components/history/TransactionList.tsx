"use client";

import { useState } from 'react'
import { formatUSDCWithSymbol, formatTimeAgo, getBlockExplorerUrl, copyToClipboard } from '@/lib/utils'
import { TransactionDetail } from './TransactionDetail'

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

interface TransactionListProps {
  transactions: Transaction[]
  currentUserId: string
}

export function TransactionList({ transactions, currentUserId }: TransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [copiedTx, setCopiedTx] = useState<string | null>(null)

  const getTransactionIcon = (transaction: Transaction) => {
    const isSent = transaction.type.startsWith('sent')
    const isEscrow = transaction.type.includes('escrow')
    
    if (transaction.status === 'failed') {
      return (
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    if (transaction.status === 'pending' || transaction.status === 'unclaimed') {
      return (
        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    if (isSent) {
      return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isEscrow ? 'bg-orange-100' : 'bg-red-100'
        }`}>
          <svg className={`w-5 h-5 ${isEscrow ? 'text-orange-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    return (
      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-8.707l3-3a1 1 0 011.414 1.414L9.414 9H13a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }

  const getStatusBadge = (status: Transaction['status']) => {
    const statusConfig = {
      confirmed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Confirmed' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      claimed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Claimed' },
      unclaimed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Awaiting Claim' }
    }
    
    const config = statusConfig[status]
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getTransactionTitle = (transaction: Transaction) => {
    const isSent = transaction.type.startsWith('sent')
    const isEscrow = transaction.type.includes('escrow')
    
    if (isSent) {
      return isEscrow ? 'Sent via Email' : 'Sent Instantly'
    }
    
    return transaction.type === 'received_claim' ? 'Received via Claim' : 'Received'
  }

  const getTransactionSubtitle = (transaction: Transaction) => {
    const isSent = transaction.type.startsWith('sent')
    
    if (isSent && transaction.recipientEmail) {
      return `To: ${transaction.recipientEmail}`
    }
    
    if (!isSent && transaction.senderEmail) {
      return `From: ${transaction.senderEmail}`
    }
    
    return 'USDC Transfer'
  }

  const handleCopyTxHash = async (txHash: string) => {
    const success = await copyToClipboard(txHash)
    if (success) {
      setCopiedTx(txHash)
      setTimeout(() => setCopiedTx(null), 2000)
    }
  }

  if (transactions.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-3">
        {transactions.map((transaction) => {
          const isSent = transaction.type.startsWith('sent')
          const amountColor = transaction.status === 'failed' 
            ? 'text-gray-500' 
            : isSent 
              ? 'text-red-600' 
              : 'text-green-600'
          const amountPrefix = transaction.status === 'failed' 
            ? '' 
            : isSent 
              ? '-' 
              : '+'

          return (
            <div 
              key={transaction._id}
              onClick={() => setSelectedTransaction(transaction)}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                {getTransactionIcon(transaction)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {getTransactionTitle(transaction)}
                    </h3>
                    <div className={`font-semibold ${amountColor}`}>
                      {amountPrefix}{formatUSDCWithSymbol(transaction.amount)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate">
                      {getTransactionSubtitle(transaction)}
                    </p>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(transaction.status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(new Date(transaction.createdAt))}
                    </p>
                    
                    {transaction.txHash && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyTxHash(transaction.txHash!)
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            copiedTx === transaction.txHash
                              ? 'bg-green-100 text-green-600'
                              : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          {copiedTx === transaction.txHash ? 'Copied!' : 'Copy TX'}
                        </button>
                        
                        <a
                          href={getBlockExplorerUrl(transaction.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        >
                          View
                        </a>
                      </div>
                    )}
                  </div>
                  
                  {transaction.message && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                      <span className="font-medium">Message:</span> {transaction.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          currentUserId={currentUserId}
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </>
  )
}
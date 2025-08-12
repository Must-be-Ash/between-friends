"use client";

import { useState } from 'react'
import { formatTimeAgo, getBlockExplorerUrl, copyToClipboard } from '@/lib/utils'
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

  // Remove icon - keeping minimal design

  const getStatusBadge = (status: Transaction['status']) => {
    const statusConfig = {
      confirmed: { bg: 'bg-[#4A5A4A]', text: 'text-[#B8D8B8]', border: 'border-[#6B8B6B]', label: 'Confirmed' },
      pending: { bg: 'bg-[#5A5A4A]', text: 'text-[#D8D8B8]', border: 'border-[#8B8B6B]', label: 'Pending' },
      failed: { bg: 'bg-[#5A4A4A]', text: 'text-[#CC8888]', border: 'border-[#8B6B6B]', label: 'Failed' },
      claimed: { bg: 'bg-[#4A4A5A]', text: 'text-[#B8B8D8]', border: 'border-[#6B6B8B]', label: 'Claimed' },
      unclaimed: { bg: 'bg-[#5A5A4A]', text: 'text-[#D8D8B8]', border: 'border-[#8B8B6B]', label: 'Awaiting Claim' }
    }
    
    const config = statusConfig[status]
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
        {config.label}
      </span>
    )
  }

  // Remove transaction title - keeping minimal design

  const getTransactionEmail = (transaction: Transaction) => {
    const isSent = transaction.type.startsWith('sent')
    
    if (isSent && transaction.recipientEmail) {
      return transaction.recipientEmail
    }
    
    if (!isSent && transaction.senderEmail) {
      return transaction.senderEmail
    }
    
    return 'Unknown'
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
            ? 'text-[#999999]' 
            : isSent 
              ? 'text-[#CC8888]' 
              : 'text-[#B8D8B8]'
          const amountPrefix = transaction.status === 'failed' 
            ? '' 
            : isSent 
              ? '-' 
              : '+'

          return (
            <div 
              key={transaction._id}
              className="bg-[#2A2A2A] rounded-2xl border border-[#4A4A4A] p-4 hover:bg-[#333333] transition-colors backdrop-blur-xl"
            >
              {/* Email */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#B8B8B8] truncate">
                  {getTransactionEmail(transaction)}
                </p>
                <div className={`font-semibold text-lg ${amountColor}`}>
                  {amountPrefix}${transaction.amount}
                </div>
              </div>
              
              {/* Time */}
              <div className="mt-0">
                <p className="text-xs text-[#999999]">
                  {formatTimeAgo(new Date(transaction.createdAt))}
                </p>
              </div>
              
              {/* Status and Transaction Actions */}
              {transaction.txHash && (
                <div className="flex items-center justify-between mt-3">
                  {getStatusBadge(transaction.status)}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyTxHash(transaction.txHash!)
                      }}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        copiedTx === transaction.txHash
                          ? 'bg-[#4A5A4A] text-[#B8D8B8] border border-[#6B8B6B]'
                          : 'text-[#B8B8B8] hover:bg-[#4A4A4A] border border-[#5A5A5A]'
                      }`}
                    >
                      {copiedTx === transaction.txHash ? 'Copied!' : 'Copy TX'}
                    </button>
                    
                    <a
                      href={getBlockExplorerUrl(transaction.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-[#B8B8B8] hover:bg-[#4A4A4A] px-2 py-1 rounded transition-colors border border-[#5A5A5A]"
                    >
                      View
                    </a>
                  </div>
                </div>
              )}
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
import { ObjectId } from 'mongodb'

export interface Contact {
  _id: ObjectId
  ownerEmail: string         // Contact list owner
  contactEmail: string       // Contact's email
  displayName: string        // Friendly name
  hasAccount: boolean        // Cache if contact has account
  lastUsedAt: Date          // For sorting by recency
}

export interface CreateContactData {
  ownerEmail: string
  contactEmail: string
  displayName: string
  hasAccount: boolean
}

export interface PendingTransfer {
  _id: ObjectId
  transferId: string         // UUID for escrow contract
  senderEmail: string        // Who sent the money
  recipientEmail: string     // Who should receive it
  amount: string             // USDC amount as string
  claimToken: string         // Secure token for claiming
  expiryDate: Date          // When transfer expires
  status: 'pending' | 'claimed' | 'refunded' | 'expired'
  txHashDeposit?: string     // Escrow deposit transaction
  txHashClaim?: string       // Claim transaction
  txHashRefund?: string      // Refund transaction
  createdAt: Date
  claimedAt?: Date
}

export interface CreatePendingTransferData {
  transferId: string
  senderEmail: string
  recipientEmail: string
  amount: string
  claimToken: string
  expiryDate: Date
  txHashDeposit?: string
}

export interface Transaction {
  _id: ObjectId
  userEmail: string          // Transaction owner
  type: 'sent' | 'received' | 'received_claim' | 'refund'
  recipientEmail?: string    // For sent transactions
  senderEmail?: string       // For received transactions
  amount: string             // USDC amount
  txHash?: string           // Blockchain transaction hash
  transferId?: string       // Link to pending transfer if applicable
  status: 'confirmed' | 'pending' | 'failed'
  createdAt: Date
}

export interface CreateTransactionData {
  userEmail: string
  type: Transaction['type']
  recipientEmail?: string
  senderEmail?: string
  amount: string
  txHash?: string
  transferId?: string
  status: Transaction['status']
}
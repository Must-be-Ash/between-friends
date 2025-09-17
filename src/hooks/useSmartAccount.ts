"use client";

import { useCurrentUser, useSendUserOperation } from '@coinbase/cdp-hooks'
import { getCDPNetworkName, prepareUSDCTransferCall, prepareUSDCApprovalCall, prepareEscrowDepositCall, SmartAccountCall, PAYMASTER_CONFIG } from '@/lib/cdp'
import { keccak256, toBytes } from 'viem'

export interface SmartAccountTransferOptions {
  recipientAddress: string
  amount: string
  useGasSponsoring?: boolean
  customPaymasterUrl?: string
}

export interface SmartAccountEscrowOptions {
  transferId: string
  amount: string
  recipientEmail: string
  timeoutDays?: number
  useGasSponsoring?: boolean
  customPaymasterUrl?: string
}

interface PaymasterOptions {
  useCdpPaymaster?: boolean
  paymasterUrl?: string
}

export function useSmartAccount() {
  const { currentUser } = useCurrentUser()
  const { sendUserOperation, status, data, error } = useSendUserOperation()

  // Get the smart account address (primary address if smart account exists)
  const smartAccount = currentUser?.evmSmartAccounts?.[0]
  const hasSmartAccount = !!smartAccount

  // Get network name for CDP
  const network = getCDPNetworkName()

  /**
   * Send a direct USDC transfer using smart account
   */
  const sendDirectTransfer = async (options: SmartAccountTransferOptions) => {
    if (!smartAccount) {
      throw new Error('Smart account not available')
    }

    const { recipientAddress, amount, useGasSponsoring = true, customPaymasterUrl } = options

    // Prepare the USDC transfer call
    const transferCall = prepareUSDCTransferCall(recipientAddress, amount)

    // Determine paymaster configuration
    const paymasterOptions: PaymasterOptions = {}
    if (useGasSponsoring) {
      if (customPaymasterUrl) {
        paymasterOptions.paymasterUrl = customPaymasterUrl
      } else if (PAYMASTER_CONFIG.enabled) {
        paymasterOptions.paymasterUrl = PAYMASTER_CONFIG.url
      } else {
        paymasterOptions.useCdpPaymaster = true // Fallback to CDP paymaster
      }
    }

    // Send user operation with optional gas sponsoring
    const result = await sendUserOperation({
      evmSmartAccount: smartAccount,
      network,
      calls: [transferCall],
      ...paymasterOptions,
    })

    return result
  }

  /**
   * Send USDC to escrow using smart account
   */
  const sendEscrowDeposit = async (options: SmartAccountEscrowOptions) => {
    if (!smartAccount) {
      throw new Error('Smart account not available')
    }

    const { transferId, amount, recipientEmail, timeoutDays = 7, useGasSponsoring = true, customPaymasterUrl } = options

    // Hash the recipient email for privacy
    const recipientEmailHash = keccak256(toBytes(recipientEmail))

    // Prepare the escrow deposit call
    const depositCall = prepareEscrowDepositCall(transferId, amount, recipientEmailHash, timeoutDays)

    // Determine paymaster configuration
    const paymasterOptions: PaymasterOptions = {}
    if (useGasSponsoring) {
      if (customPaymasterUrl) {
        paymasterOptions.paymasterUrl = customPaymasterUrl
      } else if (PAYMASTER_CONFIG.enabled) {
        paymasterOptions.paymasterUrl = PAYMASTER_CONFIG.url
      } else {
        paymasterOptions.useCdpPaymaster = true // Fallback to CDP paymaster
      }
    }

    // Send user operation with optional gas sponsoring
    const result = await sendUserOperation({
      evmSmartAccount: smartAccount,
      network,
      calls: [depositCall],
      ...paymasterOptions,
    })

    return result
  }

  /**
   * Send multiple calls in a single user operation (batch)
   */
  const sendBatchOperation = async (calls: SmartAccountCall[], useGasSponsoring = true) => {
    if (!smartAccount) {
      throw new Error('Smart account not available')
    }

    const result = await sendUserOperation({
      evmSmartAccount: smartAccount,
      network,
      calls,
      useCdpPaymaster: useGasSponsoring,
    })

    return result
  }

  /**
   * Send a custom user operation
   */
  const sendCustomOperation = async (calls: SmartAccountCall[], useGasSponsoring = true) => {
    if (!smartAccount) {
      throw new Error('Smart account not available')
    }

    const result = await sendUserOperation({
      evmSmartAccount: smartAccount,
      network,
      calls,
      useCdpPaymaster: useGasSponsoring,
    })

    return result
  }

  /**
   * Check if gas sponsoring is available
   */
  const isGasSponsoringAvailable = () => {
    return PAYMASTER_CONFIG.enabled || hasSmartAccount
  }

  /**
   * Get gas sponsoring status message
   */
  const getGasSponsoringStatus = () => {
    if (!hasSmartAccount) {
      return { available: false, message: 'Smart account required for gas sponsoring' }
    }
    if (PAYMASTER_CONFIG.enabled) {
      return { available: true, message: 'Gas sponsoring enabled via CDP Paymaster' }
    }
    return { available: true, message: 'Gas sponsoring enabled via CDP default paymaster' }
  }

  /**
   * Handle smart account errors with user-friendly messages
   */
  const getErrorMessage = (error: unknown): string => {
    const errorMsg = (error as Error)?.message || String(error)

    if (errorMsg.includes('insufficient funds')) {
      return 'Insufficient funds for gas fees. Please try gas-sponsored transaction.'
    }
    if (errorMsg.includes('paymaster')) {
      return 'Gas sponsoring temporarily unavailable. Please try again.'
    }
    if (errorMsg.includes('user operation')) {
      return 'Transaction failed. Please check your balance and try again.'
    }
    if (errorMsg.includes('smart account')) {
      return 'Smart account not available. Please refresh and try again.'
    }

    return errorMsg
  }

  return {
    // Smart account info
    smartAccount,
    hasSmartAccount,
    network,

    // User operation methods
    sendDirectTransfer,
    sendEscrowDeposit,
    sendBatchOperation,
    sendCustomOperation,

    // Status tracking
    status,
    data,
    error,

    // Utility methods
    prepareUSDCTransferCall,
    prepareUSDCApprovalCall,
    prepareEscrowDepositCall,

    // Gas sponsoring utilities
    isGasSponsoringAvailable,
    getGasSponsoringStatus,
    getErrorMessage,

    // Paymaster config
    paymasterEnabled: PAYMASTER_CONFIG.enabled,
    paymasterUrl: PAYMASTER_CONFIG.url,
  }
}

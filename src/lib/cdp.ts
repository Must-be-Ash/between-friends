// CDP (Coinbase Developer Platform) utilities
import { parseUnits, encodeFunctionData } from 'viem'

export interface CDPConfig {
  projectId: string
  rpcUrl: string
  chainId: number
}

export function getCDPConfig(): CDPConfig {
  const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID
  const isDevelopment = process.env.NODE_ENV === 'development'
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || (isDevelopment ? 'https://sepolia.base.org' : 'https://mainnet.base.org')
  
  if (!projectId) {
    throw new Error('Missing CDP_PROJECT_ID configuration. Please check your environment variables.')
  }
  
  return {
    projectId,
    rpcUrl,
    chainId: isDevelopment ? 84532 : 8453 // Base Sepolia : Base Mainnet
  }
}

export function getChainName(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'Base'
    case 84532:
      return 'Base Sepolia'
    default:
      return 'Unknown Chain'
  }
}

export function getExplorerUrl(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'https://basescan.org'
    case 84532:
      return 'https://sepolia.basescan.org'
    default:
      return 'https://basescan.org'
  }
}

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  USDC: {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet
    84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  },
  SIMPLIFIED_ESCROW: {
    8453: '0x0000000000000000000000000000000000000000', // Base Mainnet - to be deployed
    84532: '0x5a61Cc9206f82e2bAFD9bde1729E32E27bb737E9', // Base Sepolia - deployed
  }
}

export const CURRENT_NETWORK = process.env.NODE_ENV === 'development' ? 84532 : 8453

// Default configurations that can be imported directly
export const CDP_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID || ''
}

export const APP_CONFIG = {
  name: 'Between Friends',
  logoUrl: '/logo.svg'
}

export function formatAddress(address: string): string {
  if (!address) return ''
  if (address.length <= 20) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Transaction preparation functions
export interface TransactionRequest {
  to: `0x${string}`
  value: bigint
  data: `0x${string}`
  gas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  chainId: number
  type: "eip1559"
}

export function prepareUSDCApproval(
  senderAddress: string,
  spenderAddress: string,
  amount: string
): TransactionRequest {
  // Encode the USDC approve function call: approve(address spender, uint256 amount)
  // Function signature: approve(address,uint256) = 0x095ea7b3
  console.log('Preparing USDC approval for:', { senderAddress, spenderAddress, amount })
  
  // Convert amount to USDC units (6 decimals)
  const amountWei = parseUnits(amount, 6)
  
  // Encode the function call
  const approveData = encodeFunctionData({
    abi: [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      }
    ],
    functionName: 'approve',
    args: [spenderAddress as `0x${string}`, amountWei]
  })
  
  return {
    to: CONTRACT_ADDRESSES.USDC[CURRENT_NETWORK as keyof typeof CONTRACT_ADDRESSES.USDC] as `0x${string}`,
    value: BigInt(0),
    data: approveData,
    gas: BigInt(100000),
    maxFeePerGas: BigInt(1000000000), // 1 gwei
    maxPriorityFeePerGas: BigInt(1000000000), // 1 gwei
    chainId: CURRENT_NETWORK,
    type: "eip1559"
  }
}

export async function hasSufficientAllowance(
  ownerAddress: string,
  spenderAddress: string,
  amount: string
): Promise<boolean> {
  try {
    // This would check the USDC allowance on-chain
    // For now, returning false to always require approval
    console.log('Checking allowance:', { ownerAddress, spenderAddress, amount })
    return false
  } catch (error) {
    console.error('Error checking allowance:', error)
    return false
  }
}

export function generateSecureToken(length: number = 32): string {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

// Gas sponsorship for users without ETH
export async function prepareSponsoredUSDCTransfer(
  senderAddress: string,
  recipientAddress: string,
  amount: string
): Promise<TransactionRequest> {
  // This would use the admin wallet to sponsor gas costs
  // The user still needs to approve the USDC transfer amount
  console.log('Preparing sponsored USDC transfer:', { senderAddress, recipientAddress, amount })
  
  const amountWei = parseUnits(amount, 6) // USDC has 6 decimals
  
  return {
    to: CONTRACT_ADDRESSES.USDC[CURRENT_NETWORK as keyof typeof CONTRACT_ADDRESSES.USDC] as `0x${string}`,
    value: BigInt(0),
    // This would be a transferFrom call instead of transfer, with admin as the gas sponsor
    data: `0x23b872dd${senderAddress.slice(2).padStart(64, '0')}${recipientAddress.slice(2).padStart(64, '0')}${amountWei.toString(16).padStart(64, '0')}`, // transferFrom(sender, recipient, amount)
    gas: BigInt(80000), // Slightly higher gas for transferFrom
    maxFeePerGas: BigInt(1000000000), // 1 gwei
    maxPriorityFeePerGas: BigInt(500000000), // 0.5 gwei
    chainId: CURRENT_NETWORK,
    type: "eip1559"
  }
}

export function calculateExpiryDate(days: number): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + days)
  return expiryDate
}

export function generateSimpleTransferId(): string {
  return `simple_${Date.now()}_${Math.random().toString(36).substring(2)}`
}

export function getBlockExplorerUrl(txHash: string, chainId?: number): string {
  const networkId = chainId || CURRENT_NETWORK
  const baseUrl = getExplorerUrl(networkId)
  return `${baseUrl}/tx/${txHash}`
}

// Get the network name for CDP transactions
export function getCDPNetworkName(chainId?: number): 'base' | 'base-sepolia' {
  const networkId = chainId || CURRENT_NETWORK
  switch (networkId) {
    case 8453:
      return 'base'
    case 84532:
      return 'base-sepolia'
    default:
      return process.env.NODE_ENV === 'development' ? 'base-sepolia' : 'base'
  }
}
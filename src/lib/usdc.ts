import { createPublicClient, http, formatUnits, parseUnits } from 'viem'
import { base, baseSepolia } from 'viem/chains'

// USDC contract addresses
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// Get the appropriate chain and USDC address
const isDevelopment = process.env.NODE_ENV === 'development'
const chain = isDevelopment ? baseSepolia : base
const usdcAddress = isDevelopment ? USDC_BASE_SEPOLIA : USDC_BASE_MAINNET

// Create public client
const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org')
})

// USDC has 6 decimals
const USDC_DECIMALS = 6

export async function getUSDCBalance(address: string): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })

    return formatUnits(balance as bigint, USDC_DECIMALS)
  } catch (error) {
    console.error('Error fetching USDC balance:', error)
    return '0'
  }
}

export function parseUSDCAmount(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS)
}

export function formatUSDCAmount(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS)
}

export const USDC_CONTRACT_ADDRESS = usdcAddress
export const USDC_CHAIN = chain

// Export publicClient for other modules
export { publicClient }

export interface USDCTransactionRequest {
  to: string
  value: bigint
  data: string
  gasLimit?: bigint
  gasPrice?: bigint
  gas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  chainId?: number
  type?: "eip1559" | "legacy"
}

export async function getCurrentGasPrice(): Promise<bigint> {
  try {
    const gasPrice = await publicClient.getGasPrice()
    return gasPrice
  } catch (error) {
    console.error('Error getting gas price:', error)
    return parseUnits('20', 9) // 20 gwei fallback
  }
}

export async function hasSufficientBalance(address: string, amount: string): Promise<boolean> {
  try {
    const balance = await getUSDCBalance(address)
    console.log('🔍 BALANCE CHECK:', {
      address,
      balance,
      requiredAmount: amount,
      hasSufficient: parseFloat(balance) >= parseFloat(amount)
    })
    return parseFloat(balance) >= parseFloat(amount)
  } catch (error) {
    console.error('Error checking balance:', error)
    return false
  }
}

export async function getETHBalance(address: string): Promise<string> {
  try {
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`
    })
    return formatUnits(balance, 18) // ETH has 18 decimals
  } catch (error) {
    console.error('Error fetching ETH balance:', error)
    return '0'
  }
}

export async function hasSufficientETHForGas(address: string, gasLimit: bigint, maxFeePerGas: bigint): Promise<boolean> {
  try {
    const ethBalance = await getETHBalance(address)
    const requiredETH = gasLimit * maxFeePerGas
    const requiredETHFormatted = formatUnits(requiredETH, 18)
    
    console.log('🔍 ETH BALANCE CHECK:', {
      address,
      ethBalance,
      requiredETH: requiredETHFormatted,
      hasSufficient: parseFloat(ethBalance) >= parseFloat(requiredETHFormatted)
    })
    
    return parseFloat(ethBalance) >= parseFloat(requiredETHFormatted)
  } catch (error) {
    console.error('Error checking ETH balance:', error)
    return false
  }
}

export async function hasSufficientAllowance(
  owner: string, 
  spender: string, 
  amount: string
): Promise<boolean> {
  try {
    const allowance = await publicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: [
        {
          name: 'allowance',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    })

    const allowanceAmount = formatUnits(allowance as bigint, USDC_DECIMALS)
    return parseFloat(allowanceAmount) >= parseFloat(amount)
  } catch (error) {
    console.error('Error checking allowance:', error)
    return false
  }
}

export function prepareUSDCTransfer(senderAddress: string, recipientAddress: string, amount: string): USDCTransactionRequest {
  const amountWei = parseUnits(amount, USDC_DECIMALS)
  const data = `0xa9059cbb${recipientAddress.slice(2).padStart(64, '0')}${amountWei.toString(16).padStart(64, '0')}`
  
  return {
    to: usdcAddress,
    value: BigInt(0),
    data,
    gas: BigInt(60000), // Reduced gas limit for USDC transfer
    maxFeePerGas: BigInt(1000000000), // 1 gwei (reduced)
    maxPriorityFeePerGas: BigInt(500000000), // 0.5 gwei (reduced)
    chainId: chain.id,
    type: "eip1559"
  }
}

export function prepareUSDCApproval(senderAddress: string, spender: string, amount: string): USDCTransactionRequest {
  const amountWei = parseUnits(amount, USDC_DECIMALS)
  const data = `0x095ea7b3${spender.slice(2).padStart(64, '0')}${amountWei.toString(16).padStart(64, '0')}`
  
  return {
    to: usdcAddress,
    value: BigInt(0),
    data,
    gas: BigInt(80000),
    maxFeePerGas: BigInt(2000000000), // 2 gwei
    maxPriorityFeePerGas: BigInt(1000000000), // 1 gwei
    chainId: chain.id,
    type: "eip1559"
  }
}
"use client";

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { copyToClipboard, formatUSDCWithSymbol } from '@/lib/utils'

interface SimpleReceiveProps {
  address: string
}

export function SimpleReceive({ address }: SimpleReceiveProps) {
  const [copied, setCopied] = useState(false)
  const [amount, setAmount] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate QR code for wallet address on mount
  useEffect(() => {
    generateQRCode()
  }, [address])

  // Generate QR code when amount changes
  useEffect(() => {
    if (amount) {
      generateQRCode()
    }
  }, [amount])

  const generateQRCode = async () => {
    setIsGenerating(true)
    try {
      let qrData = address
      
      // If amount is specified, create payment URL
      if (amount && parseFloat(amount) > 0) {
        // Only use window.location on client side
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const params = new URLSearchParams()
        params.set('to', address)
        params.set('amount', amount)
        qrData = `${baseUrl}/send?${params.toString()}`
      }
      
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#FFFFFF'
        }
      })
      
      setQrCodeUrl(qrUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    const success = await copyToClipboard(address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAmountChange = (value: string) => {
    // Only allow numbers and single decimal point
    const regex = /^\d*\.?\d{0,6}$/
    if (value === '' || regex.test(value)) {
      setAmount(value)
    }
  }

  const handleShare = async () => {
    let shareText = 'Send me USDC'
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let shareUrl = `${baseUrl}/send?to=${address}`
    
    if (amount && parseFloat(amount) > 0) {
      shareText = `Send me ${formatUSDCWithSymbol(amount)} USDC`
      shareUrl += `&amount=${amount}`
    }

    const shareData = {
      title: 'Between Friends Payment Request',
      text: shareText,
      url: shareUrl
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        // Fallback to clipboard
        await copyToClipboard(`${shareText}\n${shareUrl}`)
      }
    } else {
      await copyToClipboard(`${shareText}\n${shareUrl}`)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Wallet Address */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Your Wallet Address</h3>
        
        <div className="flex items-center space-x-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-gray-600 break-all">
              {address}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded transition-colors ${
              copied 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Request Specific Amount (Optional)</h3>
        
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">$</span>
          <input
            type="text"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="flex-1 text-lg font-medium bg-transparent border-none outline-none placeholder-gray-400"
          />
          <span className="text-sm text-gray-500">USDC</span>
        </div>
        
        {amount && (
          <p className="text-xs text-gray-500 mt-1">
            QR code will request {formatUSDCWithSymbol(amount)}
          </p>
        )}
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
        {isGenerating ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <img 
              src={qrCodeUrl} 
              alt="Payment QR Code"
              className="w-48 h-48 mx-auto mb-4"
            />
            <p className="text-sm text-gray-600">
              {amount && parseFloat(amount) > 0 
                ? `Scan to send ${formatUSDCWithSymbol(amount)}`
                : 'Scan to send USDC'
              }
            </p>
          </>
        )}
      </div>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
      >
        Share Payment Request
      </button>
    </div>
  )
}
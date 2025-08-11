import { NextRequest, NextResponse } from 'next/server'
import { getPendingTransfer } from '@/lib/models'
import { isEscrowClaimable } from '@/lib/escrow'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const transferId = searchParams.get('id')
    const token = searchParams.get('token')

    if (!transferId || !token) {
      return NextResponse.json(
        { error: 'Missing transfer ID or token' },
        { status: 400 }
      )
    }

    // Get pending transfer from database
    const pendingTransfer = await getPendingTransfer(transferId)

    if (!pendingTransfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      )
    }

    // Verify claim token
    if (pendingTransfer.claimToken !== token) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 403 }
      )
    }

    // Check if transfer is still claimable
    if (pendingTransfer.status !== 'pending') {
      const statusMessages = {
        claimed: 'This transfer has already been claimed',
        refunded: 'This transfer has been refunded to the sender',
        expired: 'This transfer has expired'
      }
      
      return NextResponse.json(
        { error: statusMessages[pendingTransfer.status as keyof typeof statusMessages] || 'Transfer is no longer available' },
        { status: 400 }
      )
    }

    // Check if transfer has expired
    const now = new Date()
    if (now > pendingTransfer.expiryDate) {
      return NextResponse.json(
        { error: 'This transfer has expired' },
        { status: 400 }
      )
    }

    // Verify on-chain status (optional - for extra safety)
    const isClaimable = await isEscrowClaimable(transferId)
    if (!isClaimable) {
      return NextResponse.json(
        { error: 'Transfer is no longer claimable on-chain' },
        { status: 400 }
      )
    }

    // Get sender display name (if available)
    let senderDisplayName: string | undefined
    try {
      const senderResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users?email=${encodeURIComponent(pendingTransfer.senderEmail)}`)
      if (senderResponse.ok) {
        const { user } = await senderResponse.json()
        senderDisplayName = user.displayName
      }
    } catch (error) {
      // Ignore error - we'll just use email
    }

    return NextResponse.json({
      success: true,
      transfer: {
        transferId: pendingTransfer.transferId,
        amount: pendingTransfer.amount,
        senderEmail: pendingTransfer.senderEmail,
        senderDisplayName,
        recipientEmail: pendingTransfer.recipientEmail,
        expiryDate: pendingTransfer.expiryDate,
        createdAt: pendingTransfer.createdAt,
        status: pendingTransfer.status,
      }
    })
  } catch (error) {
    console.error('Claim details error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { getPendingTransfersByRecipient, getUserByUserId } from '@/lib/models'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      )
    }

    // Get user to find email (pending transfers are still stored by email)
    const user = await getUserByUserId(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get pending transfers sent TO this user
    const pendingTransfers = await getPendingTransfersByRecipient(user.email)

    // Filter only pending status and format for display
    const incomingClaims = pendingTransfers
      .filter(transfer => transfer.status === 'pending')
      .map(transfer => ({
        transferId: transfer.transferId,
        amount: transfer.amount,
        senderEmail: transfer.senderEmail,
        expiryDate: transfer.expiryDate,
        createdAt: transfer.createdAt,
        status: transfer.status,
        claimToken: transfer.claimToken
      }))

    return NextResponse.json({
      success: true,
      claims: incomingClaims
    })
  } catch (error) {
    console.error('Incoming claims API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
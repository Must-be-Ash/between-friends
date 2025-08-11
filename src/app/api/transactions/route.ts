import { NextRequest, NextResponse } from 'next/server'
import { getTransactionsByUser, getUserByUserId } from '@/lib/models'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      )
    }

    // Get user to find email (transactions are still stored by email)
    const user = await getUserByUserId(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 20
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0

    // Validate limit and offset
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      )
    }

    if (limit < 1 || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid limit or offset parameters' },
        { status: 400 }
      )
    }

    const transactions = await getTransactionsByUser(user.email, limit, offset)

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit
      }
    })
  } catch (error) {
    console.error('Transactions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
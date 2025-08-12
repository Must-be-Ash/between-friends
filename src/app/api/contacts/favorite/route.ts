import { NextRequest, NextResponse } from 'next/server'
import { toggleContactFavorite } from '@/lib/models'
import { z } from 'zod'

const FavoriteToggleSchema = z.object({
  ownerUserId: z.string().min(1, 'Owner user ID is required'),
  contactEmail: z.string().email('Invalid email address')
})

export const dynamic = 'force-dynamic'

// POST - Toggle contact favorite status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = FavoriteToggleSchema.parse(body)
    
    await toggleContactFavorite(
      validatedData.ownerUserId,
      validatedData.contactEmail.toLowerCase()
    )
    
    return NextResponse.json({
      success: true,
      message: 'Contact favorite status updated'
    })
  } catch (error) {
    console.error('Favorite toggle error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
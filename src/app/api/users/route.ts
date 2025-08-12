import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByEmail, getUserByUserId, updateUser, updateUserByEmail, getPendingTransfersByRecipient } from '@/lib/models'
import { CreateUserData, UpdateUserData } from '@/types'
import { z } from 'zod'

// Validation schemas
const CreateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email address'),
  walletAddress: z.string().min(1, 'Wallet address is required'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50, 'Display name too long'),
  profileSetupComplete: z.boolean().optional(),
})

const UpdateUserSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  profileSetupComplete: z.boolean().optional(),
})

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = CreateUserSchema.parse(body)
    
    // Check if user already exists by userId or email
    const existingUserByUserId = await getUserByUserId(validatedData.userId)
    const existingUserByEmail = await getUserByEmail(validatedData.email.toLowerCase())
    
    if (existingUserByUserId || existingUserByEmail) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create user
    const userData: CreateUserData = {
      userId: validatedData.userId,
      email: validatedData.email.toLowerCase(),
      walletAddress: validatedData.walletAddress,
      displayName: validatedData.displayName,
      profileSetupComplete: validatedData.profileSetupComplete ?? false,
    }

    const user = await createUser(userData)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }
    
    // Check for pending transfers for this new user
    const pendingTransfers = await getPendingTransfersByRecipient(validatedData.email.toLowerCase())
    const pendingClaims = pendingTransfers
      .filter(transfer => transfer.status === 'pending')
      .map(transfer => ({
        transferId: transfer.transferId,
        amount: transfer.amount,
        senderEmail: transfer.senderEmail,
        expiryDate: transfer.expiryDate,
        createdAt: transfer.createdAt,
        claimToken: transfer.claimToken
      }))
    
    return NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        profileSetupComplete: user.profileSetupComplete,
        createdAt: user.createdAt,
      },
      pendingClaims: pendingClaims.length > 0 ? pendingClaims : undefined
    })
  } catch (error) {
    console.error('User creation error:', error)
    
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

// GET - Get user by email or userId (from query params)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const userId = searchParams.get('userId')
    
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or userId parameter is required' },
        { status: 400 }
      )
    }

    let user = null
    if (userId) {
      user = await getUserByUserId(userId)
    } else if (email) {
      user = await getUserByEmail(email.toLowerCase())
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        profileSetupComplete: user.profileSetupComplete,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      }
    })
  } catch (error) {
    console.error('User fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, ...updateData } = body
    
    if (!userId && !email) {
      return NextResponse.json(
        { error: 'UserId or email is required' },
        { status: 400 }
      )
    }

    // Validate update data
    const validatedData = UpdateUserSchema.parse(updateData)
    
    // Check if user exists
    let existingUser = null
    if (userId) {
      existingUser = await getUserByUserId(userId)
    } else if (email) {
      existingUser = await getUserByEmail(email.toLowerCase())
    }
    
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user
    const updateUserData: UpdateUserData = {
      ...validatedData,
      lastLoginAt: new Date(),
    }

    if (userId) {
      await updateUser(userId, updateUserData)
    } else {
      await updateUserByEmail(email.toLowerCase(), updateUserData)
    }
    
    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    })
  } catch (error) {
    console.error('User update error:', error)
    
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
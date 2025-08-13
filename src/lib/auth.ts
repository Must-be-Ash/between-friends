import { NextRequest, NextResponse } from 'next/server'
import { CdpClient } from '@coinbase/cdp-sdk'

// CDP User interface to match the endUser validation response
interface CDPUser {
  userId: string
  email?: string
}

// Initialize CDP client for server-side authentication validation
let cdpClient: CdpClient | null = null

function getCdpClient(): CdpClient {
  if (!cdpClient) {
    const apiKeyId = process.env.CDP_API_KEY_ID
    const apiKeySecret = process.env.CDP_SECRET_API_KEY  // Fixed: correct env var name
    
    if (!apiKeyId || !apiKeySecret) {
      throw new Error('CDP_API_KEY_ID and CDP_SECRET_API_KEY must be set in environment variables')
    }

    cdpClient = new CdpClient({
      apiKeyId,
      apiKeySecret,
    })
  }
  
  return cdpClient
}

/**
 * Validates CDP access token from Authorization header
 * Returns authenticated user information or error
 */
export async function validateCDPAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader) {
      return { 
        user: null, 
        error: 'Missing Authorization header', 
        status: 401 
      }
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { 
        user: null, 
        error: 'Invalid Authorization header format. Expected: Bearer <token>', 
        status: 401 
      }
    }

    const accessToken = authHeader.replace('Bearer ', '').trim()
    
    if (!accessToken) {
      return { 
        user: null, 
        error: 'Missing access token in Authorization header', 
        status: 401 
      }
    }

    // Validate the access token with CDP
    const client = getCdpClient()
    const endUser = await client.endUser.validateAccessToken({
      accessToken,
    })

    return { 
      user: endUser, 
      error: null, 
      status: 200 
    }
  } catch (error) {
    console.error('CDP authentication error:', error)
    
    // Check for specific CDP error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error'
    
    return { 
      user: null, 
      error: `Invalid or expired access token: ${errorMessage}`, 
      status: 401 
    }
  }
}

/**
 * Higher-order function to protect API routes with CDP authentication
 * Usage: export async function POST(request) { return withAuth(request, handler) }
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: CDPUser) => Promise<Response>
): Promise<Response> {
  const authResult = await validateCDPAuth(request)
  
  if (authResult.error || !authResult.user) {
    return NextResponse.json(
      { error: authResult.error || 'Authentication failed' },
      { status: authResult.status || 401 }
    )
  }
  
  return handler(request, authResult.user)
}

/**
 * Middleware for endpoints that require specific user authorization
 * Verifies the authenticated user matches the requested userId
 */
export function requireUserMatch(authenticatedUserId: string, requestedUserId: string): boolean {
  return authenticatedUserId === requestedUserId
}

/**
 * Middleware for endpoints that require specific email authorization
 * Verifies the authenticated user's email matches the requested email
 */
export function requireEmailMatch(authenticatedEmail: string, requestedEmail: string): boolean {
  return authenticatedEmail.toLowerCase() === requestedEmail.toLowerCase()
}
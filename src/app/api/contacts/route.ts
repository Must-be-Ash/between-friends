import { NextRequest, NextResponse } from 'next/server'
import { 
  getContacts, 
  createContact, 
  updateContact,
  deleteContact,
  searchContacts,
  bulkCreateContacts 
} from '@/lib/models'
import { CreateContactData } from '@/types'
import { z } from 'zod'

// Validation schemas
const CreateContactSchema = z.object({
  ownerUserId: z.string().min(1, 'Owner user ID is required'),
  contactEmail: z.string().email('Invalid email address'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  avatar: z.string().optional(),
  hasAccount: z.boolean().default(false),
  source: z.enum(['manual', 'device', 'transaction']).default('manual'),
  favorite: z.boolean().default(false)
})

const UpdateContactSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  avatar: z.string().optional(),
  hasAccount: z.boolean().optional(),
  favorite: z.boolean().optional()
})

const BulkCreateSchema = z.object({
  contacts: z.array(CreateContactSchema),
  ownerUserId: z.string().min(1)
})

export const dynamic = 'force-dynamic'

// GET - Get contacts for a user with optional search
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ownerUserId = searchParams.get('ownerUserId')
    const query = searchParams.get('query')
    
    if (!ownerUserId) {
      return NextResponse.json(
        { error: 'Owner user ID is required' },
        { status: 400 }
      )
    }

    let contacts
    if (query) {
      contacts = await searchContacts(ownerUserId, query)
    } else {
      contacts = await getContacts(ownerUserId)
    }
    
    return NextResponse.json({
      success: true,
      contacts: contacts.map(contact => ({
        _id: contact._id?.toString() || '',
        contactEmail: contact.contactEmail,
        displayName: contact.displayName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phoneNumber: contact.phoneNumber,
        avatar: contact.avatar,
        hasAccount: contact.hasAccount,
        lastUsedAt: contact.lastUsedAt || contact.lastUsed,
        source: contact.source,
        favorite: contact.favorite ?? contact.isFavorite,
        createdAt: contact.createdAt
      }))
    })
  } catch (error) {
    console.error('Contacts fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new contact or bulk create contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a bulk create operation
    if (body.contacts && Array.isArray(body.contacts)) {
      const validatedData = BulkCreateSchema.parse(body)
      
      // Process each contact and add ownerUserId
      const contactsData = validatedData.contacts.map(contact => ({
        ...contact,
        ownerUserId: validatedData.ownerUserId,
        contactEmail: contact.contactEmail.toLowerCase()
      }))
      
      await bulkCreateContacts(contactsData)
      
      return NextResponse.json({
        success: true,
        message: `Successfully imported ${contactsData.length} contacts`
      })
    } else {
      // Single contact creation
      const validatedData = CreateContactSchema.parse(body)
      
      const contactData: CreateContactData = {
        ...validatedData,
        contactEmail: validatedData.contactEmail.toLowerCase()
      }
      
      const contact = await createContact(contactData)
      
      if (!contact) {
        return NextResponse.json(
          { error: 'Failed to create contact' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        contact: {
          _id: contact._id?.toString() || '',
          contactEmail: contact.contactEmail,
          displayName: contact.displayName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phoneNumber: contact.phoneNumber,
          avatar: contact.avatar,
          hasAccount: contact.hasAccount,
          lastUsedAt: contact.lastUsedAt || contact.lastUsed,
          source: contact.source,
          favorite: contact.favorite ?? contact.isFavorite,
          createdAt: contact.createdAt
        }
      })
    }
  } catch (error) {
    console.error('Contact creation error:', error)
    
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

// PUT - Update contact
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { ownerUserId, contactEmail, ...updateData } = body
    
    if (!ownerUserId || !contactEmail) {
      return NextResponse.json(
        { error: 'Owner user ID and contact email are required' },
        { status: 400 }
      )
    }
    
    const validatedData = UpdateContactSchema.parse(updateData)
    
    await updateContact(ownerUserId, contactEmail.toLowerCase(), validatedData)
    
    return NextResponse.json({
      success: true,
      message: 'Contact updated successfully'
    })
  } catch (error) {
    console.error('Contact update error:', error)
    
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

// DELETE - Delete contact
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ownerUserId, contactEmail } = body
    
    if (!ownerUserId || !contactEmail) {
      return NextResponse.json(
        { error: 'Owner user ID and contact email are required' },
        { status: 400 }
      )
    }
    
    await deleteContact(ownerUserId, contactEmail.toLowerCase())
    
    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    })
  } catch (error) {
    console.error('Contact deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
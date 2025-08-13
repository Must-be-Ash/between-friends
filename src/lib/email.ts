// Email utility functions
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export function generateClaimEmail(params: {
  recipientEmail: string
  senderEmail: string
  amount: string
  claimUrl: string
  message?: string
}): EmailTemplate {
  const { senderEmail, amount, claimUrl, message } = params
  
  const subject = `You've received $${amount} USDC from ${senderEmail}`
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've received $${amount} USDC!</h2>
      <p><strong>${senderEmail}</strong> has sent you <strong>$${amount} USDC</strong> using Between Friends.</p>
      ${message ? `<p><em>"${message}"</em></p>` : ''}
      <p>Click the link below to claim your funds:</p>
      <a href="${claimUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
        Claim $${amount} USDC
      </a>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">${claimUrl}</p>
      <p><small>This link is valid for 30 days. After that, the sender can request a refund.</small></p>
    </div>
  `
  
  const text = `
You've received $${amount} USDC from ${senderEmail}!

${message ? `Message: "${message}"\n\n` : ''}

Click this link to claim your funds: ${claimUrl}

This link is valid for 30 days. After that, the sender can request a refund.
  `
  
  return { subject, html, text }
}

export function generateRefundEmail(params: {
  senderEmail: string
  recipientEmail: string
  amount: string
  reason: string
}): EmailTemplate {
  const { recipientEmail, amount, reason } = params
  
  const subject = `Refund processed: $${amount} USDC returned`
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Refund Processed</h2>
      <p>Your $${amount} USDC transfer to <strong>${recipientEmail}</strong> has been refunded.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>The funds have been returned to your wallet.</p>
    </div>
  `
  
  const text = `
Refund Processed

Your $${amount} USDC transfer to ${recipientEmail} has been refunded.

Reason: ${reason}

The funds have been returned to your wallet.
  `
  
  return { subject, html, text }
}

// Email sending functions
export async function sendClaimSuccessEmail(params: {
  recipientEmail: string
  senderEmail: string
  amount: string
  txHash: string
  recipientName?: string
  claimTxHash?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // This would typically use a service like SendGrid, AWS SES, etc.
    console.log('Sending claim success email:', params)
    return { success: true }
  } catch (error) {
    console.error('Error sending claim success email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function sendRefundNotificationEmail(params: {
  senderEmail: string
  recipientEmail: string
  amount: string
  reason: string
  senderName?: string
  refundTxHash?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // This would typically use a service like SendGrid, AWS SES, etc.
    console.log('Sending refund confirmation email:', params)
    return { success: true }
  } catch (error) {
    console.error('Error sending refund confirmation email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

// Alias for backward compatibility
export const sendRefundConfirmationEmail = sendRefundNotificationEmail

export async function sendDirectTransferNotificationEmail(params: {
  recipientEmail: string
  senderEmail: string
  senderName?: string
  amount: string
  txHash: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `You've received $${params.amount} USDC from ${params.senderEmail}`
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'support@keyhub.live'
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've received $${params.amount} USDC!</h2>
        <p><strong>${params.senderEmail}</strong> has sent you <strong>$${params.amount} USDC</strong> directly to your wallet using Between Friends.</p>
        <p>The funds have been deposited directly into your wallet. You can check your balance in the app or view the transaction on BaseScan:</p>
        <a href="https://basescan.org/tx/${params.txHash}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          View Transaction
        </a>
        <p style="margin-top: 20px;"><small>Transaction Hash: ${params.txHash}</small></p>
      </div>
    `
    
    const text = `
You've received $${params.amount} USDC from ${params.senderEmail}!

The funds have been deposited directly into your wallet.

View transaction: https://basescan.org/tx/${params.txHash}

Transaction Hash: ${params.txHash}
    `
    
    console.log('📧 SENDING DIRECT TRANSFER NOTIFICATION EMAIL:', {
      to: params.recipientEmail,
      from: fromAddress,
      subject,
      amount: params.amount,
      senderEmail: params.senderEmail,
      txHash: params.txHash
    })
    
    const response = await resend.emails.send({
      from: fromAddress,
      to: params.recipientEmail,
      subject,
      html,
      text,
    })
    
    console.log('✅ DIRECT TRANSFER EMAIL SENT SUCCESSFULLY:', { emailId: response.data?.id })
    return { success: true }
  } catch (error) {
    console.error('❌ ERROR SENDING DIRECT TRANSFER EMAIL:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function sendClaimNotificationEmail(params: {
  recipientEmail: string
  senderEmail: string
  senderName?: string
  amount: string
  claimUrl: string
  message?: string
  expiryDate?: Date
}): Promise<{ success: boolean; error?: string }> {
  try {
    const emailTemplate = generateClaimEmail(params)
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'support@keyhub.live'
    
    console.log('📧 SENDING CLAIM NOTIFICATION EMAIL:', {
      to: params.recipientEmail,
      from: fromAddress,
      subject: emailTemplate.subject,
      amount: params.amount,
      senderEmail: params.senderEmail
    })
    
    const response = await resend.emails.send({
      from: fromAddress,
      to: params.recipientEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })
    
    console.log('✅ EMAIL SENT SUCCESSFULLY:', { emailId: response.data?.id })
    return { success: true }
  } catch (error) {
    console.error('❌ ERROR SENDING CLAIM NOTIFICATION EMAIL:', error)
    return { success: false, error: 'Failed to send email' }
  }
}
import nodemailer from 'nodemailer'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean // true for 465, false for other ports
  auth: {
    user: string
    pass: string
  }
  senderEmail: string
  senderName: string
}

// Organization SMTP config (from database)
interface OrganizationSMTPConfig {
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPassword?: string | null
  smtpFromEmail?: string | null
  smtpFromName?: string | null
  name?: string | null // Organization name for fallback
}

// Get SMTP configuration from organization (preferred) or environment variables (fallback)
export function getSMTPConfig(orgSMTP?: OrganizationSMTPConfig | null): SMTPConfig | null {
  // Priority: Organization SMTP > Environment Variables
  
  // Try organization SMTP first
  if (orgSMTP && orgSMTP.smtpHost && orgSMTP.smtpPort && orgSMTP.smtpUser && orgSMTP.smtpPassword) {
    const portNum = orgSMTP.smtpPort
    const secure = portNum === 465 // SSL uses 465, TLS uses 587

    return {
      host: orgSMTP.smtpHost,
      port: portNum,
      secure,
      auth: {
        user: orgSMTP.smtpUser,
        pass: orgSMTP.smtpPassword,
      },
      senderEmail: orgSMTP.smtpFromEmail || orgSMTP.smtpUser,
      senderName: orgSMTP.smtpFromName || orgSMTP.name || 'Spin8 Studio',
    }
  }

  // Fallback to environment variables
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  const senderEmail = process.env.SMTP_FROM_EMAIL || user
  const senderName = process.env.SMTP_FROM_NAME || 'Spin8 Studio'

  // Check if all required SMTP config is present
  if (!host || !port || !user || !pass) {
    return null
  }

  const portNum = parseInt(port, 10)
  const secure = portNum === 465 // SSL uses 465, TLS uses 587

  return {
    host,
    port: portNum,
    secure,
    auth: {
      user,
      pass,
    },
    senderEmail: senderEmail!,
    senderName,
  }
}

// Create email transporter with organization-specific or fallback config
export function createEmailTransporter(orgSMTP?: OrganizationSMTPConfig | null) {
  const config = getSMTPConfig(orgSMTP)

  if (!config) {
    const source = orgSMTP ? 'organization settings' : 'environment variables'
    console.warn(`[EMAIL] SMTP not configured in ${source}. Configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.`)
    return null
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })

    console.log('[EMAIL] SMTP transporter created successfully:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      senderEmail: config.senderEmail,
    })

    return transporter
  } catch (error) {
    console.error('[EMAIL] Failed to create SMTP transporter:', error)
    return null
  }
}

// Send password reset email
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  userName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP)
  const config = getSMTPConfig(orgSMTP)

  if (!transporter || !config) {
    return {
      success: false,
      error: 'SMTP not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.',
    }
  }

  const greeting = userName ? `Hello ${userName},` : 'Hello,'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h1>
    
    <p>${greeting}</p>
    
    <p>You have requested to reset your password for your Spin8 Studio account. Click the button below to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Reset Password
      </a>
    </div>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
      <strong>Important:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      Best regards,<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `

  const text = `
Password Reset Request

${greeting}

You have requested to reset your password for your Spin8 Studio account.

Click this link to reset your password:
${resetLink}

This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
${config.senderName}
  `

  try {
    const info = await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to,
      subject: 'Password Reset - Spin8 Studio',
      text,
      html,
    })

    console.log('[EMAIL] Password reset email sent successfully:', {
      to,
      messageId: info.messageId,
    })

    return { success: true }
  } catch (error: any) {
    console.error('[EMAIL] Failed to send password reset email:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email',
    }
  }
}

// Verify SMTP connection (useful for testing)
export async function verifySMTPConnection(orgSMTP?: OrganizationSMTPConfig | null): Promise<boolean> {
  const transporter = createEmailTransporter(orgSMTP)

  if (!transporter) {
    return false
  }

  try {
    await transporter.verify()
    const source = orgSMTP ? 'organization settings' : 'environment variables'
    console.log(`[EMAIL] SMTP connection verified successfully (using ${source})`)
    return true
  } catch (error) {
    console.error('[EMAIL] SMTP connection verification failed:', error)
    return false
  }
}

// Export type for organization SMTP config
export type { OrganizationSMTPConfig }


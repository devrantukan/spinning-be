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
  language?: string | null // Organization language preference ('en' or 'tr')
}

// Email translations
const emailTranslations: Record<string, Record<string, string>> = {
  en: {
    passwordResetSubject: 'Password Reset - {orgName}',
    passwordResetTitle: 'Password Reset Request',
    passwordResetGreeting: 'Hello',
    passwordResetMessage: 'You have requested to reset your password for your {orgName} account. Click the button below to reset your password:',
    passwordResetButton: 'Reset Password',
    passwordResetOrCopy: 'Or copy and paste this link into your browser:',
    passwordResetExpiry: 'Important: This link will expire in 1 hour. If you didn\'t request this password reset, please ignore this email or contact support if you have concerns.',
    passwordResetBestRegards: 'Best regards',
    invitationSubject: 'Invitation to {orgName}',
    invitationTitle: 'You\'re Invited!',
    invitationGreeting: 'Hello',
    invitationMessage: 'You have been invited to join {orgName}. Click the button below to accept the invitation and set up your account:',
    invitationButton: 'Accept Invitation',
    invitationOrCopy: 'Or copy and paste this link into your browser:',
    invitationExpiry: 'Important: This invitation link will expire. If you didn\'t expect this invitation, please ignore this email or contact support if you have concerns.',
    invitationBestRegards: 'Best regards',
  },
  tr: {
    passwordResetSubject: 'Şifre Sıfırlama - {orgName}',
    passwordResetTitle: 'Şifre Sıfırlama Talebi',
    passwordResetGreeting: 'Merhaba',
    passwordResetMessage: '{orgName} hesabınız için şifre sıfırlama talebinde bulundunuz. Şifrenizi sıfırlamak için aşağıdaki düğmeye tıklayın:',
    passwordResetButton: 'Şifreyi Sıfırla',
    passwordResetOrCopy: 'Veya bu bağlantıyı tarayıcınıza kopyalayıp yapıştırın:',
    passwordResetExpiry: 'Önemli: Bu bağlantı 1 saat içinde sona erecektir. Bu şifre sıfırlama talebini siz yapmadıysanız, lütfen bu e-postayı görmezden gelin veya endişeleriniz varsa destek ile iletişime geçin.',
    passwordResetBestRegards: 'Saygılarımla',
    invitationSubject: '{orgName} Daveti',
    invitationTitle: 'Davet Edildiniz!',
    invitationGreeting: 'Merhaba',
    invitationMessage: '{orgName} katılmak için davet edildiniz. Daveti kabul etmek ve hesabınızı oluşturmak için aşağıdaki düğmeye tıklayın:',
    invitationButton: 'Daveti Kabul Et',
    invitationOrCopy: 'Veya bu bağlantıyı tarayıcınıza kopyalayıp yapıştırın:',
    invitationExpiry: 'Önemli: Bu davet bağlantısının süresi dolacaktır. Bu daveti beklemiyorsanız, lütfen bu e-postayı görmezden gelin veya endişeleriniz varsa destek ile iletişime geçin.',
    invitationBestRegards: 'Saygılarımla',
  },
}

// Get email text by language
function getEmailText(lang: string, key: string, orgName?: string): string {
  const language = lang === 'tr' ? 'tr' : 'en'
  const translations = emailTranslations[language] || emailTranslations.en
  let text = translations[key] || emailTranslations.en[key] || key
  if (orgName) {
    text = text.replace(/{orgName}/g, orgName)
  }
  return text
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
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates (for development)
      },
      // For port 587, require STARTTLS
      requireTLS: !config.secure && config.port === 587,
    })

    console.log('[EMAIL] SMTP transporter created successfully:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      authUser: config.auth.user, // Log username for debugging (password is never logged)
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

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || 'en'
  const greetingText = getEmailText(orgLanguage, 'passwordResetGreeting')
  const greeting = userName ? `${greetingText} ${userName},` : `${greetingText},`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailText(orgLanguage, 'passwordResetTitle')}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">${getEmailText(orgLanguage, 'passwordResetTitle')}</h1>
    
    <p>${greeting}</p>
    
    <p>${getEmailText(orgLanguage, 'passwordResetMessage', config.senderName)}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${getEmailText(orgLanguage, 'passwordResetButton')}
      </a>
    </div>
    
    <p>${getEmailText(orgLanguage, 'passwordResetOrCopy')}</p>
    <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
      <strong>${getEmailText(orgLanguage, 'passwordResetExpiry')}</strong>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${getEmailText(orgLanguage, 'passwordResetBestRegards')},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `

  const text = `
${getEmailText(orgLanguage, 'passwordResetTitle')}

${greeting}

${getEmailText(orgLanguage, 'passwordResetMessage', config.senderName)}

${getEmailText(orgLanguage, 'passwordResetOrCopy')}
${resetLink}

${getEmailText(orgLanguage, 'passwordResetExpiry')}

${getEmailText(orgLanguage, 'passwordResetBestRegards')},
${config.senderName}
  `

  try {
    const info = await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to,
      subject: getEmailText(orgLanguage, 'passwordResetSubject', config.senderName),
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
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to send email'
    
    if (error.responseCode === 535 || error.message?.includes('Authentication Failed') || error.message?.includes('Invalid login')) {
      errorMessage = 'SMTP Authentication Failed. Please check:'
      const issues = []
      
      if (orgSMTP) {
        issues.push('- Verify SMTP username and password in organization settings')
        issues.push('- For Zoho Mail: Use an App-Specific Password if 2FA is enabled')
        issues.push('- Ensure SMTP host is correct (smtp.zoho.com or smtp.zoho.eu)')
        issues.push('- Verify SMTP port (587 for TLS, 465 for SSL)')
      } else {
        issues.push('- Verify SMTP_USER and SMTP_PASSWORD environment variables')
        issues.push('- For Zoho Mail: Use an App-Specific Password if 2FA is enabled')
        issues.push('- Ensure SMTP_HOST is correct (smtp.zoho.com or smtp.zoho.eu)')
        issues.push('- Verify SMTP_PORT (587 for TLS, 465 for SSL)')
      }
      
      console.error('[EMAIL] Authentication troubleshooting:', issues.join('\n'))
      errorMessage += '\n' + issues.join('\n')
    }
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

// Send invitation email
export async function sendInvitationEmail(
  to: string,
  invitationLink: string,
  userName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP)
  const config = getSMTPConfig(orgSMTP)

  if (!transporter || !config) {
    return {
      success: false,
      error: 'SMTP not configured. Please configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.',
    }
  }

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || 'en'
  const greetingText = getEmailText(orgLanguage, 'invitationGreeting')
  const greeting = userName ? `${greetingText} ${userName},` : `${greetingText},`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailText(orgLanguage, 'invitationTitle')}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">${getEmailText(orgLanguage, 'invitationTitle')}</h1>
    
    <p>${greeting}</p>
    
    <p>${getEmailText(orgLanguage, 'invitationMessage', config.senderName)}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationLink}" 
         style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${getEmailText(orgLanguage, 'invitationButton')}
      </a>
    </div>
    
    <p>${getEmailText(orgLanguage, 'invitationOrCopy')}</p>
    <p style="word-break: break-all; color: #007bff;">${invitationLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
      <strong>${getEmailText(orgLanguage, 'invitationExpiry')}</strong>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${getEmailText(orgLanguage, 'invitationBestRegards')},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `

  const text = `
${getEmailText(orgLanguage, 'invitationTitle')}

${greeting}

${getEmailText(orgLanguage, 'invitationMessage', config.senderName)}

${getEmailText(orgLanguage, 'invitationOrCopy')}
${invitationLink}

${getEmailText(orgLanguage, 'invitationExpiry')}

${getEmailText(orgLanguage, 'invitationBestRegards')},
${config.senderName}
  `

  try {
    const info = await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to,
      subject: getEmailText(orgLanguage, 'invitationSubject', config.senderName),
      text,
      html,
    })

    console.log('[EMAIL] Invitation email sent successfully:', {
      to,
      messageId: info.messageId,
    })

    return { success: true }
  } catch (error: any) {
    console.error('[EMAIL] Failed to send invitation email:', error)
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


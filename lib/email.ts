import nodemailer from "nodemailer";

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  senderEmail: string;
  senderName: string;
}

// Organization SMTP config (from database)
interface OrganizationSMTPConfig {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  name?: string | null; // Organization name for fallback
  language?: string | null; // Organization language preference ('en' or 'tr')
}

// Email translations
const emailTranslations: Record<string, Record<string, string>> = {
  en: {
    passwordResetSubject: "Password Reset - {orgName}",
    passwordResetTitle: "Password Reset Request",
    passwordResetGreeting: "Hello",
    passwordResetMessage:
      "You have requested to reset your password for your {orgName} account. Click the button below to reset your password:",
    passwordResetButton: "Reset Password",
    passwordResetOrCopy: "Or copy and paste this link into your browser:",
    passwordResetExpiry:
      "Important: This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.",
    passwordResetBestRegards: "Best regards",
    invitationSubject: "Invitation to {orgName}",
    invitationTitle: "You're Invited!",
    invitationGreeting: "Hello",
    invitationMessage:
      "You have been invited to join {orgName}. Click the button below to accept the invitation and set up your account:",
    invitationButton: "Accept Invitation",
    invitationOrCopy: "Or copy and paste this link into your browser:",
    invitationExpiry:
      "Important: This invitation link will expire. If you didn't expect this invitation, please ignore this email or contact support if you have concerns.",
    invitationBestRegards: "Best regards",
    bookingCancellationSubject: "Booking Cancellation - {orgName}",
    bookingCancellationTitle: "Booking Cancellation Notice",
    bookingCancellationGreeting: "Hello",
    bookingCancellationMessage: "Your booking has been cancelled.",
    bookingCancellationDetails: "Cancelled Booking Details",
    bookingId: "Booking ID",
    className: "Class",
    sessionDate: "Date",
    sessionTime: "Time",
    location: "Location",
    instructor: "Instructor",
    paymentType: "Payment Type",
    credits: "Credits",
    allAccess: "All Access",
    friendPass: "Friend Pass",
    refundStatus: "Refund Status",
    refunded: "Credit has been refunded",
    notRefunded:
      "Credit was not refunded as session starts in less than 6 hours",
    bookingCancellationBestRegards: "Best regards",
    adminBookingCancellationSubject: "Booking Cancellation Notification",
    adminBookingCancellationTitle: "Booking Cancelled",
    adminBookingCancellationMessage: "A booking has been cancelled.",
    member: "Member",
    memberEmail: "Member Email",
    bookingConfirmationSubject: "Booking Confirmation - {orgName}",
    bookingConfirmationTitle: "Booking Confirmed",
    bookingConfirmationGreeting: "Hello",
    bookingConfirmationMessage: "Your booking has been confirmed successfully!",
    bookingConfirmationDetails: "Booking Details",
    seatNumber: "Bicycle",
    adminBookingConfirmationSubject: "New Booking Notification",
    adminBookingConfirmationTitle: "New Booking",
    adminBookingConfirmationMessage: "A new booking has been created.",
  },
  tr: {
    passwordResetSubject: "Şifre Sıfırlama - {orgName}",
    passwordResetTitle: "Şifre Sıfırlama Talebi",
    passwordResetGreeting: "Merhaba",
    passwordResetMessage:
      "{orgName} hesabınız için şifre sıfırlama talebinde bulundunuz. Şifrenizi sıfırlamak için aşağıdaki düğmeye tıklayın:",
    passwordResetButton: "Şifreyi Sıfırla",
    passwordResetOrCopy:
      "Veya bu bağlantıyı tarayıcınıza kopyalayıp yapıştırın:",
    passwordResetExpiry:
      "Önemli: Bu bağlantı 1 saat içinde sona erecektir. Bu şifre sıfırlama talebini siz yapmadıysanız, lütfen bu e-postayı görmezden gelin veya endişeleriniz varsa destek ile iletişime geçin.",
    passwordResetBestRegards: "Saygılarımla",
    invitationSubject: "{orgName} Daveti",
    invitationTitle: "Davet Edildiniz!",
    invitationGreeting: "Merhaba",
    invitationMessage:
      "{orgName} katılmak için davet edildiniz. Daveti kabul etmek ve hesabınızı oluşturmak için aşağıdaki düğmeye tıklayın:",
    invitationButton: "Daveti Kabul Et",
    invitationOrCopy: "Veya bu bağlantıyı tarayıcınıza kopyalayıp yapıştırın:",
    invitationExpiry:
      "Önemli: Bu davet bağlantısının süresi dolacaktır. Bu daveti beklemiyorsanız, lütfen bu e-postayı görmezden gelin veya endişeleriniz varsa destek ile iletişime geçin.",
    invitationBestRegards: "Saygılarımla",
    bookingCancellationSubject: "Rezervasyon İptali - {orgName}",
    bookingCancellationTitle: "Rezervasyon İptal Bildirimi",
    bookingCancellationGreeting: "Merhaba",
    bookingCancellationMessage: "Rezervasyonunuz iptal edilmiştir.",
    bookingCancellationDetails: "İptal Edilen Rezervasyon Detayları",
    bookingId: "Rezervasyon No",
    className: "Ders",
    sessionDate: "Tarih",
    sessionTime: "Saat",
    location: "Konum",
    instructor: "Eğitmen",
    paymentType: "Ödeme Türü",
    credits: "Kredi",
    allAccess: "All Access",
    friendPass: "Arkadaş Pası",
    refundStatus: "İade Durumu",
    refunded: "Kredi iade edildi",
    notRefunded:
      "Ders başlangıcına 6 saatten az kaldığı için kredi iade edilmedi",
    bookingCancellationBestRegards: "Saygılarımla",
    adminBookingCancellationSubject: "Rezervasyon İptali Bildirimi",
    adminBookingCancellationTitle: "Rezervasyon İptal Edildi",
    adminBookingCancellationMessage: "Bir rezervasyon iptal edilmiştir.",
    bookingConfirmationSubject: "Rezervasyon Onayı - {orgName}",
    bookingConfirmationTitle: "Rezervasyon Onaylandı",
    bookingConfirmationGreeting: "Merhaba",
    bookingConfirmationMessage: "Rezervasyonunuz başarıyla onaylandı!",
    bookingConfirmationDetails: "Rezervasyon Detayları",
    seatNumber: "Bisiklet",
    adminBookingConfirmationSubject: "Yeni Rezervasyon Bildirimi",
    adminBookingConfirmationTitle: "Yeni Rezervasyon",
    adminBookingConfirmationMessage: "Yeni bir rezervasyon oluşturuldu.",
    member: "Üye",
    memberEmail: "Üye E-postası",
  },
};

// Get email text by language
function getEmailText(lang: string, key: string, orgName?: string): string {
  const language = lang === "tr" ? "tr" : "en";
  const translations = emailTranslations[language] || emailTranslations.en;
  let text = translations[key] || emailTranslations.en[key] || key;
  if (orgName) {
    text = text.replace(/{orgName}/g, orgName);
  }
  return text;
}

// Get SMTP configuration from organization (preferred) or environment variables (fallback)
export function getSMTPConfig(
  orgSMTP?: OrganizationSMTPConfig | null
): SMTPConfig | null {
  // Priority: Organization SMTP > Environment Variables

  // Try organization SMTP first
  if (
    orgSMTP &&
    orgSMTP.smtpHost &&
    orgSMTP.smtpPort &&
    orgSMTP.smtpUser &&
    orgSMTP.smtpPassword
  ) {
    const portNum = orgSMTP.smtpPort;
    const secure = portNum === 465; // SSL uses 465, TLS uses 587

    return {
      host: orgSMTP.smtpHost,
      port: portNum,
      secure,
      auth: {
        user: orgSMTP.smtpUser,
        pass: orgSMTP.smtpPassword,
      },
      senderEmail: orgSMTP.smtpFromEmail || orgSMTP.smtpUser,
      senderName: orgSMTP.smtpFromName || orgSMTP.name || "Spin8 Studio",
    };
  }

  // Fallback to environment variables
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const senderEmail = process.env.SMTP_FROM_EMAIL || user;
  const senderName = process.env.SMTP_FROM_NAME || "Spin8 Studio";

  // Check if all required SMTP config is present
  if (!host || !port || !user || !pass) {
    return null;
  }

  const portNum = parseInt(port, 10);
  const secure = portNum === 465; // SSL uses 465, TLS uses 587

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
  };
}

// Create email transporter with organization-specific or fallback config
export function createEmailTransporter(
  orgSMTP?: OrganizationSMTPConfig | null
) {
  const config = getSMTPConfig(orgSMTP);

  if (!config) {
    const source = orgSMTP ? "organization settings" : "environment variables";
    console.warn(
      `[EMAIL] SMTP not configured in ${source}. Configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.`
    );
    return null;
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
    });

    console.log("[EMAIL] SMTP transporter created successfully:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      authUser: config.auth.user, // Log username for debugging (password is never logged)
    });

    return transporter;
  } catch (error) {
    console.error("[EMAIL] Failed to create SMTP transporter:", error);
    return null;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  userName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP);
  const config = getSMTPConfig(orgSMTP);

  if (!transporter || !config) {
    return {
      success: false,
      error:
        "SMTP not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.",
    };
  }

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || "en";
  const greetingText = getEmailText(orgLanguage, "passwordResetGreeting");
  const greeting = userName
    ? `${greetingText} ${userName},`
    : `${greetingText},`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailText(orgLanguage, "passwordResetTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">${getEmailText(
      orgLanguage,
      "passwordResetTitle"
    )}</h1>
    
    <p>${greeting}</p>
    
    <p>${getEmailText(
      orgLanguage,
      "passwordResetMessage",
      config.senderName
    )}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${getEmailText(orgLanguage, "passwordResetButton")}
      </a>
    </div>
    
    <p>${getEmailText(orgLanguage, "passwordResetOrCopy")}</p>
    <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
      <strong>${getEmailText(orgLanguage, "passwordResetExpiry")}</strong>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${getEmailText(orgLanguage, "passwordResetBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  const text = `
${getEmailText(orgLanguage, "passwordResetTitle")}

${greeting}

${getEmailText(orgLanguage, "passwordResetMessage", config.senderName)}

${getEmailText(orgLanguage, "passwordResetOrCopy")}
${resetLink}

${getEmailText(orgLanguage, "passwordResetExpiry")}

${getEmailText(orgLanguage, "passwordResetBestRegards")},
${config.senderName}
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to,
      subject: getEmailText(
        orgLanguage,
        "passwordResetSubject",
        config.senderName
      ),
      text,
      html,
    });

    console.log("[EMAIL] Password reset email sent successfully:", {
      to,
      messageId: info.messageId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL] Failed to send password reset email:", error);

    // Provide more helpful error messages
    let errorMessage = error.message || "Failed to send email";

    if (
      error.responseCode === 535 ||
      error.message?.includes("Authentication Failed") ||
      error.message?.includes("Invalid login")
    ) {
      errorMessage = "SMTP Authentication Failed. Please check:";
      const issues = [];

      if (orgSMTP) {
        issues.push(
          "- Verify SMTP username and password in organization settings"
        );
        issues.push(
          "- For Zoho Mail: Use an App-Specific Password if 2FA is enabled"
        );
        issues.push(
          "- Ensure SMTP host is correct (smtp.zoho.com or smtp.zoho.eu)"
        );
        issues.push("- Verify SMTP port (587 for TLS, 465 for SSL)");
      } else {
        issues.push(
          "- Verify SMTP_USER and SMTP_PASSWORD environment variables"
        );
        issues.push(
          "- For Zoho Mail: Use an App-Specific Password if 2FA is enabled"
        );
        issues.push(
          "- Ensure SMTP_HOST is correct (smtp.zoho.com or smtp.zoho.eu)"
        );
        issues.push("- Verify SMTP_PORT (587 for TLS, 465 for SSL)");
      }

      console.error(
        "[EMAIL] Authentication troubleshooting:",
        issues.join("\n")
      );
      errorMessage += "\n" + issues.join("\n");
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Send invitation email
export async function sendInvitationEmail(
  to: string,
  invitationLink: string,
  userName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP);
  const config = getSMTPConfig(orgSMTP);

  if (!transporter || !config) {
    return {
      success: false,
      error:
        "SMTP not configured. Please configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.",
    };
  }

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || "en";
  const greetingText = getEmailText(orgLanguage, "invitationGreeting");
  const greeting = userName
    ? `${greetingText} ${userName},`
    : `${greetingText},`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailText(orgLanguage, "invitationTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2c3e50; margin-top: 0;">${getEmailText(
      orgLanguage,
      "invitationTitle"
    )}</h1>
    
    <p>${greeting}</p>
    
    <p>${getEmailText(orgLanguage, "invitationMessage", config.senderName)}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationLink}" 
         style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${getEmailText(orgLanguage, "invitationButton")}
      </a>
    </div>
    
    <p>${getEmailText(orgLanguage, "invitationOrCopy")}</p>
    <p style="word-break: break-all; color: #007bff;">${invitationLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
      <strong>${getEmailText(orgLanguage, "invitationExpiry")}</strong>
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${getEmailText(orgLanguage, "invitationBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  const text = `
${getEmailText(orgLanguage, "invitationTitle")}

${greeting}

${getEmailText(orgLanguage, "invitationMessage", config.senderName)}

${getEmailText(orgLanguage, "invitationOrCopy")}
${invitationLink}

${getEmailText(orgLanguage, "invitationExpiry")}

${getEmailText(orgLanguage, "invitationBestRegards")},
${config.senderName}
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to,
      subject: getEmailText(
        orgLanguage,
        "invitationSubject",
        config.senderName
      ),
      text,
      html,
    });

    console.log("[EMAIL] Invitation email sent successfully:", {
      to,
      messageId: info.messageId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL] Failed to send invitation email:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

// Verify SMTP connection (useful for testing)
export async function verifySMTPConnection(
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<boolean> {
  const transporter = createEmailTransporter(orgSMTP);

  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    const source = orgSMTP ? "organization settings" : "environment variables";
    console.log(
      `[EMAIL] SMTP connection verified successfully (using ${source})`
    );
    return true;
  } catch (error) {
    console.error("[EMAIL] SMTP connection verification failed:", error);
    return false;
  }
}

// Send booking cancellation emails (to member and admin)
export async function sendBookingCancellationEmails(
  memberEmail: string,
  adminEmail: string,
  bookingDetails: {
    bookingId: string;
    className?: string;
    classNameTr?: string;
    sessionDate: string;
    sessionTime: string;
    location?: string;
    instructor?: string;
    paymentType?: string;
    creditsUsed?: number;
    creditRefunded: boolean;
  },
  memberName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP);
  const config = getSMTPConfig(orgSMTP);

  if (!transporter || !config) {
    return {
      success: false,
      error:
        "SMTP not configured. Please configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.",
    };
  }

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || "en";
  const t = (key: string) => getEmailText(orgLanguage, key, config.senderName);

  const greetingText = t("bookingCancellationGreeting");
  const greeting = memberName
    ? `${greetingText} ${memberName},`
    : `${greetingText},`;

  // Format payment type
  const formatPaymentType = (type?: string): string => {
    if (!type) return "-";
    if (orgLanguage === "tr") {
      switch (type) {
        case "CREDITS":
          return "Kredi";
        case "ALL_ACCESS":
          return "All Access";
        case "FRIEND_PASS":
          return "Arkadaş Pası";
        default:
          return type;
      }
    } else {
      switch (type) {
        case "CREDITS":
          return "Credits";
        case "ALL_ACCESS":
          return "All Access";
        case "FRIEND_PASS":
          return "Friend Pass";
        default:
          return type;
      }
    }
  };

  const className =
    orgLanguage === "tr" && bookingDetails.classNameTr
      ? bookingDetails.classNameTr
      : bookingDetails.className || "-";

  // Member email HTML
  const memberEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t("bookingCancellationTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #d32f2f; margin-top: 0;">${t(
      "bookingCancellationTitle"
    )}</h1>
    
    <p>${greeting}</p>
    
    <p>${t("bookingCancellationMessage")}</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
      <h2 style="margin-top: 0; color: #333;">${t(
        "bookingCancellationDetails"
      )}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">${t(
            "bookingId"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.bookingId
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "className"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionDate"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionDate
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionTime"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionTime
          }</td>
        </tr>
        ${
          bookingDetails.location
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "location"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.location
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.instructor
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "instructor"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.instructor
          }</td>
        </tr>
        `
            : ""
        }
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "paymentType"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${formatPaymentType(
            bookingDetails.paymentType
          )}</td>
        </tr>
        ${
          bookingDetails.paymentType === "CREDITS" && bookingDetails.creditsUsed
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "credits"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.creditsUsed
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.paymentType === "CREDITS"
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "refundStatus"
          )}:</td>
          <td style="padding: 8px 0; color: ${
            bookingDetails.creditRefunded ? "#388e3c" : "#d32f2f"
          };">
            ${bookingDetails.creditRefunded ? t("refunded") : t("notRefunded")}
          </td>
        </tr>
        `
            : ""
        }
      </table>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${t("bookingCancellationBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  // Admin email HTML
  const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t("adminBookingCancellationTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #f57c00; margin-top: 0;">${t(
      "adminBookingCancellationTitle"
    )}</h1>
    
    <p>${t("adminBookingCancellationMessage")}</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f57c00;">
      <h2 style="margin-top: 0; color: #333;">${t(
        "bookingCancellationDetails"
      )}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">${t(
            "bookingId"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.bookingId
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "member"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${memberName || "-"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "memberEmail"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${memberEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "className"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionDate"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionDate
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionTime"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionTime
          }</td>
        </tr>
        ${
          bookingDetails.location
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "location"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.location
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.instructor
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "instructor"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.instructor
          }</td>
        </tr>
        `
            : ""
        }
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "paymentType"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${formatPaymentType(
            bookingDetails.paymentType
          )}</td>
        </tr>
        ${
          bookingDetails.paymentType === "CREDITS" && bookingDetails.creditsUsed
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "credits"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.creditsUsed
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.paymentType === "CREDITS"
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "refundStatus"
          )}:</td>
          <td style="padding: 8px 0; color: ${
            bookingDetails.creditRefunded ? "#388e3c" : "#d32f2f"
          };">
            ${bookingDetails.creditRefunded ? t("refunded") : t("notRefunded")}
          </td>
        </tr>
        `
            : ""
        }
      </table>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${t("bookingCancellationBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  try {
    // Send emails in parallel
    const emailPromises = [
      transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: memberEmail,
        subject: t("bookingCancellationSubject"),
        html: memberEmailHtml,
        text: memberEmailHtml.replace(/<[^>]*>/g, ""),
      }),
      transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: adminEmail,
        subject: t("adminBookingCancellationSubject"),
        html: adminEmailHtml,
        text: adminEmailHtml.replace(/<[^>]*>/g, ""),
      }),
    ];

    await Promise.all(emailPromises);

    console.log("[EMAIL] Booking cancellation emails sent successfully:", {
      memberEmail,
      adminEmail,
      bookingId: bookingDetails.bookingId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL] Failed to send booking cancellation emails:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

// Send booking confirmation emails (to member and admin)
export async function sendBookingConfirmationEmails(
  memberEmail: string,
  adminEmail: string,
  bookingDetails: {
    bookingId: string;
    className?: string;
    classNameTr?: string;
    sessionDate: string;
    sessionTime: string;
    location?: string;
    instructor?: string;
    paymentType?: string;
    creditsUsed?: number;
    seatNumber?: string;
  },
  memberName?: string,
  orgSMTP?: OrganizationSMTPConfig | null
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter(orgSMTP);
  const config = getSMTPConfig(orgSMTP);

  if (!transporter || !config) {
    return {
      success: false,
      error:
        "SMTP not configured. Please configure SMTP in organization settings or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment variables.",
    };
  }

  // Get organization language (default to 'en')
  const orgLanguage = orgSMTP?.language || "en";
  const t = (key: string) => getEmailText(orgLanguage, key, config.senderName);

  const greetingText = t("bookingConfirmationGreeting");
  const greeting = memberName
    ? `${greetingText} ${memberName},`
    : `${greetingText},`;

  // Format payment type
  const formatPaymentType = (type?: string): string => {
    if (!type) return "-";
    if (orgLanguage === "tr") {
      switch (type) {
        case "CREDITS":
          return "Kredi";
        case "ALL_ACCESS":
          return "All Access";
        case "FRIEND_PASS":
          return "Arkadaş Pası";
        default:
          return type;
      }
    } else {
      switch (type) {
        case "CREDITS":
          return "Credits";
        case "ALL_ACCESS":
          return "All Access";
        case "FRIEND_PASS":
          return "Friend Pass";
        default:
          return type;
      }
    }
  };

  const className =
    orgLanguage === "tr" && bookingDetails.classNameTr
      ? bookingDetails.classNameTr
      : bookingDetails.className || "-";

  // Member email HTML
  const memberEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t("bookingConfirmationTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #388e3c; margin-top: 0;">${t(
      "bookingConfirmationTitle"
    )}</h1>
    
    <p>${greeting}</p>
    
    <p>${t("bookingConfirmationMessage")}</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #388e3c;">
      <h2 style="margin-top: 0; color: #333;">${t(
        "bookingConfirmationDetails"
      )}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">${t(
            "bookingId"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.bookingId
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "className"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionDate"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionDate
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionTime"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionTime
          }</td>
        </tr>
        ${
          bookingDetails.location
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "location"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.location
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.instructor
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "instructor"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.instructor
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.seatNumber
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "seatNumber"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.seatNumber
          }</td>
        </tr>
        `
            : ""
        }
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "paymentType"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${formatPaymentType(
            bookingDetails.paymentType
          )}</td>
        </tr>
        ${
          bookingDetails.paymentType === "CREDITS" && bookingDetails.creditsUsed
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "credits"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.creditsUsed
          }</td>
        </tr>
        `
            : ""
        }
      </table>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${t("bookingCancellationBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  // Admin email HTML
  const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t("adminBookingConfirmationTitle")}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1976d2; margin-top: 0;">${t(
      "adminBookingConfirmationTitle"
    )}</h1>
    
    <p>${t("adminBookingConfirmationMessage")}</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1976d2;">
      <h2 style="margin-top: 0; color: #333;">${t(
        "bookingConfirmationDetails"
      )}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">${t(
            "bookingId"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.bookingId
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "member"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${memberName || "-"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "memberEmail"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${memberEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "className"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${className}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionDate"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionDate
          }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "sessionTime"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.sessionTime
          }</td>
        </tr>
        ${
          bookingDetails.location
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "location"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.location
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.instructor
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "instructor"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.instructor
          }</td>
        </tr>
        `
            : ""
        }
        ${
          bookingDetails.seatNumber
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "seatNumber"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.seatNumber
          }</td>
        </tr>
        `
            : ""
        }
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "paymentType"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${formatPaymentType(
            bookingDetails.paymentType
          )}</td>
        </tr>
        ${
          bookingDetails.paymentType === "CREDITS" && bookingDetails.creditsUsed
            ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #666;">${t(
            "credits"
          )}:</td>
          <td style="padding: 8px 0; color: #333;">${
            bookingDetails.creditsUsed
          }</td>
        </tr>
        `
            : ""
        }
      </table>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      ${t("bookingCancellationBestRegards")},<br>
      ${config.senderName}
    </p>
  </div>
</body>
</html>
  `;

  try {
    // Send emails in parallel
    const emailPromises = [
      transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: memberEmail,
        subject: t("bookingConfirmationSubject").replace(
          "{orgName}",
          config.senderName
        ),
        html: memberEmailHtml,
        text: memberEmailHtml.replace(/<[^>]*>/g, ""),
      }),
      transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: adminEmail,
        subject: t("adminBookingConfirmationSubject"),
        html: adminEmailHtml,
        text: adminEmailHtml.replace(/<[^>]*>/g, ""),
      }),
    ];

    await Promise.all(emailPromises);

    console.log("[EMAIL] Booking confirmation emails sent successfully:", {
      memberEmail,
      adminEmail,
      bookingId: bookingDetails.bookingId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL] Failed to send booking confirmation emails:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

// Export type for organization SMTP config
export type { OrganizationSMTPConfig };

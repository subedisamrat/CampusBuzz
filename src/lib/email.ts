import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function buildEmailHtml({
  title,
  preheader,
  greeting,
  body,
  qrCodeDataUrl,
  registrationId,
  ctaUrl,
  ctaLabel,
  footerNote,
}: {
  title: string;
  preheader: string;
  greeting: string;
  body: string;
  qrCodeDataUrl?: string;
  registrationId?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="max-width:560px;width:100%;background-color:#ffffff;
                      border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);
                       padding:32px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);
                            border-radius:10px;display:flex;align-items:center;
                            justify-content:center;font-size:20px;">🎓</div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;
                             letter-spacing:-0.5px;">CampusBuzz</span>
              </div>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">
                Campus Event Management Platform
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;
                         color:#0f172a;letter-spacing:-0.5px;">
                ${title}
              </h1>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;">${greeting}</p>
              <div style="color:#334155;font-size:15px;line-height:1.6;">
                ${body}
              </div>
              ${qrCodeDataUrl ? `
              <div style="margin:28px 0;padding:24px;background:#f8fafc;
                          border-radius:12px;border:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0 0 12px;font-size:13px;color:#64748b;font-weight:500;">
                  Your Entry QR Code
                </p>
                <div style="display:inline-block;background:#ffffff;padding:12px;
                            border-radius:10px;border:1px solid #e2e8f0;">
                  <img src="${qrCodeDataUrl}" alt="Entry QR Code"
                       width="180" height="180"
                       style="display:block;width:180px;height:180px;" />
                </div>
                ${registrationId ? `
                <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;
                           font-family:monospace;letter-spacing:1px;">
                  ${registrationId}
                </p>` : ''}
                <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                  Show this at the entrance for check-in
                </p>
              </div>
              ` : ''}
              ${ctaUrl && ctaLabel ? `
              <div style="margin:24px 0;text-align:center;">
                <a href="${ctaUrl}"
                   style="display:inline-block;background:#14b8a6;color:#ffffff;
                          padding:14px 32px;border-radius:10px;text-decoration:none;
                          font-weight:600;font-size:15px;">
                  ${ctaLabel}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;
                         line-height:1.6;">
                ${footerNote ?? 'This is an automated message from CampusBuzz. Please do not reply to this email.'}
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#cbd5e1;text-align:center;">
                &copy; ${new Date().getFullYear()} CampusBuzz &middot; Campus Event Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function sendRegistrationEmail({
  to, name, eventName, eventDate, eventVenue, qrCodeDataUrl, registrationId,
}: {
  to: string; name: string; eventName: string;
  eventDate: string; eventVenue: string;
  qrCodeDataUrl: string; registrationId: string;
}) {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Your ticket for ${eventName} 🎫`,
      html: buildEmailHtml({
        title: "You're registered!",
        preheader: `Your ticket for ${eventName} is ready`,
        greeting: `Hi ${name},`,
        body: `
          <p>Great news — your registration for <strong>${eventName}</strong> is confirmed.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;">📅 Date</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 Venue</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventVenue}</td>
            </tr>
          </table>
        `,
        qrCodeDataUrl,
        registrationId,
        footerNote: 'Show the QR code above at the event entrance. This ticket is non-transferable.',
      }),
    });
  } catch (err) {
    console.error('[Email] sendRegistrationEmail failed:', err);
  }
}

export async function sendPaymentConfirmation({
  to, name, eventName, amount, provider, transactionId, qrCodeDataUrl, registrationId,
}: {
  to: string; name: string; eventName: string;
  amount: number; provider: string; transactionId: string;
  qrCodeDataUrl: string; registrationId: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Payment Confirmed – ${eventName} 💳`,
      html: buildEmailHtml({
        title: 'Payment confirmed!',
        preheader: `Your payment for ${eventName} is confirmed`,
        greeting: `Hi ${name},`,
        body: `
          <p>Your payment for <strong>${eventName}</strong> has been confirmed!</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:120px;">💰 Amount</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">NPR ${amount}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">🏦 Provider</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${provider}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">🔖 Transaction</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${transactionId}</td>
            </tr>
          </table>
        `,
        qrCodeDataUrl,
        registrationId,
      }),
    });
  } catch (err) {
    console.error('[Email] sendPaymentConfirmation failed:', err);
  }
}

export async function sendPromotionEmail({
  to, name, eventName, eventDate, eventVenue, qrCodeDataUrl, registrationId,
}: {
  to: string; name: string; eventName: string;
  eventDate: string; eventVenue: string;
  qrCodeDataUrl: string; registrationId: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `You're in! A spot opened up — ${eventName}`,
      html: buildEmailHtml({
        title: "You're in! A spot opened up",
        preheader: `Great news! You're off the waitlist for ${eventName}`,
        greeting: `Hi ${name},`,
        body: `
          <p>A spot opened up and you've been promoted from the waitlist for <strong>${eventName}</strong>.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;">📅 Date</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 Venue</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventVenue}</td>
            </tr>
          </table>
        `,
        qrCodeDataUrl,
        registrationId,
      }),
    });
  } catch (err) {
    console.error('[Email] sendPromotionEmail failed:', err);
  }
}

export async function sendCancellationEmail({
  to, name, eventName, cancelReason,
}: {
  to: string; name: string; eventName: string; cancelReason: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Event Cancelled – ${eventName}`,
      html: buildEmailHtml({
        title: 'Event Cancelled',
        preheader: `${eventName} has been cancelled`,
        greeting: `Hi ${name},`,
        body: `
          <p>We regret to inform you that <strong>${eventName}</strong> has been cancelled.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:24px 0;">
            <p style="margin:0 0 8px;color:#991b1b;font-weight:600;">📋 Reason:</p>
            <p style="margin:0;color:#991b1b;">${cancelReason || 'No reason provided'}</p>
          </div>
          <p style="color:#64748b;font-size:14px;">If you made a payment for this event, a refund will be processed. Please allow 5–7 business days for the amount to reflect in your account.</p>
        `,
        footerNote: 'We apologise for any inconvenience. Keep an eye on CampusBuzz for upcoming events.',
      }),
    });
  } catch (err) {
    console.error('[Email] sendCancellationEmail failed:', err);
  }
}

export async function sendRefundConfirmation({
  to, name, eventName, amount, provider,
}: {
  to: string; name: string; eventName: string; amount: number; provider: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Refund Processed – ${eventName}`,
      html: buildEmailHtml({
        title: 'Refund Processed',
        preheader: `Your refund for ${eventName} has been processed`,
        greeting: `Hi ${name},`,
        body: `
          <p>Your refund for <strong>${eventName}</strong> has been processed.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:120px;">💰 Refunded Amount</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">NPR ${amount}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">🏦 Provider</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${provider}</td>
            </tr>
          </table>
          <p style="color:#64748b;font-size:14px;">Please allow 5–7 business days for the amount to reflect in your account.</p>
        `,
        footerNote: 'We apologise for any inconvenience. We hope to see you at future events on CampusBuzz.',
      }),
    });
  } catch (err) {
    console.error('[Email] sendRefundConfirmation failed:', err);
  }
}

// ── Attendance confirmation email (free events, 24h before) ──────────────────
export async function sendAttendanceConfirmation({
  to, name, eventName, eventDate, eventVenue, confirmUrl, confirmWindowHours,
}: {
  to: string; name: string; eventName: string;
  eventDate: string; eventVenue: string; confirmUrl: string;
  confirmWindowHours: number;
}): Promise<void> {
  try {
    const hoursLabel = confirmWindowHours >= 24
      ? `${Math.round(confirmWindowHours / 24)} days`
      : `${confirmWindowHours} hours`;
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Confirm your attendance — ${eventName}`,
      html: buildEmailHtml({
        title: 'Confirm Your Attendance',
        preheader: `Action required — confirm your spot for ${eventName}`,
        greeting: `Hi ${name},`,
        body: `
          <p>Your event <strong>${eventName}</strong> is <strong>tomorrow</strong>. Please confirm you're still attending.</p>
          <p style="color:#f59e0b;font-size:14px;">⏰ If you don't confirm within <strong>${hoursLabel}</strong>, your spot will be released to the next person on the waitlist.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;">📅 Date</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 Venue</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventVenue}</td>
            </tr>
          </table>
        `,
        ctaUrl: confirmUrl,
        ctaLabel: "✅ Yes, I'm attending",
      }),
    });
  } catch (err) {
    console.error('[Email] sendAttendanceConfirmation failed:', err);
  }
}

// ── Capacity increase notification (paid events) ─────────────────────────────
export async function sendCapacityIncreaseNotification({
  to, name, eventName, eventDate, eventVenue, eventUrl, eventId, feeAmount,
}: {
  to: string; name: string; eventName: string;
  eventDate: string; eventVenue: string; eventUrl: string;
  eventId: string; feeAmount: number;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: `CampusBuzz <${process.env.EMAIL_USER}>`,
      to,
      subject: `Spots Available — ${eventName}`,
      html: buildEmailHtml({
        title: 'A spot opened up!',
        preheader: `Good news — a spot is available for ${eventName}`,
        greeting: `Hi ${name},`,
        body: `
          <p>Good news — a spot has become available for an event you expressed interest in.</p>
          <table style="width:100%;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;">📅 Date</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 Venue</td>
              <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventVenue}</td>
            </tr>
          </table>
          <p>Spots fill quickly. Register now before this one is taken.</p>
        `,
        ctaUrl: eventUrl,
        ctaLabel: 'Register Now',
        footerNote: 'If you no longer want notifications for this event, you can remove your interest from the event page.',
      }),
    });
  } catch (err) {
    console.error('[Email] sendCapacityIncreaseNotification failed:', err);
  }
}

// ── 24h event reminder email ──────────────────────────────────────────────────
export async function sendEventReminderEmail(params: {
  to: string; name: string; eventName: string;
  eventDate: string; eventVenue: string;
  qrCodeDataUrl: string; registrationId: string; eventUrl: string;
}): Promise<void> {
  const { to, name, eventName, eventDate, eventVenue,
          qrCodeDataUrl, registrationId, eventUrl } = params;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
    to,
    subject: `Reminder — ${eventName} is tomorrow`,
    html: buildEmailHtml({
      title: 'See you tomorrow! 🎉',
      preheader: `Reminder: ${eventName} is tomorrow`,
      greeting: `Hi ${name},`,
      body: `
        <p>This is a reminder for your upcoming event.</p>
        <table style="width:100%;margin:16px 0;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;width:100px;">📅 Date</td>
            <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">📍 Venue</td>
            <td style="padding:8px 0;font-weight:500;color:#0f172a;">${eventVenue}</td>
          </tr>
        </table>
      `,
      qrCodeDataUrl,
      registrationId,
      ctaUrl: eventUrl,
      ctaLabel: 'View Event Details',
      footerNote: 'If you can no longer attend, please cancel your registration so others on the waitlist can take your spot.',
    }),
  });
}

// ── Capacity alert email to admin ─────────────────────────────────────────────
export async function sendCapacityAlertEmail(params: {
  adminEmail: string; eventName: string; eventDate: string;
  registeredCount: number; capacity: number; fillPercent: number;
  waitlistCount: number; eventAdminUrl: string;
}): Promise<void> {
  const { adminEmail, eventName, eventDate, registeredCount,
          capacity, fillPercent, waitlistCount, eventAdminUrl } = params;

  const isFull = fillPercent >= 100;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
    to: adminEmail,
    subject: isFull
      ? `Event Full — ${eventName}`
      : `${fillPercent}% Full — ${eventName}`,
    html: buildEmailHtml({
      title: isFull ? 'Event is Full! 🎉' : `${fillPercent}% Capacity Reached`,
      preheader: `Capacity alert for ${eventName}`,
      greeting: 'Hi Admin,',
      body: `
        <p><strong>${eventName}</strong></p>
        <p style="color:#64748b;font-size:14px;">${eventDate}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 4px;font-size:15px;">
            Registered: <strong>${registeredCount}</strong> / ${capacity}
          </p>
          ${isFull && waitlistCount > 0
            ? `<p style="margin:4px 0 0;font-size:14px;color:#64748b;">Waitlist: <strong>${waitlistCount}</strong> students waiting</p>`
            : ''}
        </div>
        <p style="color:#64748b;">
          ${isFull
            ? 'Consider increasing capacity if the venue allows.'
            : 'Your event is filling up. Consider expanding capacity if needed.'}
        </p>
      `,
      ctaUrl: eventAdminUrl,
      ctaLabel: 'View Event',
    }),
  });
}

export async function sendSpotReleasedEmail(params: {
  to: string; name: string; eventName: string;
  eventDate: string; eventUrl: string;
  reason: 'token_expired' | 'admin_cancelled' | 'manual_cancel';
}): Promise<void> {
  const reasonText = {
    token_expired: 'You did not confirm your registration within the required time window.',
    admin_cancelled: 'The event organiser cancelled the event.',
    manual_cancel: 'You cancelled your registration.',
  }[params.reason];

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
    to: params.to,
    subject: `Registration Released — ${params.eventName}`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;
                  background:#ffffff;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f766e,#14b8a6);
                    padding:32px;text-align:center;">
          <span style="color:#fff;font-size:22px;font-weight:700;">CampusBuzz</span>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 16px;">
            Your registration was released
          </h2>
          <div style="background:#fef9c3;border:1px solid #fde047;
                      border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#713f12;font-weight:600;margin:0 0 4px;">${params.eventName}</p>
            <p style="color:#713f12;font-size:13px;margin:0;">${params.eventDate}</p>
            <p style="color:#854d0e;font-size:13px;margin:8px 0 0;">${reasonText}</p>
          </div>
          <p style="color:#334155;font-size:14px;margin-bottom:20px;">
            If spots are still available, you can register again.
          </p>
          <a href="${params.eventUrl}"
             style="display:inline-block;background:#14b8a6;color:#fff;
                    padding:12px 24px;border-radius:10px;text-decoration:none;
                    font-weight:600;">
            View Event
          </a>
        </div>
        <div style="padding:16px 32px;background:#f8fafc;text-align:center;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">© 2025 CampusBuzz</p>
        </div>
      </div>
    `,
  });
}

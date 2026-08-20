/**
 * Shared utilities for QR code generation and registration ID creation.
 * Eliminates duplication across waitlistManager, payment, and confirm-attendance routes.
 */

import QRCode from 'qrcode';
import crypto from 'crypto';

const QR_OPTIONS = { width: 300, margin: 2, errorCorrectionLevel: 'H' as const };

/**
 * Generates a unique registration ID with the CP- prefix.
 * Format: CP-XXXXXXXXXXXXXXXX (16 hex chars)
 */
export function generateRegistrationId(): string {
  return `CP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Generates a QR code data URL containing the registration details.
 */
export async function generateQRCode(
  registrationId: string,
  eventId: string,
  userId: string
): Promise<string> {
  const qrData = JSON.stringify({ registrationId, eventId, userId });
  return QRCode.toDataURL(qrData, QR_OPTIONS);
}

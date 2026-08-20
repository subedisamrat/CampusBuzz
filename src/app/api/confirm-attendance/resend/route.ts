import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';
import User from '@/models/User';
import { TIER_CONFIG } from '@/lib/constants';
import { sendAttendanceConfirmation } from '@/lib/email';

// Simple in-memory cooldown: 1 resend per registration per hour
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupCooldowns() {
  const now = Date.now();
  if (now - lastCleanup < COOLDOWN_MS) return;
  lastCleanup = now;
  for (const [key, time] of cooldowns.entries()) {
    if (now - time > COOLDOWN_MS) cooldowns.delete(key);
  }
}

export async function POST(req: Request) {
  try {
    cleanupCooldowns();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await dbConnect();
    const { registrationId } = await req.json();

    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId required' }, { status: 400 });
    }

    // Check cooldown
    const lastResent = cooldowns.get(registrationId);
    if (lastResent && Date.now() - lastResent < 60 * 60 * 1000) {
      const minutesLeft = Math.ceil(
        (60 * 60 * 1000 - (Date.now() - lastResent)) / 60000
      );
      return NextResponse.json({
        error: `Please wait ${minutesLeft} more minute${minutesLeft > 1 ? 's' : ''} before requesting another resend.`,
      }, { status: 429 });
    }

    // Find registration — must belong to current user
    const registration = await Registration.findOne({
      registrationId,
      userId: session.user.id,
    }).populate('eventId', 'title date venue').lean();

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    if ((registration as any).confirmed) {
      return NextResponse.json({ error: 'Registration already confirmed' }, { status: 409 });
    }
    if (!(registration as any).confirmationEmailSent) {
      return NextResponse.json({
        error: 'Admin has not sent your confirmation email yet.',
        code: 'CONFIRMATION_NOT_SENT',
      }, { status: 403 });
    }
    if (!(registration as any).confirmToken) {
      return NextResponse.json({
        error: 'Confirmation token not found. Please contact admin.',
      }, { status: 400 });
    }

    // Reset expiry to 48 hours from now
    await Registration.findOneAndUpdate(
      { registrationId },
      { confirmTokenExpiry: new Date(Date.now() + 48 * 60 * 60 * 1000) }
    );

    const event = (registration as any).eventId;
    const confirmUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/confirm-attendance?token=${(registration as any).confirmToken}`;

    // Fetch user for tier-based window
    const resendUser = await User.findById(session.user.id).select('engagementTier').lean() as any;
    const resendTier = (resendUser?.engagementTier ?? 'new') as keyof typeof TIER_CONFIG;
    const tierCfg = TIER_CONFIG[resendTier] ?? TIER_CONFIG.new;

    void sendAttendanceConfirmation({
      to: session.user.email ?? '',
      name: session.user.name ?? 'Student',
      eventName: event.title,
      eventDate: new Date(event.date).toLocaleDateString('en-NP', { dateStyle: 'full' } as any),
      eventVenue: event.venue,
      confirmUrl,
      confirmWindowHours: tierCfg.confirmationWindowHours,
    }).catch(err => console.error('[Email] Resend confirmation failed:', err));

    cooldowns.set(registrationId, Date.now());

    return NextResponse.json({
      success: true,
      message: 'Confirmation email resent. Check your inbox and spam folder.',
    });
  } catch (err) {
    console.error('[POST /api/confirm-attendance/resend]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

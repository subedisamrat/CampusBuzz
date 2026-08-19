import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';
import { rateLimit } from '@/lib/rateLimit';
import { extractFeatures } from '@/lib/ml/checkinFeatures';
import { getModel, recordCheckin } from '@/lib/ml/modelManager';
import { updateStudentReliability, maybeRetrain } from '@/lib/ml/reliabilityScoring';
import { generateFlagReason } from '@/lib/ml/flagReasoning';
import { ML_THRESHOLDS } from '@/lib/constants';

function heuristicAnomalyScore(params: {
  hourOfDay: number;
  minutesRelativeToStart: number;
  daysSinceReg: number;
}): number {
  let score = 0;
  if (params.minutesRelativeToStart < -60) score += 0.5;
  else if (params.minutesRelativeToStart < 0) score += 0.25;
  if (params.hourOfDay >= 1 && params.hourOfDay < 6) score += 0.3;
  if (params.daysSinceReg < 0.003) score += 0.25;
  return Math.min(score, 1.0);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const { allowed } = rateLimit(`checkin:${ip}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { registrationId } = await req.json();

    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId required' }, { status: 400 });
    }

    const existing: any = await Registration.findOne({ registrationId })
      .populate('userId', 'name email')
      .populate('eventId', 'title date endDate venue category')
      .lean();

    if (!existing) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
    }

    if (!existing.confirmed) {
      return NextResponse.json({
        error: 'Registration not confirmed. Student must confirm attendance via email first.',
        code: 'NOT_CONFIRMED',
      }, { status: 400 });
    }

    const event = existing.eventId as any;
    const now = new Date();
    if (event?.endDate && new Date(event.endDate) < now) {
      return NextResponse.json({
        success: false,
        message: `This event ended on ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Check-in is no longer allowed.`,
        eventEnded: true,
        registration: {
          attendeeName: (existing.userId as any)?.name || 'Student',
          attendeeEmail: (existing.userId as any)?.email || '',
          eventTitle: event.title || 'Event',
          registrationId: existing.registrationId,
        },
      }, { status: 400 });
    }

    if (existing.checkedIn) {
      return NextResponse.json({
        error: 'Already checked in',
        checkedInAt: existing.checkedInAt,
      }, { status: 400 });
    }

    if ((existing as any).reviewStatus === 'denied') {
      return NextResponse.json({
        error: 'Registration has been denied by an administrator',
        code: 'DENIED',
      }, { status: 400 });
    }

    // ─── ML Anomaly Scoring ──────────────────────────────────────────────────
    const checkinTime = new Date();
    let anomalyScore: number | null = null;
    let features: number[] = [];

    // Always attempt to get/initialize the model (lazy training triggered here)
    const ifoModel = await getModel();
    if (ifoModel?.isTrained) {
      try {
        features = await extractFeatures({
          userId: (existing.userId as any)._id.toString(),
          eventId: (existing.eventId as any)._id.toString(),
          eventCategory: event.category,
          eventDate: event.date,
          registrationCreatedAt: existing.createdAt,
          checkinTime,
        });
        anomalyScore = Math.round(ifoModel.anomalyScore(features) * 1000) / 1000;
      } catch (err) {
        console.error('[IsolationForest] Scoring failed:', err);
      }
    }
    if (anomalyScore === null) {
      try {
        const daysSinceReg = (checkinTime.getTime() - existing.createdAt.getTime()) / 86_400_000;
        const minutesRelativeToStart = (checkinTime.getTime() - new Date(event.date).getTime()) / 60_000;
        const rawScore = heuristicAnomalyScore({
          hourOfDay: checkinTime.getHours(),
          minutesRelativeToStart,
          daysSinceReg,
        });
        if (rawScore > 0) {
          anomalyScore = Math.round(rawScore * 1000) / 1000;
        }
      } catch (err) {
        console.error('[Heuristic] Scoring failed:', err);
      }
    }

    const flagged = anomalyScore !== null && anomalyScore >= ML_THRESHOLDS.checkin.flagThreshold;
    const blocked = anomalyScore !== null && anomalyScore >= ML_THRESHOLDS.checkin.blockThreshold;

    // ─── Pre-compute flag reason (synchronous, uses message library) ──────────
    let flagReason: string | null = null;
    if (flagged || blocked) {
      flagReason = generateFlagReason(
        features,
        anomalyScore!,
        blocked ? 'blocked' : 'flagged',
        registrationId
      );
    }

    // ─── Handle blocked (score >= blockThreshold) ─────────────────────────────
    if (blocked) {
      await Registration.findOneAndUpdate(
        { registrationId, checkedIn: false },
        {
          $set: {
            checkedIn: false,
            flagged: true,
            anomalyScore,
            flagReason,
          },
        }
      );

      return NextResponse.json({
        success: false,
        blocked: true,
        requiresAdminApproval: true,
        anomalyScore,
        studentMessage: 'Verification required. Please wait for the organiser.',
        code: 'BLOCKED',
      });
    }

    // ─── Handle flagged (score flagThreshold–blockThreshold) — held for admin review ────
    if (flagged) {
      await Registration.findOneAndUpdate(
        { registrationId, checkedIn: false },
        {
          $set: {
            checkedIn: false,
            flagged: true,
            anomalyScore,
            flagReason,
          },
        }
      );

      return NextResponse.json({
        success: false,
        flagged: true,
        requiresAdminApproval: true,
        anomalyScore,
        studentMessage: 'Verification in progress. Please wait for the organiser.',
        code: 'FLAGGED_PENDING_REVIEW',
      });
    }

    // ─── Normal approval — no flag ───────────────────────────────────────────
    const updated = await Registration.findOneAndUpdate(
      { registrationId, checkedIn: false },
      {
        $set: {
          checkedIn: true,
          checkedInAt: checkinTime,
          anomalyScore,
          flagged: false,
        },
      },
      { new: true }
    ).populate('userId', 'name email').populate('eventId', 'title date venue');

    if (!updated) {
      return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    }

    recordCheckin();
    void updateStudentReliability((existing.userId as any)._id.toString()).catch(err =>
      console.error('[Reliability] Update after check-in failed:', err)
    );
    maybeRetrain();

    // Log activity
    void import('@/lib/activityLog').then(({ logActivity }) => {
      logActivity({
        userId: existing.userId.toString(),
        action: 'checkin',
        eventId: existing.eventId.toString(),
        eventTitle: (existing.eventId as any).title,
        details: `Checked in to ${(existing.eventId as any).title}`,
        algorithmTriggers: anomalyScore !== null ? [`Anomaly score: ${anomalyScore}`] : undefined,
      }).catch(err => console.error(err));
    }).catch(err => console.error(err));

    // Push a "checked in" notification to the student
    void import('@/lib/notifications').then(({ pushNotification }) => {
      pushNotification({
        userId: existing.userId.toString(),
        type: 'checked_in',
        title: '✅ Checked in successfully',
        body: `You're in at ${(updated.eventId as any).title}. Enjoy the event!`,
        eventId: existing.eventId.toString(),
        registrationId: updated.registrationId,
        actionUrl: `/my-events/checkin/${updated.registrationId}`,
        actionLabel: 'View ticket',
        ttlHours: 12,
      }).catch(err => console.error(err));
    }).catch(err => console.error(err));

    return NextResponse.json({
      success: true,
      warning: false,
      anomalyScore,
      registration: {
        attendeeName: (updated.userId as any).name,
        eventTitle: (updated.eventId as any).title,
        registrationId: updated.registrationId,
        checkedInAt: updated.checkedInAt,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const includeAll = req.nextUrl.searchParams.get('include') === 'all';

    let query;
    if (includeAll) {
      query = { flagged: true };
    } else {
      const tab = req.nextUrl.searchParams.get('tab') || 'pending';
      if (tab === 'history') {
        query = { flagged: true, reviewStatus: { $in: ['approved', 'denied'] } };
      } else {
        query = {
          flagged: true,
          checkedIn: false,
          $or: [
            { reviewStatus: 'pending' },
            { reviewStatus: { $exists: false } },
          ],
        };
      }
    }

    const flagged = await Registration.find(query)
      .populate('userId', 'name email college')
      .populate('eventId', 'title date venue category')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ flagged, total: flagged.length });
  } catch (err) {
    console.error('[Admin Flagged GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();
    const { registrationId, action, adminNote } = await req.json();

    if (!registrationId || !action) {
      return NextResponse.json({ error: 'registrationId and action required' }, { status: 400 });
    }

    if (action === 'approve') {
      const result = await Registration.findOneAndUpdate(
        { registrationId },
        {
          checkedIn: true,
          checkedInAt: new Date(),
          flagged: false,
          adminOverride: true,
          reviewStatus: 'approved',
          reviewedBy: (session.user as { id: string }).id,
          reviewedAt: new Date(),
        }
      );
      if (!result) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'deny') {
      const result = await Registration.findOneAndUpdate(
        { registrationId },
        {
          checkedIn: false,
          flagged: true,
          adminOverride: false,
          reviewStatus: 'denied',
          adminDenyNote: adminNote || null,
          adminNote: adminNote || 'Contact the event organiser',
          reviewedBy: (session.user as { id: string }).id,
          reviewedAt: new Date(),
        }
      );
      if (!result) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      return NextResponse.json({ success: true, action: 'denied' });
    }

    if (action === 'reinstate') {
      const result = await Registration.findOneAndUpdate(
        { registrationId },
        {
          reviewStatus: 'pending',
          flagged: true,
          checkedIn: false,
          adminOverride: false,
          $unset: { adminNote: '', reviewedBy: '', reviewedAt: '' },
        }
      );
      if (!result) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      return NextResponse.json({ success: true, action: 'reinstated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Flagged PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Registration from '@/models/Registration';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const registrations = await Registration.find({ eventId: params.id })
      .populate('userId', 'name email college engagementTier reliabilityScore')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ registrations });
  } catch (err) {
    console.error('[GET /api/admin/events/[id]/registrations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

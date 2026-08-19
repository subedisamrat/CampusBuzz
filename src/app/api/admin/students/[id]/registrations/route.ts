import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const registrations = await Registration.find({ userId: params.id })
      .populate('eventId', 'title date venue category')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ registrations });
  } catch (err) {
    console.error('[GET /api/admin/students/[id]/registrations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

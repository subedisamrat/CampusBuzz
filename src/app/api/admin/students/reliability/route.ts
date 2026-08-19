import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const students = await User.find(
      { role: 'student' },
      'name email engagementTier reliabilityScore'
    )
      .sort({ reliabilityScore: -1, name: 1 })
      .lean();

    const data = (students as any[]).map(s => ({
      id: s._id.toString(),
      name: s.name,
      email: s.email,
      tier: s.engagementTier ?? 'new',
      score: s.reliabilityScore,
    }));

    return NextResponse.json({ students: data });
  } catch (err) {
    console.error('[GET /api/admin/students/reliability]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

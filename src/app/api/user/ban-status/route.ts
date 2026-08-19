import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await connectDB();
    const user = await User.findById(session.user.id)
      .select('isBanned banReason bannedAt')
      .lean();

    return NextResponse.json({
      isBanned: (user as any)?.isBanned ?? false,
      banReason: (user as any)?.banReason ?? null,
      bannedAt: (user as any)?.bannedAt ?? null,
    });
  } catch (err) {
    console.error('[GET /api/user/ban-status]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

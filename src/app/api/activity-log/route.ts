import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActivityLog } from '@/lib/activityLog';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 50);

    const userId = session.user.id;
    const result = await getActivityLog(userId, limit, cursor);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/activity-log]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

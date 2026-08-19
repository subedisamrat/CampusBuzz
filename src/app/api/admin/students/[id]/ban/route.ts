import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { reason, note } = await req.json();

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Ban reason is required' }, { status: 400 });
    }

    const student: any = await User.findById(params.id).lean();
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    if (student.role === 'admin') {
      return NextResponse.json({ error: 'Cannot ban an admin account' }, { status: 400 });
    }

    await User.findByIdAndUpdate(params.id, {
      isBanned: true,
      banReason: reason.trim(),
      bannedAt: new Date(),
      bannedBy: session.user.id,
      bannedNote: note?.trim() ?? null,
    });

    // Push ban notification to the student
    void import('@/lib/notifications').then(({ pushNotification }) => {
      pushNotification({
        userId: params.id,
        type: 'banned',
        title: 'Account restricted',
        body: reason.trim(),
        actionUrl: '/my-events',
        actionLabel: 'View my events',
        ttlHours: 24 * 30, // 30 days
      }).catch(err => console.error(err));
    }).catch(err => console.error(err));

    return NextResponse.json({ success: true, message: 'Student has been banned' });
  } catch (err) {
    console.error('[POST /api/admin/students/[id]/ban]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    await User.findByIdAndUpdate(params.id, {
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      bannedNote: null,
    });

    // Push ban-lifted notification
    void import('@/lib/notifications').then(({ pushNotification }) => {
      pushNotification({
        userId: params.id,
        type: 'ban_lifted',
        title: 'Restriction lifted',
        body: 'Your account restriction has been removed. You can now register for events again.',
        actionUrl: '/events',
        actionLabel: 'Browse events',
        ttlHours: 72,
      }).catch(err => console.error(err));
    }).catch(err => console.error(err));

    return NextResponse.json({ success: true, message: 'Ban has been lifted' });
  } catch (err) {
    console.error('[DELETE /api/admin/students/[id]/ban]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import mongoose from 'mongoose';

/**
 * POST /api/notifications/read
 * Body: { ids: string[] }  — mark specific notifications as read
 * Body: { all: true }      — mark all as read
 *
 * Live notifications (those without a DB document) are ignored gracefully.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(session.user.id);
    const body = await req.json();

    if (body.all) {
      await Notification.updateMany(
        { userId, readAt: null },
        { $set: { readAt: new Date() } }
      );
      return NextResponse.json({ success: true, marked: 'all' });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      // Only mark persisted notifications — live ones are stateless
      const validIds = body.ids
        .filter((id: string) => mongoose.isValidObjectId(id))
        .map((id: string) => new mongoose.Types.ObjectId(id));

      if (validIds.length > 0) {
        await Notification.updateMany(
          { _id: { $in: validIds }, userId, readAt: null },
          { $set: { readAt: new Date() } }
        );
      }
      return NextResponse.json({ success: true, marked: validIds.length });
    }

    return NextResponse.json({ error: 'Provide ids[] or all:true' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/notifications/read]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

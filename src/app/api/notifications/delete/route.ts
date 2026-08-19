import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    await dbConnect();

    const validIds = ids
      .filter((id: string) => mongoose.isValidObjectId(id))
      .map((id: string) => new mongoose.Types.ObjectId(id));

    if (validIds.length > 0) {
      await Notification.deleteMany({
        _id: { $in: validIds },
        userId: new mongoose.Types.ObjectId(userId),
      });
    }

    return NextResponse.json({ success: true, deleted: validIds.length });
  } catch (err) {
    console.error('[API notifications/delete]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

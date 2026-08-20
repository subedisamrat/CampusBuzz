import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const status = searchParams.get('status');
    const query: Record<string, unknown> = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (search) query.title = { $regex: escapeRegex(search), $options: 'i' };
    if (status === 'ended') {
      query.date = { $lt: new Date() };
    } else {
      query.$or = [
        { isCancelled: { $ne: true } },
        { isCancelled: { $exists: false } },
      ];
      query.date = { $gte: new Date() };
    }

    const events: any = await Event.find(query).sort({ date: 1 }).lean();

    return NextResponse.json(events);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const data = await req.json();

    if (data.date && new Date(data.date) < new Date()) {
      return NextResponse.json({ error: 'Event date cannot be in the past' }, { status: 400 });
    }

    if (data.registrationDeadline && new Date(data.registrationDeadline) < new Date()) {
      return NextResponse.json({ error: 'Registration deadline cannot be in the past' }, { status: 400 });
    }

    const event = await Event.create({
      ...data,
      createdBy: (session.user as { id?: string }).id,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

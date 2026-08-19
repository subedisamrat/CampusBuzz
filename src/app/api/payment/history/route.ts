import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { getPaymentHistory } from '@/lib/payment';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    await dbConnect();
    const payments = await getPaymentHistory(session.user.id);

    return NextResponse.json({ payments });
  } catch (err) {
    console.error('[API /payment/history]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

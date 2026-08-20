import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const payments = await Payment.find({})
      .populate('userId', 'name email college')
      .populate('eventId', 'title date')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      failed: payments.filter(p => p.status === 'failed').length,
      refunded: payments.filter(p => p.status === 'refunded').length,
      totalAmount: payments.reduce((sum, p) => sum + (p.status === 'completed' ? p.amount : 0), 0),
    };

    const byProvider = {
      esewa: {
        count: payments.filter(p => p.provider === 'esewa').length,
        amount: payments.filter(p => p.provider === 'esewa' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
      },
      khalti: {
        count: payments.filter(p => p.provider === 'khalti').length,
        amount: payments.filter(p => p.provider === 'khalti' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
      },
    };

    const byEvent = payments.reduce((acc: Record<string, { count: number; amount: number; title: string }>, p: any) => {
      const eventId = p.eventId?._id?.toString() || 'unknown';
      if (!acc[eventId]) {
        acc[eventId] = { count: 0, amount: 0, title: p.eventId?.title || 'Unknown Event' };
      }
      acc[eventId].count++;
      if (p.status === 'completed') {
        acc[eventId].amount += p.amount;
      }
      return acc;
    }, {});

    return NextResponse.json({ payments, stats, byProvider, byEvent });
  } catch (err) {
    console.error('[Admin Payments GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

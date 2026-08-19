import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { computeMetrics, getTierBenefits } from '@/lib/ml/reliabilityScoring';

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

    const user = await User.findById(params.id)
      .select('name email engagementTier reliabilityScore createdAt college')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const metrics = await computeMetrics(params.id);
    const tier = (user as any).engagementTier ?? 'new';
    const benefits = getTierBenefits(tier);

    return NextResponse.json({
      student: {
        name: (user as any).name,
        email: (user as any).email,
        college: (user as any).college,
        accountAgeDays: Math.floor(
          (Date.now() - new Date((user as any).createdAt).getTime()) / 86_400_000
        ),
      },
      tier,
      score: (user as any).reliabilityScore,
      metrics: {
        totalRegistrations: metrics.totalRegistrations,
        totalAttended: Math.round(metrics.attendanceRate * metrics.totalRegistrations),
        attendanceRate: Math.round(metrics.attendanceRate * 100),
        waitlistAbandonRate: Math.round(metrics.waitlistAbandonRate * 100),
        bulkRegistrationScore: metrics.bulkRegistrationScore,
      },
      benefits,
    });
  } catch (err) {
    console.error('[GET /api/admin/students/[id]/reliability]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

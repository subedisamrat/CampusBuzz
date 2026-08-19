import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { getRecommendations } from '@/lib/recommendations/recommender';
import { recommendationCache } from '@/lib/recommendations/recommendationCache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

    await connectDB();
    const userId = session.user.id;

    const cached = recommendationCache.get(userId);
    if (cached) {
      return NextResponse.json({ recommendations: cached, fromCache: true });
    }

    const recommendations = await getRecommendations(userId, 5);
    recommendationCache.set(userId, recommendations);

    return NextResponse.json({ recommendations, fromCache: false });
  } catch (err) {
    console.error('[Recommendations GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

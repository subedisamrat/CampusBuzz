import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import User from '@/models/User';
import { TIME_UNITS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    await dbConnect();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * TIME_UNITS.DAY_MS);
    const sevenDaysAgo = new Date(now.getTime() - 7 * TIME_UNITS.DAY_MS);

    const [
      registrationsTrend,
      checkinsByCategory,
      popularEvents,
      recentRegistrations,
      recentCheckins,
      categoryBreakdown,
      eventsByMonth,
      userGrowth,
    ] = await Promise.all([
      // Registrations over last 30 days
      Registration.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Check-ins by event category
      Registration.aggregate([
        { $match: { checkedIn: true } },
        { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        {
          $group: {
            _id: '$event.category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top 5 popular events by registrations
      Event.aggregate([
        { $match: { isActive: true } },
        { $sort: { registeredCount: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: 1,
            registeredCount: 1,
            capacity: 1,
            category: 1,
            fillRate: { $divide: ['$registeredCount', '$capacity'] },
          },
        },
      ]),

      // Recent registrations (last 7 days)
      Registration.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),

      // Recent check-ins (last 7 days)
      Registration.countDocuments({ checkedIn: true, checkedInAt: { $gte: sevenDaysAgo } }),

      // Category distribution for events
      Event.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Events created by month (last 6 months)
      Event.aggregate([
        { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // User growth
      User.aggregate([
        { $match: { role: 'student' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
    ]);

    // Calculate check-in rate
    const [totalRegistrations, totalCheckins] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({ checkedIn: true }),
    ]);
    const checkinRate = totalRegistrations > 0 ? Math.round((totalCheckins / totalRegistrations) * 100) : 0;

    // Format chart data
    const formatTrendData = (data: any[]) => {
      const result = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * TIME_UNITS.DAY_MS);
        const dateStr = date.toISOString().split('T')[0];
        const found = data.find((d: any) => d._id === dateStr);
        result.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          registrations: found?.count || 0,
        });
      }
      return result;
    };

    const categoryColors: Record<string, string> = {
      Technical: '#8b5cf6',
      Cultural: '#ec4899',
      Sports: '#10b981',
      Workshop: '#f59e0b',
      Seminar: '#3b82f6',
      Hackathon: '#ef4444',
      Other: '#6b7280',
    };

    return NextResponse.json({
      registrationsTrend: formatTrendData(registrationsTrend),
      checkinsByCategory: checkinsByCategory.map((c: any) => ({
        category: c._id,
        count: c.count,
        fill: categoryColors[c._id] || '#6b7280',
      })),
      popularEvents: popularEvents.map((e: any) => ({
        title: e.title.length > 20 ? e.title.substring(0, 20) + '...' : e.title,
        registrations: e.registeredCount,
        capacity: e.capacity,
        fillRate: Math.round(e.fillRate * 100),
      })),
      recentRegistrations,
      recentCheckins,
      categoryBreakdown: categoryBreakdown.map((c: any) => ({
        category: c._id,
        count: c.count,
        fill: categoryColors[c._id] || '#6b7280',
      })),
      eventsByMonth,
      userGrowth,
      checkinRate,
      totalRegistrations,
      totalCheckins,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

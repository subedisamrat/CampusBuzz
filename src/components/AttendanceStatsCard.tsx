'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Award, Clock } from 'lucide-react';

interface Stats {
  totalRegistered: number;
  totalAttended: number;
  attendanceRate: number;
  trustLevel: 'high' | 'building';
  priorityBonus: number;
}

export default function AttendanceStatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/attendance-stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-36 mb-3" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
        </div>
        <div className="h-2 bg-white/5 rounded-full" />
      </div>
    );
  }

  // Don't show to brand new students with no activity
  if (!stats || stats.totalRegistered === 0) return null;

  const isHigh = stats.trustLevel === 'high';

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-teal-400" />
        <h3 className="text-sm font-medium text-white">Your Campus Activity</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{stats.totalRegistered}</div>
          <div className="text-xs text-gray-500 mt-0.5">Registered</div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-teal-400">{stats.totalAttended}</div>
          <div className="text-xs text-gray-500 mt-0.5">Attended</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Attendance rate</span>
          <span className={stats.attendanceRate >= 60 ? 'text-teal-400' : 'text-amber-400'}>
            {stats.attendanceRate}%
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              stats.attendanceRate >= 60 ? 'bg-teal-500' : 'bg-amber-500'
            }`}
            style={{ width: `${stats.attendanceRate}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl mb-3">
        <div className="flex items-center gap-2">
          <Award size={14} className={isHigh ? 'text-teal-400' : 'text-amber-400'} />
          <span className="text-xs text-gray-400">Trust level</span>
        </div>
        <span className={`text-xs font-medium ${isHigh ? 'text-teal-400' : 'text-amber-400'}`}>
          {isHigh ? 'Verified' : 'Building'}
        </span>
      </div>

      <div className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl">
        <div className="flex items-start gap-2">
          <Clock size={13} className="text-teal-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400 leading-relaxed">
            {stats.priorityBonus > 0
              ? `Your ${stats.priorityBonus} past attendance${
                  stats.priorityBonus > 1 ? 's earn you a' : ' earns you a'
                } ${stats.priorityBonus}-hour head start on waitlists.`
              : 'Attend events to earn priority on future waitlists.'}
          </p>
        </div>
      </div>
    </div>
  );
}

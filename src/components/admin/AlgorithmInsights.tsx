'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { Brain, Users, Clock, Shield, RefreshCw, Trophy } from 'lucide-react';
import { ALGORITHM_LABELS, ML_THRESHOLDS } from '@/lib/constants';

interface AlgorithmStats {
  collaborativeFiltering: {
    usersInMatrix: number;
    totalRegistrations: number;
    cacheSize: number;
    status: 'active' | 'warming_up';
  };
  waitlist: {
    studentsWaiting: number;
    eventsWithWaitlist: number;
    status: 'active';
  };
  isolationForest: {
    trainedOnSamples: number;
    flaggedToday: number;
    blockedToday: number;
    totalCheckins: number;
    status: 'active' | 'warming_up';
    minSamplesNeeded: number;
  };
  reliability: {
    trained: boolean;
    trainingCount: number;
    totalStudents: number;
    tierDistribution: {
      champion: number;
      regular: number;
      new: number;
      unreliable: number;
    };
    averageScore: number | null;
    status: 'active' | 'warming_up';
    minStudentsNeeded: number;
    eligibleStudents: number;
  };
}

function StatusDot({ status }: { status: 'active' | 'warming_up' }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${
      status === 'active' ? 'text-teal-400' : 'text-amber-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        status === 'active' ? 'bg-teal-400 animate-pulse' : 'bg-amber-400'
      }`} />
      {status === 'active' ? 'Active' : 'Warming up'}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-gray-400">{label}</span>
      <span className="text-[13px] font-semibold text-white">{value}</span>
    </div>
  );
}

const TIER_DISPLAY: Record<string, { label: string; color: string; bar: string }> = {
  champion:   { label: 'Champion',      color: 'text-amber-400',  bar: 'bg-amber-400' },
  regular:    { label: 'Regular',       color: 'text-teal-400',   bar: 'bg-teal-500' },
  new:        { label: 'New',           color: 'text-blue-400',   bar: 'bg-blue-500' },
  unreliable: { label: 'Low History',   color: 'text-orange-400', bar: 'bg-orange-500' },
};

function AlgorithmInsightsNoMemo() {
  const [stats, setStats] = useState<AlgorithmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/algorithm-stats');
      if (!res.ok) return;
      setStats(await res.json());
      setLastUpdated(new Date());
    } catch {
      // Non-critical widget — fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded w-40" />
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-3 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { collaborativeFiltering: cf, waitlist: wl, isolationForest: ifo, reliability: rel } = stats;

  // Total students for percentage calculation (use API value, fallback to sum)
  const totalStudents = rel.totalStudents || Object.values(rel.tierDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Brain size={18} className="text-teal-400" />
          <h3 className="text-[15px] font-bold text-white">Algorithm Insights</h3>
        </div>
        <button
          onClick={fetchStats}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Refresh stats"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="space-y-5">

        {/* Reliability Scoring — most prominent since it's new */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-[13px] font-semibold text-gray-200">
                {ALGORITHM_LABELS.reliabilityIF} + {ALGORITHM_LABELS.decisionTree.split('(')[0].trim()}
              </span>
            </div>
            <StatusDot status={rel.status} />
          </div>

          {/* Tier distribution bars with percentages */}
          <div className="space-y-2.5 mb-3">
            {Object.entries(TIER_DISPLAY).map(([tier, display]) => {
              const count = rel.tierDistribution[tier as keyof typeof rel.tierDistribution] ?? 0;
              const pct = Math.round((count / totalStudents) * 100);
              return (
                <div key={tier}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className={display.color}>{display.label}</span>
                    <span className="text-gray-500">{count} students ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${display.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white/[0.03] rounded-lg p-4">
            <Row label="Total students" value={rel.totalStudents} />
            <Row label="Eligible (3+ registrations)" value={rel.eligibleStudents} />
            <Row label="Trained on" value={`${rel.trainingCount} students`} />
            <Row label="Reliability features" value="7 parameters" />
            <Row label="Avg reliability score" value={rel.averageScore !== null ? `${rel.averageScore}/100` : '—'} />
          </div>
          {/* Tooltip: 7 feature names */}
          <div className="mt-2 group relative inline-block">
            <button className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              View reliability parameters ↗
            </button>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-72 z-10 p-3 rounded-xl text-xs"
                 style={{ background: '#0a1a18', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="font-semibold text-white mb-1.5">Reliability IF — 7 features:</p>
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
                Attendance rate · Waitlist abandon rate · Bulk registrations ·
                Cancellation rate · Recent attendance · Confirmation response speed ·
                Waitlist conversion rate
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            {rel.totalStudents - rel.eligibleStudents > 0
              ? `${rel.totalStudents - rel.eligibleStudents} student${rel.totalStudents - rel.eligibleStudents > 1 ? 's' : ''} excluded — need 3+ registrations to be eligible for scoring.`
              : 'All students have 3+ registrations and are eligible for scoring.'}
          </p>
          {rel.trainingCount < rel.eligibleStudents && (
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              {rel.eligibleStudents - rel.trainingCount} eligible student{rel.eligibleStudents - rel.trainingCount > 1 ? 's' : ''} excluded during training (NaN feature values).
            </p>
          )}
          {rel.status === 'warming_up' && (
            <div className="mt-3">
              <div className="flex justify-between text-[13px] text-amber-400/70 mb-1.5">
                <span>Training progress</span>
                <span>{rel.eligibleStudents} / {rel.minStudentsNeeded} students</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      (rel.eligibleStudents / rel.minStudentsNeeded) * 100, 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-amber-400/70 mt-1">
                Needs {rel.minStudentsNeeded}+ students with 3+ registrations each
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-white/5" />

        {/* Isolation Forest */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-red-400" />
              <span className="text-[13px] font-semibold text-gray-200">{ALGORITHM_LABELS.checkinIF}</span>
            </div>
            <StatusDot status={ifo.status} />
          </div>
          <div className="bg-white/[0.03] rounded-lg p-4">
            <Row label="Trained on" value={`${ifo.trainedOnSamples} check-ins`} />
            <Row label="Check-in features" value="8 parameters" />
            <Row label="Flag threshold" value={`${ML_THRESHOLDS.checkin.flagThreshold}`} />
            <Row label="Block threshold" value={`${ML_THRESHOLDS.checkin.blockThreshold}`} />
            <Row label="Flagged today" value={ifo.flaggedToday} />
            <Row label="Blocked today" value={ifo.blockedToday} />
            <Row label="Total check-ins" value={ifo.totalCheckins} />
          </div>
          {/* Tooltip: 8 feature names */}
          <div className="mt-2 group relative inline-block">
            <button className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              View check-in parameters ↗
            </button>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-72 z-10 p-3 rounded-xl text-xs"
                 style={{ background: '#0a1a18', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="font-semibold text-white mb-1.5">Check-in IF — 8 features:</p>
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
                Hour of day · Days since registration · Total registrations ·
                Historical check-in rate · Minutes relative to event start ·
                Same-category events attended · Check-ins today · Account age
              </p>
            </div>
          </div>
          {ifo.status === 'warming_up' && (
            <div className="mt-3">
              <div className="flex justify-between text-[13px] text-amber-400/70 mb-1.5">
                <span>Training progress</span>
                <span>{ifo.trainedOnSamples} / {ifo.minSamplesNeeded}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      (ifo.trainedOnSamples / ifo.minSamplesNeeded) * 100, 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
          {ifo.status === 'active' && ifo.totalCheckins > ifo.trainedOnSamples && (
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {ifo.totalCheckins - ifo.trainedOnSamples} check-in{ifo.totalCheckins - ifo.trainedOnSamples > 1 ? 's' : ''} excluded from training (admin overrides, cancelled/inactive events).
            </p>
          )}
        </div>

        <div className="border-t border-white/5" />

        {/* Waitlist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              <span className="text-[13px] font-semibold text-gray-200">{ALGORITHM_LABELS.minHeap}</span>
            </div>
            <StatusDot status={wl.status} />
          </div>
          <div className="bg-white/[0.03] rounded-lg p-4">
            <Row label="Students waiting" value={wl.studentsWaiting} />
            <Row label="Events with waitlist" value={wl.eventsWithWaitlist} />
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Collaborative Filtering */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-purple-400" />
              <span className="text-[13px] font-semibold text-gray-200">{ALGORITHM_LABELS.collab}</span>
            </div>
            <StatusDot status={cf.status} />
          </div>
          <div className="bg-white/[0.03] rounded-lg p-4">
            <Row label="Users in matrix" value={cf.usersInMatrix} />
            <Row label="Total registrations" value={cf.totalRegistrations} />
            <Row label="Cached results" value={`${cf.cacheSize} users`} />
          </div>
          {cf.status === 'warming_up' && (
            <p className="text-xs text-amber-400/70 mt-2">
              Needs 2+ students with registrations to activate
            </p>
          )}
        </div>

      </div>

      {lastUpdated && (
        <p className="text-[11px] text-gray-600 mt-4 text-right">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

export default memo(AlgorithmInsightsNoMemo);

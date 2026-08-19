'use client';

import { useState, useEffect, memo, useRef } from 'react';
import { TrendingUp, Clock, CheckCircle, Trophy } from 'lucide-react';
import Link from 'next/link';
import TierBadge from './TierBadge';
import { TIER_CONFIG, TIER_BENEFIT_TEXT, formatWindowTime } from '@/lib/constants';

interface ReliabilityData {
  tier: 'champion' | 'regular' | 'new' | 'unreliable';
  score: number | null;
  scoreHistory: Array<{ score: number; tier: string; reason: string; changedAt: string }>;
  metrics: {
    totalRegistered: number;
    totalAttended: number;
    attendanceRate: number;
    waitlistAbandonRate: number;
    bulkRegistrationScore: number;
  };
  benefits: {
    confirmationWindowHours: number;
    waitlistMultiplier: number;
    waitlistPenaltyHours?: number;
  };
  improvementTip: string;
  modelActive: boolean;
}

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor =
    tier === 'champion' ? '#f59e0b' :
    tier === 'unreliable' ? '#f97316' :
    '#14b8a6';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="48" cy="48" r={radius}
          fill="none" stroke={strokeColor} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color: strokeColor }}>
          {score}
        </span>
        <span className="text-xs" style={{ color: '#475569' }}>/ 100</span>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  good,
}: {
  label: string;
  value: number;
  good: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={good ? 'text-teal-400' : 'text-orange-400'}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            good ? 'bg-teal-500' : 'bg-orange-500'
          }`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function ReliabilityCard() {
  const [data, setData] = useState<ReliabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/user/reliability')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    };
    fetchData();
    intervalRef.current = setInterval(fetchData, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-40 mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
        </div>
        <div className="h-2 bg-white/5 rounded-full mb-2" />
        <div className="h-2 bg-white/5 rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  const isNew = data.tier === 'new';
  const isChampion = data.tier === 'champion';
  const isUnreliable = data.tier === 'unreliable';

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-teal-400" />
          <h3 className="text-sm font-medium text-white">Your Reliability Profile</h3>
        </div>
        <TierBadge tier={data.tier} size="sm" audience="student" />
      </div>

      {/* Score ring — only when not new and score exists */}
      {!isNew && data.score !== null && (
        <div className="flex flex-col items-center mb-4">
          <ScoreRing score={data.score} tier={data.tier} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-white">
            {data.metrics.totalRegistered}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Registered</div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${isChampion ? 'text-amber-400' : 'text-teal-400'}`}>
            {data.metrics.totalAttended}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Attended</div>
        </div>
      </div>

      {/* Metric bars — only when not new */}
      {!isNew && (
        <div className="space-y-3 mb-4">
          <MetricBar
            label="Attendance rate"
            value={data.metrics.attendanceRate}
            good={data.metrics.attendanceRate >= 50}
          />
          {data.metrics.waitlistAbandonRate > 0 && (
            <MetricBar
              label="Waitlist reliability"
              value={100 - data.metrics.waitlistAbandonRate}
              good={data.metrics.waitlistAbandonRate < 30}
            />
          )}
        </div>
      )}

      {/* Benefits */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl p-3 text-center" style={{ background: isUnreliable ? 'rgba(239,68,68,0.06)' : 'rgba(20,184,166,0.06)', border: `1px solid ${isUnreliable ? 'rgba(239,68,68,0.15)' : 'rgba(20,184,166,0.15)'}` }}>
          <Clock size={16} className={`mx-auto mb-1 ${isUnreliable ? 'text-red-400' : 'text-teal-400'}`} />
          <div className={`text-lg font-extrabold ${isUnreliable ? 'text-red-400' : 'text-teal-400'}`}>
            {(() => {
              const tierConf = TIER_CONFIG[data.tier as keyof typeof TIER_CONFIG];
              return formatWindowTime(tierConf.confirmationWindowHours);
            })()}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Confirmation window</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: data.benefits.waitlistMultiplier > 0 ? 'rgba(250,204,21,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${data.benefits.waitlistMultiplier > 0 ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
          <Trophy size={16} className={`mx-auto mb-1 ${data.benefits.waitlistMultiplier > 0 ? 'text-yellow-400' : 'text-gray-600'}`} />
          <div className={`text-lg font-extrabold ${data.benefits.waitlistMultiplier > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {data.benefits.waitlistMultiplier > 0 ? `${data.benefits.waitlistMultiplier}×` : '—'}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Waitlist priority</p>
        </div>
      </div>
      {(data.benefits.waitlistPenaltyHours ?? 0) > 0 && (
        <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg mb-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <Clock size={12} className="text-red-400 flex-shrink-0" />
          <div>
            <span className="text-red-400 font-medium">
              {data.benefits.waitlistPenaltyHours}h waitlist penalty active
            </span>
            <p className="text-gray-500 mt-0.5 leading-tight">
              When on a waitlist, your position is pushed back by {data.benefits.waitlistPenaltyHours}h worth of priority points.
              This penalty decreases as you attend more events and improve your reliability.
            </p>
          </div>
        </div>
      )}

      {/* New tier — progress bar toward 3 events */}
      {isNew && (
        <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl mb-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={13} className="text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Getting started</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((data.metrics.totalAttended / 3) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {data.metrics.totalAttended}/3 events attended to unlock your score
          </p>
        </div>
      )}

      {/* Improvement tip */}
      {data.improvementTip && (
        <div className={`p-3 rounded-xl border ${
          isUnreliable
            ? 'bg-orange-500/5 border-orange-500/10'
            : isChampion
              ? 'bg-amber-500/5 border-amber-500/10'
              : 'bg-teal-500/5 border-teal-500/10'
        }`}>
          <p
            className="text-xs leading-relaxed"
            style={{
              color: isUnreliable ? '#fb923c' : isChampion ? '#fbbf24' : '#2dd4bf',
            }}
          >
            {data.improvementTip}
          </p>
        </div>
      )}

      {/* Score history - newest first (index 0 = latest) */}
      {data.scoreHistory && data.scoreHistory.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
              Score History
            </p>
          </div>
          <div className="space-y-1">
            {data.scoreHistory.slice(0, 8).map((entry, i) => {
              const prevScore = data.scoreHistory[i + 1]?.score;
              const scoreDiff = prevScore !== undefined ? entry.score - prevScore : 0;
              const isUp = scoreDiff > 0;
              const isDown = scoreDiff < 0;
              const isFirst = i === 0;

              const tierColor =
                entry.tier === 'champion' ? '#f59e0b' :
                entry.tier === 'regular' ? '#14b8a6' :
                entry.tier === 'unreliable' ? '#f97316' :
                '#60a5fa';

              const changedDate = new Date(entry.changedAt);
              const dateStr = changedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + changedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={i} className="px-3 py-3 rounded-xl"
                  style={{
                    background: isFirst ? 'rgba(20,184,166,0.05)' : 'transparent',
                    border: isFirst ? '1px solid rgba(20,184,166,0.12)' : '1px solid transparent',
                  }}>
                  <div className="flex items-start gap-3">
                    {/* Score badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{
                        background: isFirst ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.04)',
                        color: isFirst ? '#14b8a6' : '#64748b',
                      }}>
                      {entry.score}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Tier badge + change indicator + date */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${tierColor}15`, color: tierColor }}>
                          {entry.tier === 'champion' ? 'Champion' : entry.tier === 'regular' ? 'Regular' : entry.tier === 'unreliable' ? 'Low History' : 'Getting Started'}
                        </span>
                        {prevScore !== undefined && scoreDiff !== 0 && (
                          <span className={`text-[11px] font-mono font-bold ${
                            isUp ? 'text-teal-500' : 'text-orange-400'
                          }`}>
                            {isUp ? '↑' : '↓'} {Math.abs(scoreDiff)}
                          </span>
                        )}
                        <span className="text-[10px] ml-auto flex-shrink-0 whitespace-nowrap" style={{ color: '#475569' }}>
                          {dateStr}
                        </span>
                      </div>
                      {/* Reason */}
                      <p className="text-[12px] leading-relaxed" style={{ color: '#94a3b8' }}>
                        {entry.reason}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link to full page */}
      <Link
        href="/my-reliability"
        className="block mt-4 text-center text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
      >
        View full details →
      </Link>
    </div>
  );
}

export default memo(ReliabilityCard);

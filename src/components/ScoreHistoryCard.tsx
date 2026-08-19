'use client';

import { useState, useEffect, useRef } from 'react';

interface ScoreHistoryEntry {
  score: number;
  tier: string;
  reason: string;
  changedAt: string;
}

export default function ScoreHistoryCard() {
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/user/reliability')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.scoreHistory) setScoreHistory(d.scoreHistory);
        })
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
        <div className="h-4 bg-white/10 rounded w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!scoreHistory.length) return null;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
          Score History
        </p>
      </div>
      <div className="space-y-1">
        {scoreHistory.slice(0, 8).map((entry, i) => {
          const prevScore = scoreHistory[i + 1]?.score;
          const scoreDiff = prevScore !== undefined ? entry.score - prevScore : 0;
          const isUp = scoreDiff > 0;
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
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{
                    background: isFirst ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.04)',
                    color: isFirst ? '#14b8a6' : '#64748b',
                  }}>
                  {entry.score}
                </div>

                <div className="flex-1 min-w-0">
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
  );
}

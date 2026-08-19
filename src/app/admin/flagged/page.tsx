'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, ShieldCheck, RotateCcw, XCircle, Loader2, Calendar, MapPin, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import EmptyState from '@/components/ui/EmptyState';
import TitleSetter from '@/components/TitleSetter';

interface FlaggedEntry {
  _id: string;
  userId: {
    name: string;
    email: string;
    college?: string;
  };
  eventId: {
    title: string;
    date: string;
    venue: string;
    category: string;
  };
  registrationId: string;
  anomalyScore: number;
  flagged: boolean;
  flagReason?: string;
  reviewStatus?: 'pending' | 'approved' | 'denied';
  adminNote?: string;
  reviewedAt?: string;
  checkedIn: boolean;
  createdAt: string;
}

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'Pending' },
  approved: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', label: 'Approved' },
  denied: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: 'Denied' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Technical: '#14b8a6',
  Cultural: '#f43f5e',
  Sports: '#f59e0b',
  Workshop: '#a78bfa',
};

export default function AdminFlaggedPage() {
  const { data: session, status } = useSession();
  const [allFlagged, setAllFlagged] = useState<FlaggedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [denyNotes, setDenyNotes] = useState<Record<string, string>>({});
  const [confirmDenyId, setConfirmDenyId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchFlagged = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/admin/flagged?include=all');
      const d = await res.json();
      setAllFlagged(d.flagged || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  async function handleAction(registrationId: string, action: 'approve' | 'deny' | 'reinstate') {
    setActingId(registrationId);
    try {
      const res = await fetch('/api/admin/flagged', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId,
          action,
          ...(action === 'deny' ? { adminNote: denyNotes[registrationId] || '' } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      setAllFlagged(prev => prev.map(f =>
        f.registrationId === registrationId
          ? {
              ...f,
              reviewStatus: action === 'reinstate' ? 'pending' : action as 'approved' | 'denied',
              reviewedAt: action === 'reinstate' ? undefined : new Date().toISOString(),
              checkedIn: action === 'approve' ? true : f.checkedIn,
              adminNote: action === 'deny' ? (denyNotes[registrationId] || f.adminNote) : f.adminNote,
            }
          : f
      ));
      setConfirmDenyId(null);
      setDenyNotes(prev => { const n = { ...prev }; delete n[registrationId]; return n; });
      if (action === 'deny') setActiveTab('history');
      if (action === 'reinstate') setActiveTab('pending');
      fetchFlagged();
      toast.success(
        action === 'approve' ? 'Check-in approved'
        : action === 'deny' ? 'Check-in denied'
        : 'Reinstated to pending review'
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }

  function getScoreInfo(score: number | undefined) {
    const s = score ?? 0;
    if (s < 0.6) return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Low Risk', width: 'w-1/3' };
    if (s < 0.8) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Medium Risk', width: 'w-2/3' };
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'High Risk', width: 'w-full' };
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  const pendingItems = allFlagged.filter(r => !r.reviewedAt && r.flagged && !r.checkedIn);
  const historyItems = allFlagged.filter(r => r.reviewedAt);
  const pendingCount = pendingItems.length;
  const displayItems = activeTab === 'pending' ? pendingItems : historyItems;

  if (loading) return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-white/[0.07] rounded-2xl" />
        <div>
          <div className="flex gap-2">
            <div className="w-24 h-7 bg-white/[0.08] rounded-lg" />
            <div className="w-28 h-7 bg-white/[0.05] rounded-lg" />
          </div>
          <div className="w-72 h-4 bg-white/[0.05] rounded mt-2" />
        </div>
      </div>
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#0d1f1e' }}>
        <div className="w-32 h-9 bg-white/[0.07] rounded-lg" />
        <div className="w-28 h-9 bg-white/[0.04] rounded-lg" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5 mb-4 relative overflow-hidden border-l-4" style={{ borderLeftColor: 'rgba(255,255,255,0.08)' }}>
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-1/3 h-full bg-white/[0.07] rounded-full" />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-white/[0.07] rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-28 h-4 bg-white/[0.08] rounded" />
                  <div className="w-14 h-4 bg-white/[0.05] rounded-md" />
                </div>
                <div className="w-40 h-3 bg-white/[0.04] rounded" />
                <div className="w-full h-10 bg-white/[0.04] rounded-lg" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="space-y-1.5">
                <div className="w-36 h-3.5 bg-white/[0.07] rounded" />
                <div className="w-28 h-3 bg-white/[0.04] rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-white/[0.07] rounded-lg" />
                <div className="w-20 h-5 bg-white/[0.05] rounded-lg" />
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="flex gap-2">
                <div className="w-16 h-8 bg-white/[0.07] rounded-xl" />
                <div className="w-20 h-8 bg-white/[0.08] rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6">
      <TitleSetter title="Flagged Check-ins" />
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/30 to-orange-500/20 flex items-center justify-center ring-1 ring-red-500/30">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Flagged <span className="text-accent">Check-ins</span>
          </h1>
          <p className="text-sm text-muted-foreground">Suspicious activity detected by the ML model</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface rounded-xl border border-border w-fit relative">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'pending' ? 'bg-accent/20 text-accent shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          Pending Review
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-accent/20 text-accent shadow-sm' : 'text-gray-400 hover:text-white'}`}
        >
          Review History
        </button>
      </div>

      {displayItems.length === 0 ? (
        <div className="mt-16">
          <EmptyState
            icon={activeTab === 'pending' ? ShieldCheck : CheckCircle}
            title={activeTab === 'pending' ? 'No flagged check-ins' : 'No review history'}
            description={
              activeTab === 'pending'
                ? 'All check-ins are within normal parameters. The Isolation Forest model has not detected any suspicious activity.'
                : 'No previously approved or denied registrations to show.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {displayItems.map((entry, i) => {
            const score = getScoreInfo(entry.anomalyScore);
            const isDenied = entry.reviewStatus === 'denied';
            const isApproved = entry.reviewStatus === 'approved';
            const isActing = actingId === entry.registrationId;
            const catColor = CATEGORY_COLORS[entry.eventId?.category] || '#6b7280';

            return (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-5 relative overflow-hidden border-l-4"
                style={{
                  borderLeftColor: isApproved ? '#22c55e' : isDenied ? '#ef4444' : score.color,
                }}
              >
                {/* Score bar at top */}
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `${score.bg}` }}>
                  <div className={`h-full ${score.width} rounded-full transition-all duration-500`} style={{ background: score.color }} />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Left: Student Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: `${score.color}20`, color: score.color }}
                    >
                      {getInitials(entry.userId?.name || '??')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{entry.userId?.name || 'Unknown'}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${activeTab === 'pending' ? 'bg-amber-500/10 text-amber-400' : isApproved ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {activeTab === 'pending' ? 'Pending' : isApproved ? 'Approved' : 'Denied'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{entry.userId?.email}</p>

                      {/* Flag reason — styled box */}
                      {entry.flagReason && (
                        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg text-xs leading-relaxed" style={{ background: `${score.color}10`, border: `1px solid ${score.color}20` }}>
                          <Zap size={14} className="flex-shrink-0 mt-0.5" style={{ color: score.color }} />
                          <span style={{ color: score.color }}>
                            {entry.flagReason}
                          </span>
                        </div>
                      )}

                      {/* Admin note on denied */}
                      {isDenied && entry.adminNote && (
                        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <XCircle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                          <span className="text-red-400">
                            <span className="font-semibold">Admin note:</span> {entry.adminNote}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Event + Score */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center lg:min-w-[280px]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-gray-500" />
                        <span className="text-sm font-semibold text-white truncate">{entry.eventId?.title || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {entry.eventId?.venue || 'N/A'}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: `${catColor}20`, color: catColor }}
                        >
                          {entry.eventId?.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                        style={{ background: score.bg, color: score.color }}
                      >
                        <Zap size={13} />
                        {(entry.anomalyScore ?? 0).toFixed(2)}
                      </div>
                      <div
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: score.bg, color: score.color }}
                      >
                        {score.label}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex-shrink-0">
                    {activeTab === 'pending' ? (
                      confirmDenyId === entry.registrationId ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <textarea
                            placeholder="Reason for denial (optional — visible to audit log only)..."
                            value={denyNotes[entry.registrationId] || ''}
                            onChange={e => setDenyNotes(prev => ({ ...prev, [entry.registrationId]: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl text-sm resize-none transition-colors focus:outline-none"
                  style={{
                    backgroundColor: '#1c2f2e',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f1f5f9',
                    caretColor: '#14b8a6',
                  }}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setConfirmDenyId(null); setDenyNotes(prev => { const n = { ...prev }; delete n[entry.registrationId]; return n; }); }}
                              className="px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors"
                              disabled={isActing}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleAction(entry.registrationId, 'deny')}
                              disabled={isActing}
                              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-xl border border-red-500/20 transition-colors inline-flex items-center gap-1.5 font-semibold"
                            >
                              {isActing ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                              Confirm Deny
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDenyId(entry.registrationId)}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-xl border border-red-500/20 transition-colors font-semibold"
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => handleAction(entry.registrationId, 'approve')}
                            disabled={isActing}
                            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white text-xs rounded-xl font-semibold shadow-lg shadow-teal-500/20 transition-all inline-flex items-center gap-1.5"
                          >
                            {isActing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                            Approve
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(entry.registrationId, 'reinstate')}
                          disabled={isActing}
                          className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs rounded-xl border border-amber-500/20 transition-colors inline-flex items-center gap-1.5 font-semibold"
                        >
                          {isActing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          Reinstate
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-600 mt-2 text-right">
                      {format(new Date(entry.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

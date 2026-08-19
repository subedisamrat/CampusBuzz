'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Award, Ban, RotateCcw, RefreshCw, Shield, Check } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TierBadge from '@/components/TierBadge';
import TitleSetter from '@/components/TitleSetter';

interface StudentDetail {
  _id: string;
  name: string;
  email: string;
  college: string;
  engagementTier: string;
  reliabilityScore: number | null;
  scoreHistory: Array<{ score: number; tier: string; reason: string; changedAt: string }>;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  createdAt: string;
}

interface RegistrationEntry {
  _id: string;
  eventId: { title: string; date: string };
  checkedIn: boolean;
  confirmed: boolean;
  createdAt: string;
}

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [banReason, setBanReason] = useState('');
  const [banNote, setBanNote] = useState('');
  const [tierOverride, setTierOverride] = useState('');
  const [tierNote, setTierNote] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'admin') { router.push('/events'); return; }
      Promise.all([
        fetch(`/api/admin/students/${id}`).then(r => r.json()),
        fetch(`/api/admin/students/${id}/registrations`).then(r => r.json()),
      ]).then(([sData, rData]) => {
        setStudent(sData.student || sData);
        setRegistrations(rData.registrations || []);
      }).finally(() => setLoading(false));
    }
  }, [status, session, router, id]);

  async function handleBan() {
    if (!banReason.trim()) { toast.error('Ban reason is required'); return; }
    setActing(true);
    try {
      const res = await fetch(`/api/admin/students/${id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason, note: banNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Student banned');
      setStudent(prev => prev ? { ...prev, isBanned: true, banReason: banReason, bannedAt: new Date().toISOString() } : prev);
      setBanReason('');
      setBanNote('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  }

  async function handleUnban() {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/students/${id}/ban`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Ban lifted');
      setStudent(prev => prev ? { ...prev, isBanned: false, banReason: null, bannedAt: null } : prev);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  }

  async function handleTierOverride() {
    if (!tierOverride) { toast.error('Select a tier'); return; }
    setActing(true);
    try {
      const res = await fetch(`/api/admin/students/${id}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierOverride, note: tierNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Tier updated to ${tierOverride}`);
      setStudent(prev => prev ? { ...prev, engagementTier: tierOverride, reliabilityScore: data.score } : prev);
      setTierNote('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto animate-pulse">
        <div className="w-32 h-5 bg-white/[0.07] rounded mb-6" />
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-white/[0.06] rounded-full" />
          <div className="space-y-3 flex-1">
            <div className="w-56 h-7 bg-white/[0.07] rounded" />
            <div className="w-40 h-4 bg-white/[0.04] rounded" />
            <div className="w-32 h-4 bg-white/[0.04] rounded" />
          </div>
          <div className="w-24 h-10 bg-white/[0.06] rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-white/[0.04] rounded-2xl" />
            <div className="h-48 bg-white/[0.04] rounded-2xl" />
            <div className="h-40 bg-white/[0.04] rounded-2xl" />
          </div>
          <div className="h-72 bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-400">Student not found</p>
        <Link href="/admin/students" className="text-teal-400 text-sm mt-2 inline-block">← Back to students</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <TitleSetter title={`${student.name} — Profile`} />
      {/* Back link */}
      <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to Students
      </Link>

      {/* Section 1 — Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500/30 to-teal-600/20 flex items-center justify-center text-2xl font-black text-teal-400 ring-2 ring-teal-500/30 flex-shrink-0">
          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white">{student.name}</h1>
            <TierBadge tier={(student.engagementTier || 'new') as 'champion' | 'regular' | 'new' | 'unreliable'} />
            {student.isBanned && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">BANNED</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{student.email}</p>
          <p className="text-xs text-gray-500 mt-1">
            {student.college && <span>{student.college} · </span>}
            Joined {format(new Date(student.createdAt), 'MMM d, yyyy')}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <div className="text-3xl font-black text-teal-400">{student.reliabilityScore ?? '—'}</div>
              <div className="text-[10px] text-gray-500">Score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — Metrics + Score History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 2 — Reliability Metrics */}
          {student.reliabilityScore !== null && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Award size={16} className="text-teal-400" /> Reliability Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-xl bg-[#1c2f2e] border border-white/10 text-center">
                  <div className="text-3xl font-black text-teal-400">{student.reliabilityScore}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Score / 100</div>
                </div>
                <div className="p-4 rounded-xl bg-[#1c2f2e] border border-white/10 text-center">
                  <div className="text-3xl font-black text-white capitalize">{student.engagementTier}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Current Tier</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Overall Reliability', value: student.reliabilityScore / 100, color: '#14b8a6' },
                  { label: 'Attendance Consistency', value: Math.min((student.reliabilityScore + 10) / 100, 1), color: '#f59e0b' },
                  { label: 'Commitment Level', value: Math.max((student.reliabilityScore - 5) / 100, 0), color: '#3b82f6' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{m.label}</span>
                      <span className="text-white font-semibold">{Math.round(m.value * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-[#0d1f1e] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.value * 100}%`, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3 — Score History */}
          {student.scoreHistory && student.scoreHistory.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <RefreshCw size={14} className="text-teal-400" /> Score History
              </h3>
              <div className="space-y-2">
                {student.scoreHistory.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${entry.score >= (student.scoreHistory[i + 1]?.score ?? 0) ? 'text-teal-400' : 'text-orange-400'}`}>
                        {entry.score >= (student.scoreHistory[i + 1]?.score ?? 0) ? '↑' : '↓'}
                      </span>
                      <span className="text-xs text-gray-400">{entry.reason}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-white">{entry.score}</span>
                      <span className="text-[10px] text-gray-600 ml-2">{format(new Date(entry.changedAt), 'MMM d')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4 — Registration History */}
          {registrations.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-white mb-4">Registration History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="text-left py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-wider">Event</th>
                      <th className="text-left py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-wider">Date</th>
                      <th className="text-left py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-wider">Status</th>
                      <th className="text-right py-2.5 text-[11px] font-semibold uppercase tracking-wider">Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.slice(0, 10).map((reg: any) => (
                      <tr key={reg._id} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-4 text-white font-medium">{reg.eventId?.title || 'Unknown'}</td>
                        <td className="py-2 pr-4 text-gray-400">{reg.eventId?.date ? format(new Date(reg.eventId.date), 'MMM d') : '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${reg.confirmed ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {reg.confirmed ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {reg.checkedIn ? (
                            <Check size={14} className="text-teal-400" />
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right col — Admin Actions */}
        <div className="card p-5 h-fit">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Shield size={15} className="text-teal-400" /> Manage Student
          </h3>

          {/* Option 1: Set Tier */}
          <div className="mb-5">
            <label className="text-xs text-gray-400 mb-2 block">Override Tier</label>
            <select
              value={tierOverride}
              onChange={e => setTierOverride(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#1c2f2e] border border-white/15 text-white mb-2"
            >
              <option value="">Select tier...</option>
              <option value="champion">Champion</option>
              <option value="regular">Regular</option>
              <option value="new">New</option>
              <option value="unreliable">Unreliable</option>
            </select>
            <input
              type="text"
              placeholder="Reason (shown in score history)"
              value={tierNote}
              onChange={e => setTierNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#1c2f2e] border border-white/15 text-white placeholder-gray-500 mb-2"
            />
            <button
              onClick={handleTierOverride}
              disabled={acting || !tierOverride}
              className="w-full py-2 text-xs font-semibold rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/25 hover:bg-teal-500/25 transition-colors disabled:opacity-50"
            >
              Update Tier
            </button>
          </div>

          {/* Option 2: Ban / Unban */}
          <div>
            {student.isBanned ? (
              <div>
                <div className="p-3 rounded-xl mb-3 text-xs" style={{ background: '#1c2f2e', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <p className="text-red-400 font-semibold mb-1">Currently Banned</p>
                  {student.banReason && <p className="text-gray-400 mb-1">Reason: {student.banReason}</p>}
                  {student.bannedAt && <p className="text-gray-500">Since: {format(new Date(student.bannedAt), 'MMM d, yyyy')}</p>}
                </div>
                <button
                  onClick={handleUnban}
                  disabled={acting}
                  className="w-full py-2 text-xs font-semibold rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={12} /> Lift Ban
                </button>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Ban Student</label>
                <input
                  type="text"
                  placeholder="Reason (required, visible to student)"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#1c2f2e] border border-white/15 text-white placeholder-gray-500 mb-2"
                />
                <input
                  type="text"
                  placeholder="Internal note (optional)"
                  value={banNote}
                  onChange={e => setBanNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#1c2f2e] border border-white/15 text-white placeholder-gray-500 mb-2"
                />
                <button
                  onClick={handleBan}
                  disabled={acting || !banReason.trim()}
                  className="w-full py-2 text-xs font-semibold rounded-xl bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Ban size={12} /> Ban Student
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

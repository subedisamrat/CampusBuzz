'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { motion } from 'framer-motion'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import {
  ShieldCheck, TrendingUp, AlertTriangle, HelpCircle, ArrowLeft,
  CheckCircle, XCircle, Clock, Activity, Loader2, Ticket, ArrowUpRight,
} from 'lucide-react'

interface Metrics {
  totalRegistered: number
  totalAttended: number
  attendanceRate: number
  waitlistAbandonRate: number
  bulkRegistrationScore: number
}

interface Benefits {
  confirmationWindowHours: number
  waitlistMultiplier: number
  waitlistPenaltyHours: number
}

interface ScoreHistory {
  score: number
  tier: string
  reason: string
  changedAt: string
}

interface ActivityEntry {
  _id: string
  action: string
  eventTitle: string
  details: string
  algorithmTriggers: string[]
  tier: string
  score: number | null
  createdAt: string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  register: <Ticket size={14} />,
  checkin: <CheckCircle size={14} />,
  cancel: <XCircle size={14} />,
  waitlist_join: <Clock size={14} />,
  waitlist_leave: <Clock size={14} />,
  waitlist_promotion: <ArrowUpRight size={14} />,
}

const ACTION_LABELS: Record<string, string> = {
  register: 'Registered',
  checkin: 'Checked In',
  cancel: 'Cancelled',
  waitlist_join: 'Joined Waitlist',
  waitlist_leave: 'Left Waitlist',
  waitlist_promotion: 'Promoted',
}

export default function MyReliabilityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<string>('')
  const [score, setScore] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [benefits, setBenefits] = useState<Benefits | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([])
  const [improvementTip, setImprovementTip] = useState('')
  const [modelActive, setModelActive] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [activityCursor, setActivityCursor] = useState<string | null>(null)
  const [activityHasMore, setActivityHasMore] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)

  // Hydrate from cache before first paint (synchronous)
  useEffect(() => {
    const cached = cacheGet<any>('my_reliability')
    if (cached) {
      setTier(cached.tier)
      setScore(cached.score)
      setMetrics(cached.metrics)
      setBenefits(cached.benefits)
      setScoreHistory(cached.scoreHistory ?? [])
      setImprovementTip(cached.improvementTip ?? '')
      setModelActive(cached.modelActive ?? false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status !== 'authenticated') return

    fetch('/api/user/reliability')
      .then(r => r.json())
      .then(d => {
        setTier(d.tier)
        setScore(d.score)
        setMetrics(d.metrics)
        setBenefits(d.benefits)
        setScoreHistory(d.scoreHistory ?? [])
        setImprovementTip(d.improvementTip ?? '')
        setModelActive(d.modelActive ?? false)
        cacheSet('my_reliability', d, 300_000)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [status, router])

  const activityCursorRef = useRef<string | null>(null)
  const activityLoadingRef = useRef(false)

  const loadActivity = useCallback(async (reset = false) => {
    if (activityLoadingRef.current) return
    activityLoadingRef.current = true
    setActivityLoading(true)
    try {
      const cursor = reset ? null : activityCursorRef.current
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/activity-log?${params}`)
      const data = await res.json()
      if (reset) {
        setActivityLog(data.entries)
      } else {
        setActivityLog(prev => [...prev, ...data.entries])
      }
      activityCursorRef.current = data.nextCursor
      setActivityCursor(data.nextCursor)
      setActivityHasMore(data.hasMore)
    } catch {
    } finally {
      activityLoadingRef.current = false
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      loadActivity(true)
    }
  }, [status, loadActivity])

  const tierColor: Record<string, string> = {
    champion: 'text-amber-400',
    regular: 'text-pulse-400',
    new: 'text-blue-400',
    unreliable: 'text-coral-400',
  }

  const tierBg: Record<string, string> = {
    champion: 'bg-amber-500/10 border-amber-500/30',
    regular: 'bg-pulse-500/10 border-pulse-500/30',
    new: 'bg-blue-500/10 border-blue-500/30',
    unreliable: 'bg-coral-500/10 border-coral-500/30',
  }

  const tierIcon = (t: string) => {
    if (t === 'champion') return <ShieldCheck className="w-5 h-5 text-amber-400" />
    if (t === 'regular') return <TrendingUp className="w-5 h-5 text-pulse-400" />
    if (t === 'new') return <HelpCircle className="w-5 h-5 text-blue-400" />
    return <AlertTriangle className="w-5 h-5 text-coral-400" />
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid-bg">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <Link
          href="/my-events"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to My Events
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Tier & Score Card */}
          <div className={`rounded-2xl border p-6 ${tierBg[tier] ?? 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center gap-4 mb-4">
              {tierIcon(tier)}
              <div>
                <h1 className="text-2xl font-bold text-white capitalize">{tier}</h1>
                <p className={`text-sm ${tierColor[tier] ?? 'text-gray-400'}`}>
                  {score !== null ? `Reliability Score: ${score}/100` : 'Score not yet available'}
                </p>
              </div>
            </div>
            {improvementTip && (
              <p className="text-sm text-gray-400 bg-white/5 rounded-xl px-4 py-3">{improvementTip}</p>
            )}
          </div>

          {/* Metrics Breakdown */}
          {metrics && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Metrics</h2>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Registered Events" value={metrics.totalRegistered} icon={<Activity size={16} />} />
                <MetricCard label="Attended Events" value={metrics.totalAttended} icon={<CheckCircle size={16} />} />
                <MetricBar label="Attendance Rate" value={metrics.attendanceRate} />
                <MetricBar label="Waitlist Abandon Rate" value={metrics.waitlistAbandonRate} reverse />
                <MetricCard label="Bulk Registration Score" value={metrics.bulkRegistrationScore} icon={<AlertTriangle size={16} />} />
              </div>
            </div>
          )}

          {/* Benefits */}
          {benefits && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Your Benefits</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BenefitCard
                  label="Confirmation Window"
                  value={`${benefits.confirmationWindowHours}h`}
                  desc="Time to confirm attendance"
                />
                <BenefitCard
                  label="Waitlist Priority"
                  value={`${benefits.waitlistMultiplier}x`}
                  desc="Attendance history multiplier"
                />
                <BenefitCard
                  label="Waitlist Penalty"
                  value={`${benefits.waitlistPenaltyHours}h`}
                  desc="Added to waitlist score"
                />
              </div>
            </div>
          )}

          {/* Score History */}
          {scoreHistory.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Score History</h2>
              <div className="space-y-3">
                {scoreHistory.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/[0.02] rounded-xl px-4 py-3">
                    <div className={`mt-0.5 ${entry.tier === 'champion' ? 'text-amber-400' : entry.tier === 'unreliable' ? 'text-coral-400' : 'text-pulse-400'}`}>
                      {entry.tier === 'champion' ? <ShieldCheck size={14} /> : entry.tier === 'unreliable' ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{entry.score}/100</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${tierBg[entry.tier] ?? 'bg-white/5 border-white/10'}`}>
                          {entry.tier}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{entry.reason}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {new Date(entry.changedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Activity Log</h2>
            {activityLog.length === 0 ? (
              <p className="text-sm text-gray-500">No activity recorded yet. Your actions here will appear after you register or check in to events.</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {activityLog.map((entry) => (
                    <div key={entry._id} className="flex items-start gap-3 bg-white/[0.02] rounded-xl px-3 py-2.5">
                      <div className={`mt-0.5 flex-shrink-0 ${
                        entry.action === 'checkin' ? 'text-pulse-400' :
                        entry.action === 'cancel' ? 'text-coral-400' :
                        entry.action === 'waitlist_promotion' ? 'text-amber-400' :
                        'text-gray-400'
                      }`}>
                        {ACTION_ICONS[entry.action] ?? <Activity size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                          {entry.eventTitle && (
                            <span className="text-xs text-gray-400 truncate max-w-[200px]">{entry.eventTitle}</span>
                          )}
                          {entry.tier && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                              entry.tier === 'champion' ? 'text-amber-400 bg-amber-500/10' :
                              entry.tier === 'regular' ? 'text-pulse-400 bg-pulse-500/10' :
                              entry.tier === 'unreliable' ? 'text-coral-400 bg-coral-500/10' :
                              'text-blue-400 bg-blue-500/10'
                            }`}>{entry.tier}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>
                        {entry.algorithmTriggers && entry.algorithmTriggers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.algorithmTriggers.map((trigger, ti) => (
                              <span key={ti} className="text-[10px] text-pulse-400 bg-pulse-500/10 px-1.5 py-0.5 rounded-full">
                                {trigger}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {activityHasMore && (
                  <button
                    onClick={() => loadActivity(false)}
                    disabled={activityLoading}
                    className="mt-3 w-full py-2 text-sm font-medium text-pulse-400 bg-pulse-500/10 border border-pulse-500/20 rounded-xl hover:bg-pulse-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {activityLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    {activityLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ML Status */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${modelActive ? 'bg-pulse-400' : 'bg-gray-600'}`} />
              <p className="text-sm text-gray-400">
                {modelActive
                  ? 'Anomaly detection model is active — your behavior is being analyzed for reliability scoring.'
                  : 'Anomaly detection model is warming up — needs more student data across the system.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function MetricBar({ label, value, reverse = false }: { label: string; value: number; reverse?: boolean }) {
  const pct = reverse ? 100 - value : value
  const color = value > 80 ? 'bg-coral-500' : value > 50 ? 'bg-amber-500' : 'bg-pulse-500'
  return (
    <div className="bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5">
      <div className="flex items-center justify-between text-gray-500 text-xs mb-1.5">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BenefitCard({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <div className="bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5 text-center">
      <p className="text-2xl font-bold text-pulse-400">{value}</p>
      <p className="text-sm text-white font-medium mt-1">{label}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
    </div>
  )
}

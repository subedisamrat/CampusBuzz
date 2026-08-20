'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, AlertTriangle, Edit2, 
  Users, CheckCircle, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import TitleSetter from '@/components/TitleSetter'

const ChartsSection = dynamic(() => import('@/components/admin/ChartsSection'), { ssr: false })
const AlgorithmInsights = dynamic(() => import('@/components/admin/AlgorithmInsights'), { ssr: false })

interface Stats {
  totalEvents: number
  upcomingEvents: number
  totalUsers: number
  totalRegistrations: number
  checkedInCount: number
}

interface Analytics {
  registrationsTrend: any[]
  categoryBreakdown: any[]
  checkinsByCategory: any[]
  popularEvents: any[]
  recentRegistrations: number
  recentCheckins: number
  checkinRate: number
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [flaggedCount, setFlaggedCount] = useState(0)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const d = await res.json()
      setStats(d)
      cacheSet('admin_stats', d, 30_000)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics')
      if (res.ok) {
        const d = await res.json()
        setAnalytics(d)
        cacheSet('admin_analytics', d, 30_000)
      }
    } catch {}
  }, [])

  const fetchFlaggedCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flagged')
      const d = await res.json()
      setFlaggedCount(d.total || 0)
      cacheSet('admin_flagged', d, 30_000)
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return }
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'admin') { router.push('/events'); return }
      Promise.allSettled([fetchStats(), fetchAnalytics(), fetchFlaggedCount()])
    }
  }, [status, session, fetchStats, fetchAnalytics, fetchFlaggedCount])

  useEffect(() => {
    if (pathname === '/admin/dashboard') {
      fetchFlaggedCount()
    }
  }, [pathname, fetchFlaggedCount])

  // Hydrate from cache before first paint (synchronous)
  useEffect(() => {
    const s = cacheGet<Stats>('admin_stats'); if (s) setStats(s)
    const a = cacheGet<Analytics>('admin_analytics'); if (a) setAnalytics(a)
    const f = cacheGet<{ total: number }>('admin_flagged'); if (f) setFlaggedCount(f.total ?? 0)
  }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    if (status !== 'authenticated') return
    const id = setInterval(() => {
      Promise.allSettled([fetchStats(), fetchAnalytics(), fetchFlaggedCount()])
    }, 30_000)
    return () => clearInterval(id)
  }, [status, fetchStats, fetchAnalytics, fetchFlaggedCount])

  const runConfirmations = async (force = false) => {
    try {
      const res = await fetch('/api/admin/run-confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const d = await res.json()
      if (d.message) {
        toast(d.message, { icon: 'ℹ️' })
      } else {
        toast.success(`${force ? '[Force] ' : ''}Emails: ${d.sent} sent, ${d.failed} failed`)
      }
    } catch {
      toast.error('Failed to run confirmations')
    }
  }

  const checkinRate = stats?.totalRegistrations 
    ? Math.round((stats.checkedInCount / stats.totalRegistrations) * 100) 
    : 0

  return (
    <div className="min-h-screen">
      <TitleSetter title="Dashboard" />
      <div className="max-w-[1200px] mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Admin <span className="text-teal-400">Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back, {session?.user?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/admin/flagged" className="relative group px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/10 flex items-center gap-2 transition-all duration-200">
              <AlertTriangle size={15} /> Flagged
              {flaggedCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#042f2e]">{flaggedCount}</span>
              )}
            </Link>
            <button onClick={() => runConfirmations()} className="group px-4 py-2.5 text-sm font-semibold rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 hover:shadow-lg hover:shadow-amber-500/10 flex items-center gap-2 transition-all duration-200">
              <Clock size={15} className="group-hover:rotate-12 transition-transform duration-200" /> Run Confirmations
            </button>
            <button onClick={() => runConfirmations(true)} className="group px-4 py-2.5 text-sm font-semibold rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 hover:shadow-lg hover:shadow-orange-500/10 flex items-center gap-2 transition-all duration-200">
              <Clock size={15} className="group-hover:rotate-12 transition-transform duration-200" /> Force Send All
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {!stats ? (
            <>
              {[1,2,3,4,5].map(i => <StatCardSkeleton key={i} />)}
            </>
          ) : (
            <>
          <div className="card p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Calendar size={18} className="text-teal-400" />
              </div>
              <span className="text-sm text-muted-foreground">Total Events</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-auto">{stats?.totalEvents ?? '—'}</div>
          </div>
          <div className="card p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Clock size={18} className="text-green-400" />
              </div>
              <span className="text-sm text-muted-foreground">Upcoming</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-auto">{stats?.upcomingEvents ?? '—'}</div>
          </div>
          <div className="card p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Users size={18} className="text-purple-400" />
              </div>
              <span className="text-sm text-muted-foreground">Students</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-auto">{stats?.totalUsers ?? '—'}</div>
          </div>
          <div className="card p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Edit2 size={18} className="text-amber-400" />
              </div>
              <span className="text-sm text-muted-foreground">Registrations</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-auto">{stats?.totalRegistrations ?? '—'}</div>
          </div>
          <div className="card p-5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle size={18} className="text-emerald-400" />
              </div>
              <span className="text-sm text-muted-foreground">Checked In</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-auto">{stats?.checkedInCount ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">{checkinRate}% rate</div>
          </div>
            </>
          )}
        </div>

        {/* Algorithm Insights Widget */}
        <div className="mb-6">
          <AlgorithmInsights />
        </div>

        {/* Charts */}
        {analytics && <ChartsSection analytics={analytics} />}

      </div>
    </div>
  )
}

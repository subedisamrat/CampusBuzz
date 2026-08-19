'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BarChart3, TrendingUp, Users, Calendar, CheckCircle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import TitleSetter from '@/components/TitleSetter'

const CHART_COLORS = ['#14b8a6', '#f43f5e', '#f59e0b', '#a78bfa', '#3b82f6']

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAnalytics()
    }
  }, [status, fetchAnalytics])

  if (loading) return (
    <div className="p-6 animate-pulse">
      <div className="mb-8">
        <div className="w-52 h-7 bg-white/[0.07] rounded-lg mb-2" />
        <div className="w-72 h-4 bg-white/[0.05] rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-72 bg-white/[0.04] rounded-2xl" />
        <div className="h-72 bg-white/[0.04] rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/[0.04] rounded-2xl" />)}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <TitleSetter title="Analytics" />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white">
          Analytics <span className="text-accent">Overview</span>
        </h1>
        <p className="text-muted-foreground mt-1">Track event performance and user engagement</p>
      </div>

      {analytics && (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Registrations Trend */}
            {analytics.registrationsTrend?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-4">Registrations Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={analytics.registrationsTrend}>
                    <defs>
                      <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f1419', border: '1px solid #1a1a1a', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#14b8a6" fillOpacity={1} fill="url(#colorReg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category Breakdown */}
            {analytics.categoryBreakdown?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-4">Events by Category</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.categoryBreakdown}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }: any) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {analytics.categoryBreakdown.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f1419', border: '1px solid #1a1a1a', borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Check-ins by Category */}
          {analytics.checkinsByCategory?.length > 0 && (
            <div className="card p-6 mb-8">
              <h3 className="text-lg font-bold text-white mb-4">Check-ins by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.checkinsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="category" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f1419', border: '1px solid #1a1a1a', borderRadius: 8 }}
                  />
                  <Bar dataKey="checkedIn" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Users</p>
                  <p className="text-2xl font-bold text-white">{analytics.totalUsers || 0}</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Events</p>
                  <p className="text-2xl font-bold text-white">{analytics.totalEvents || 0}</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Check-in Rate</p>
                  <p className="text-2xl font-bold text-white">{analytics.checkinRate || 0}%</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

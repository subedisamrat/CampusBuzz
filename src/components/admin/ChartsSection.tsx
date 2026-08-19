'use client'
import { Users, CheckCircle } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'

const CHART_COLORS = ['#14b8a6', '#f43f5e', '#f59e0b', '#a78bfa', '#3b82f6', '#ef4444', '#6b7280']

interface Analytics {
  registrationsTrend: any[]
  categoryBreakdown: any[]
  checkinsByCategory: any[]
  popularEvents: any[]
  recentRegistrations: number
  recentCheckins: number
  checkinRate: number
}

export default function ChartsSection({ analytics: a }: { analytics: Analytics }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Registrations (Last 30 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.registrationsTrend}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="registrations" stroke="#14b8a6" fill="url(#colorReg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Events by Category</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={a.categoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="category">
                  {a.categoryBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] space-y-2">
              {a.categoryBreakdown.map((cat: any, i: number) => (
                <div key={cat.category} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.fill || CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{cat.category}</span>
                  <span className="text-white">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Check-ins by Category</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.checkinsByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis dataKey="category" type="category" stroke="#6b7280" fontSize={11} width={70} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {a.checkinsByCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Top Events by Registrations</h3>
          <div className="h-56 space-y-4">
            {a.popularEvents.map((event: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm text-white truncate">{event.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${event.fillRate}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{event.registrations}/{event.capacity}</span>
                  </div>
                </div>
              </div>
            ))}
            {a.popularEvents.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No events yet</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-white mb-4">Activity (Last 7 Days)</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Users size={16} className="text-purple-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">New Registrations</span>
                </div>
                <span className="text-xl font-bold text-white">{a.recentRegistrations}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle size={16} className="text-green-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">Check-ins</span>
                </div>
                <span className="text-xl font-bold text-white">{a.recentCheckins}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-white mb-4 text-center">Overall Check-in Rate</h3>
            <div className="flex items-center justify-center h-32">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#1f2937" strokeWidth="8" fill="none" />
                  <circle cx="56" cy="56" r="48" stroke="#14b8a6" strokeWidth="8" fill="none" strokeDasharray={`${a.checkinRate * 3.02} 302`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{a.checkinRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

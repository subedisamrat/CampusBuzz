'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCcw, 
  Filter,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import TitleSetter from '@/components/TitleSetter'

type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded'

const statusConfig: Record<PaymentStatus, { color: string; bgColor: string; icon: typeof CheckCircle }> = {
  completed: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: CheckCircle },
  pending: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: Clock },
  failed: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle },
  refunded: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: RefreshCcw },
}

export default function AdminPaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [byProvider, setByProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, providerFilter])

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments')
      const data = await res.json()
      setPayments(data.payments || [])
      setStats(data.stats)
      setByProvider(data.byProvider)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/'); return
    }
    if (status === 'authenticated') {
      fetchPayments()
    }
  }, [status, session, fetchPayments])

  const handleRefund = async (paymentId: string) => {
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      })
      if (res.ok) {
        fetchPayments()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filteredPayments = payments.filter((p: any) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (providerFilter !== 'all' && p.provider !== providerFilter) return false
    return true
  })

  if (loading) return (
    <div className="min-h-screen animate-pulse">
      <div className="pb-16 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8 mt-7">
          <div className="w-14 h-14 bg-white/[0.07] rounded-2xl" />
          <div>
            <div className="w-48 h-7 bg-white/[0.08] rounded-lg mb-2" />
            <div className="w-56 h-4 bg-white/[0.05] rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/[0.07] rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-16 h-3 bg-white/[0.05] rounded" />
                  <div className="w-24 h-5 bg-white/[0.08] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="w-12 h-3 bg-white/[0.05] rounded" />
                  <div className="w-28 h-5 bg-white/[0.08] rounded" />
                  <div className="w-20 h-3 bg-white/[0.04] rounded" />
                </div>
                <div className="w-12 h-12 bg-white/[0.07] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="w-fit h-10 bg-white/[0.07] rounded-lg mb-6" />
        <div className="card overflow-hidden">
          <div className="h-14 bg-[#142826] flex items-center px-6 gap-8">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-16 h-3.5 bg-white/[0.05] rounded" />
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-8 border-t border-[#1e3a38]">
              <div className="w-28 h-3.5 bg-white/[0.05] rounded" />
              <div className="w-24 h-3.5 bg-white/[0.05] rounded" />
              <div className="w-14 h-5 bg-white/[0.05] rounded-lg" />
              <div className="w-20 h-3.5 bg-white/[0.05] rounded" />
              <div className="w-20 h-5 bg-white/[0.05] rounded-full" />
              <div className="w-24 h-3.5 bg-white/[0.05] rounded" />
              <div className="w-16 h-5 bg-white/[0.05] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <div className="pb-16 px-4 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <TitleSetter title="Payments" />
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8 mt-5 sm:mt-7">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-purple-600/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 sm:w-7 sm:h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl sm:text-3xl">
                Payment <span className="gradient-text">Reports</span>
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm">Monitor all transactions and refunds</p>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="card p-3 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-base sm:text-2xl font-bold text-white">Rs. {stats.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="card p-3 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Completed</p>
                    <p className="text-base sm:text-2xl font-bold text-white">{stats.completed}</p>
                  </div>
                </div>
              </div>
              
              <div className="card p-3 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Pending</p>
                    <p className="text-base sm:text-2xl font-bold text-white">{stats.pending}</p>
                  </div>
                </div>
              </div>
              
              <div className="card p-3 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-500/20 flex items-center justify-center">
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Refunded</p>
                    <p className="text-base sm:text-2xl font-bold text-white">{stats.refunded}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Provider Breakdown */}
          {byProvider && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="card p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">eSewa</p>
                    <p className="text-lg sm:text-xl font-bold text-white">Rs. {byProvider.esewa.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{byProvider.esewa.count} transactions</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-600/20 flex items-center justify-center">
                    <span className="text-green-400 font-bold text-lg">e</span>
                  </div>
                </div>
              </div>
              
              <div className="card p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">Khalti</p>
                    <p className="text-lg sm:text-xl font-bold text-white">Rs. {byProvider.khalti.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{byProvider.khalti.count} transactions</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                    <span className="text-purple-400 font-bold text-lg">K</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-surface border border-border rounded-lg p-2 mb-4 sm:mb-6 w-full sm:w-fit">
            <div className="flex items-center gap-2 pl-2 border-r border-border pr-3">
              <Filter size={16} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">Filters</span>
            </div>
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface">All Status</option>
              <option value="completed" className="bg-surface">Completed</option>
              <option value="pending" className="bg-surface">Pending</option>
              <option value="failed" className="bg-surface">Failed</option>
              <option value="refunded" className="bg-surface">Refunded</option>
            </select>
            
            <select 
              value={providerFilter} 
              onChange={e => setProviderFilter(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none cursor-pointer sm:border-l sm:border-border sm:pl-3"
            >
              <option value="all" className="bg-surface">All Providers</option>
              <option value="esewa" className="bg-surface">eSewa</option>
              <option value="khalti" className="bg-surface">Khalti</option>
            </select>
          </div>

          {(() => {
            const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
            const currentPayments = filteredPayments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
            return (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    currentPayments.map((payment: any, index: number) => {
                      const config = statusConfig[payment.status as PaymentStatus] || statusConfig.pending
                      const StatusIcon = config.icon
                      
                      return (
                        <motion.tr 
                          key={payment._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-b border-border/50 hover:bg-dark-border/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {payment.userId?.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {payment.userId?.email || 'No email'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-white">
                              {payment.eventId?.title || 'Unknown Event'}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              payment.provider === 'khalti' 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-green-500/20 text-green-400'
                            }`}>
                              {payment.provider === 'khalti' ? 'Khalti' : 'eSewa'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-white">
                              Rs. {payment.amount.toLocaleString()}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`}>
                              <StatusIcon size={12} />
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-400">
                              {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(payment.createdAt), 'h:mm a')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            {payment.status === 'completed' && (
                              <button
                                onClick={() => handleRefund(payment._id)}
                                className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-6 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} payments
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-surface border border-border text-white hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition ${
                          currentPage === i + 1 
                            ? 'bg-teal-500 text-[#042f2e]' 
                            : 'text-muted-foreground hover:bg-surface2 hover:text-white'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-surface border border-border text-white hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })()}
        </motion.div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import SoldOutStamp from '@/components/ui/SoldOutStamp'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Plus, Edit2, Trash2, Eye, Search, ChevronLeft, ChevronRight, Filter, Send, X, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import DeleteModal from '@/components/DeleteModal'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import TitleSetter from '@/components/TitleSetter'

export default function AdminEventsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState('all')
  const [filterFee, setFilterFee] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: '', itemName: '' })
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; eventId: string; eventName: string; pendingCount: number; loading: boolean; sending: boolean; sentCount: number | null }>({
    isOpen: false, eventId: '', eventName: '', pendingCount: 0, loading: false, sending: false, sentCount: null,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterDate, filterFee, filterStatus])

  // Hydrate from cache on mount
  useEffect(() => {
    const cached = cacheGet<any[]>('admin_events')
    if (cached) { setEvents(cached); setLoading(false) }
  }, [])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const d = await res.json()
      const data = d.recentEvents || []
      setEvents(data)
      cacheSet('admin_events', data, 30_000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/admin/login'); return }
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'admin') { router.push('/events'); return }
      fetchEvents()
    }
  }, [status, session, fetchEvents])

  const openConfirmModal = async (eventId: string, eventName: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: true, eventId, eventName, loading: true, sentCount: null }));
    try {
      const res = await fetch(`/api/admin/run-confirmations?eventId=${eventId}`);
      const data = await res.json();
      setConfirmModal(prev => ({ ...prev, pendingCount: data.pendingCount ?? 0, loading: false }));
    } catch {
      setConfirmModal(prev => ({ ...prev, loading: false, pendingCount: 0 }));
    }
  };

  const sendConfirmations = async () => {
    setConfirmModal(prev => ({ ...prev, sending: true }));
    try {
      const res = await fetch('/api/admin/run-confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: confirmModal.eventId, force: true }),
      });
      const data = await res.json();
      setConfirmModal(prev => ({ ...prev, sending: false, sentCount: data.sent ?? 0 }));
    } catch {
      setConfirmModal(prev => ({ ...prev, sending: false, sentCount: 0 }));
    }
  };

  const handleDelete = async (cancelReason?: string) => {
    if (!deleteModal.itemId) return
    setDeletingId(deleteModal.itemId)
    try {
      const res = await fetch(`/api/events/${deleteModal.itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('Event cancelled successfully')
      setDeleteModal({ isOpen: false, itemId: '', itemName: '' })
      fetchEvents()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = events.filter(e => {
    const q = search.toLowerCase()
    return (
      e.title?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.venue?.toLowerCase().includes(q)
    )
  }).filter(e => {
    if (filterDate !== 'all') {
      const isPast = new Date(e.date) < new Date()
      if (filterDate === 'upcoming' && isPast) return false
      if (filterDate === 'past' && !isPast) return false
    }
    if (filterFee !== 'all') {
      if (filterFee === 'free' && e.feeType !== 'free') return false
      if (filterFee === 'paid' && e.feeType !== 'paid') return false
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'cancelled' && !e.isCancelled) return false
      if (filterStatus === 'hidden' && e.isActive !== false) return false
      if (filterStatus === 'active' && (e.isCancelled || e.isActive === false)) return false
    }
    return true
  })

  if (loading) return (
    <div className="min-h-screen animate-pulse">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-9 bg-white/[0.07] rounded-lg" />
              <div className="w-20 h-9 bg-white/[0.05] rounded-lg" />
            </div>
            <div className="w-28 h-4 bg-white/[0.07] rounded mt-2" />
          </div>
          <div className="w-28 h-10 bg-white/[0.07] rounded-lg" />
        </div>
        <div className="w-full max-w-sm h-11 bg-white/[0.07] rounded-xl mb-6" />
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="w-24 h-8 bg-white/[0.05] rounded-lg" />
          <div className="w-24 h-8 bg-white/[0.05] rounded-lg" />
          <div className="w-24 h-8 bg-white/[0.05] rounded-lg" />
        </div>
        <div className="bg-[#0d1f1e] rounded-2xl overflow-hidden">
          <div className="h-[52px] bg-[#142826] flex items-center px-6 gap-6">
            <div className="w-20 h-4 bg-white/[0.06] rounded" />
            <div className="w-16 h-4 bg-white/[0.06] rounded" />
            <div className="w-20 h-4 bg-white/[0.06] rounded" />
            <div className="w-12 h-4 bg-white/[0.06] rounded" />
            <div className="w-24 h-4 bg-white/[0.06] rounded" />
            <div className="w-14 h-4 bg-white/[0.06] rounded" />
            <div className="w-14 h-4 bg-white/[0.06] rounded ml-auto" />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="px-6 py-4 flex items-center gap-6 border-t border-[#1e3a38]">
              <div className="flex items-center gap-3 w-[200px] flex-shrink-0">
                <div className="w-9 h-9 rounded-lg bg-white/[0.08] flex-shrink-0" />
                <div className="space-y-2">
                  <div className="w-28 h-3.5 bg-white/[0.07] rounded" />
                  <div className="w-16 h-3 bg-white/[0.04] rounded" />
                </div>
              </div>
              <div className="w-20 h-3.5 bg-white/[0.06] rounded" />
              <div className="w-24 h-3.5 bg-white/[0.06] rounded" />
              <div className="w-14 h-5 bg-white/[0.06] rounded-full" />
              <div className="w-20 h-3.5 bg-white/[0.06] rounded" />
              <div className="w-16 h-5 bg-white/[0.06] rounded-full" />
              <div className="flex gap-2 ml-auto">
                <div className="w-8 h-8 bg-white/[0.06] rounded-lg" />
                <div className="w-8 h-8 bg-white/[0.06] rounded-lg" />
                <div className="w-8 h-8 bg-white/[0.06] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentEvents = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen">
      <TitleSetter title="Events" />
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[clamp(24px,4vw,36px)] font-extrabold tracking-tighter text-white">
              All <span className="text-accent">Events</span>
            </h1>
            <p className="text-muted-foreground mt-1">{events.length} total events</p>
          </div>
          <Link href="/admin/events/new" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
            <Plus size={16} /> New Event
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full max-w-sm pl-11"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-lg p-2 mb-6">
          <div className="flex items-center gap-2 pl-2 border-r border-border pr-3">
            <Filter size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Filters</span>
          </div>
          <select
            className="bg-[#1c2f2e] text-sm text-white focus:outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10"
            value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          >
            <option value="all" className="bg-[#1c2f2e]">All Dates</option>
            <option value="upcoming" className="bg-[#1c2f2e]">Upcoming</option>
            <option value="past" className="bg-[#1c2f2e]">Past</option>
          </select>
          <select
            className="bg-[#1c2f2e] text-sm text-white focus:outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10"
            value={filterFee} onChange={(e) => setFilterFee(e.target.value)}
          >
            <option value="all" className="bg-[#1c2f2e]">Any Fee</option>
            <option value="free" className="bg-[#1c2f2e]">Free</option>
            <option value="paid" className="bg-[#1c2f2e]">Paid</option>
          </select>
          <select
            className="bg-[#1c2f2e] text-sm text-white focus:outline-none cursor-pointer px-3 py-1.5 rounded-lg border border-white/10"
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all" className="bg-[#1c2f2e]">Any Status</option>
            <option value="active" className="bg-[#1c2f2e]">Active</option>
            <option value="cancelled" className="bg-[#1c2f2e]">Cancelled</option>
            <option value="hidden" className="bg-[#1c2f2e]">Hidden</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-[13px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Venue</th>
                  <th className="px-6 py-4">Fee</th>
                  <th className="px-6 py-4">Registrations</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Calendar size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="text-muted-foreground">No events found</p>
                      <Link href="/admin/events/new" className="btn-primary inline-flex items-center gap-2 mt-4">
                        <Plus size={16} /> Create Event
                      </Link>
                    </td>
                  </tr>
                ) : (
                  currentEvents.map((event: any) => (
                    <tr key={event._id} className="hover:bg-surface2 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                            <Calendar size={16} className="text-teal-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-[160px] truncate">
                        {event.venue || '—'}
                      </td>
                      <td className="px-6 py-4">
                        {event.feeType === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-sm">
                            Rs. {event.feeAmount}
                            {/* <DollarSign size={13} /> {event.feeAmount} */}
                          </span>
                        ) : (
                          <span className="text-green-400 text-sm">Free</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-surface2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                event.registeredCount >= event.capacity ? 'bg-red-500' :
                                event.registeredCount >= event.capacity * 0.8 ? 'bg-amber-500' : 'bg-teal-500'
                              }`}
                              style={{ width: `${Math.min((event.registeredCount / event.capacity) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{event.registeredCount}/{event.capacity}</span>
                          {event.registeredCount >= event.capacity && !event.isCancelled && (
                            <SoldOutStamp size="sm" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          event.isCancelled ? 'bg-red-500/20 text-red-400' :
                          event.isActive === false ? 'bg-gray-500/20 text-gray-400' :
                          new Date(event.date) > new Date() ? 'bg-green-500/20 text-green-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {event.isCancelled ? 'Cancelled' : event.isActive === false ? 'Hidden' :
                           new Date(event.date) > new Date() ? 'Upcoming' : 'Past'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/events/${event._id}/view`}
                              className="p-2 text-muted-foreground hover:text-white hover:bg-surface rounded-lg transition-all" title="View">
                              <Eye size={16} />
                            </Link>
                            <Link href={`/admin/events/${event._id}/edit`}
                              className="p-2 text-muted-foreground hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-all" title="Edit">
                              <Edit2 size={16} />
                            </Link>
                            {event.feeType === 'free' && !event.isCancelled && new Date(event.date) > new Date() && (
                              <button
                                onClick={() => openConfirmModal(event._id, event.title)}
                                className="p-2 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                                title="Send Confirmations">
                                <Send size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, itemId: event._id, itemName: event.title })}
                              disabled={deletingId === event._id}
                              className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50" title="Cancel">
                              <Trash2 size={16} />
                            </button>
                          </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-6 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} events
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
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, itemId: '', itemName: '' })}
        onConfirm={handleDelete}
        title="Cancel Event"
        itemName={deleteModal.itemName}
        loading={deletingId === deleteModal.itemId}
        deleteText="Cancel Event"
        showReasonInput
      />

      {/* Send Confirmations Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
             onClick={(e) => { if (e.target === e.currentTarget && !confirmModal.sending) setConfirmModal(prev => ({ ...prev, isOpen: false })); }}>
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
               style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Send Confirmations</h2>
              <button onClick={() => { if (!confirmModal.sending) setConfirmModal(prev => ({ ...prev, isOpen: false })); }}
                className="p-1.5 rounded-lg" style={{ color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            {confirmModal.sentCount !== null ? (
              <div className="text-center py-6">
                <CheckCircle size={40} className="text-teal-400 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg mb-1">Emails Sent!</p>
                <p style={{ color: '#94a3b8' }}>{confirmModal.sentCount} confirmation email(s) sent successfully.</p>
                <button onClick={() => { setConfirmModal(prev => ({ ...prev, isOpen: false })); fetchEvents() }}
                  className="mt-5 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors">
                  Done
                </button>
              </div>
            ) : confirmModal.loading ? (
              <div className="text-center py-10">
                <Loader2 size={28} className="animate-spin text-teal-400 mx-auto mb-3" />
                <p style={{ color: '#94a3b8' }}>Checking pending confirmations...</p>
              </div>
            ) : (
              <>
                <p className="text-sm mb-2" style={{ color: '#94a3b8' }}>
                  Event: <span className="font-semibold text-white">{confirmModal.eventName}</span>
                </p>
                <div className="p-4 rounded-xl mb-5 text-center"
                     style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)' }}>
                  <p className="text-3xl font-extrabold text-teal-400">{confirmModal.pendingCount}</p>
                  <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>student(s) will receive confirmation emails</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}>
                    Cancel
                  </button>
                  <button onClick={sendConfirmations} disabled={confirmModal.pendingCount === 0}
                    className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {confirmModal.sending ? 'Sending...' : 'Send Now'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

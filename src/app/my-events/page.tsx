'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cacheGet, cacheSet } from '@/lib/client-cache'
import Navbar from '@/components/Navbar'
import LeaveWaitlistModal from '@/components/LeaveWaitlistModal'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { HiCalendar, HiLocationMarker, HiCheckCircle, HiClock } from 'react-icons/hi'
import toast from 'react-hot-toast'
import TitleSetter from '@/components/TitleSetter'
import { RegistrationCardSkeleton } from '@/components/ui/Skeleton'
import { Ban, Ticket, Printer, CheckCircle, Smartphone } from 'lucide-react'

export default function MyEventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MyEventsContent />
    </Suspense>
  )
}

function MyEventsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [registrations, setRegistrations] = useState<any[]>([])
  const [waitlists, setWaitlists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Hydrate from cache before first paint (synchronous)
  useEffect(() => {
    const r = cacheGet<any[]>('my_registrations')
    const w = cacheGet<any[]>('my_waitlists')
    if (r) { setRegistrations(r); setWaitlists(w || []); setLoading(false) }
  }, [])
  const defaultTab = searchParams.get('tab') ?? 'registered'
  const [activeTab, setActiveTab] = useState<'registered' | 'waitlisted'>(defaultTab as 'registered' | 'waitlisted')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null)
  const [banStatus, setBanStatus] = useState<{ isBanned: boolean; banReason?: string } | null>(null)

  // Waitlist leave modal state
  const [leaveModal, setLeaveModal] = useState<{
    open: boolean;
    eventId: string;
    eventTitle: string;
    position: number | null;
    loading: boolean;
  }>({ open: false, eventId: '', eventTitle: '', position: null, loading: false })

  // Fetch ban status on mount and poll every 15s
  useEffect(() => {
    const fetchBan = () => {
      fetch('/api/user/ban-status')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setBanStatus(d); })
        .catch(err => console.error(err));
    };
    fetchBan();
    const id = setInterval(fetchBan, 15_000);
    return () => clearInterval(id);
  }, [])

  // Handle query param toasts on mount
  useEffect(() => {
    const confirm = searchParams.get('confirm')
    if (confirm === 'expired') {
      toast.error('Your confirmation link expired. Registration was released. You can register again.')
    } else if (confirm === 'success') {
      toast.success('Attendance confirmed! Check your email for your QR code.')
    } else if (confirm === 'invalid') {
      toast.error('Invalid or expired confirmation link.')
    } else if (confirm === 'already') {
      toast('Already confirmed!')
    }
  }, [searchParams])

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations')
      const d = await res.json()
      const regs = d.registrations || []
      const wls = d.waitlists || []
      setRegistrations(regs)
      setWaitlists(wls)
      cacheSet('my_registrations', regs, 30_000)
      cacheSet('my_waitlists', wls, 30_000)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll waitlist position every 10s when on waitlist tab
  useEffect(() => {
    if (activeTab !== 'waitlisted') return;
    const id = setInterval(fetchRegistrations, 10_000);
    return () => clearInterval(id);
  }, [activeTab, fetchRegistrations]);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return }
    if (status === 'authenticated' && (session?.user as any)?.role === 'admin') {
      router.replace('/admin/dashboard'); return
    }
    if (status === 'authenticated') {
      fetchRegistrations()
      const id = setInterval(fetchRegistrations, 30_000)
      return () => clearInterval(id)
    }
  }, [status, session, router, fetchRegistrations])

  const handleDirectConfirm = async (registrationId: string) => {
    setConfirmingId(registrationId)
    try {
      const res = await fetch('/api/confirm-attendance/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      })
      const data = await res.json()
      if (res.status === 403 && data.code === 'CONFIRMATION_NOT_SENT') {
        toast.error('Your confirmation email has not been sent yet. Wait for admin.')
        return
      }
      if (res.status === 409) {
        toast.success('Already confirmed!')
        return
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Confirmation failed. Please try again.')
        return
      }
      toast.success('Attendance confirmed! Your QR code has been emailed to you.')
      await fetchRegistrations()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleResend = async (registrationId: string) => {
    setResendingId(registrationId)
    try {
      const res = await fetch('/api/confirm-attendance/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      })
      const data = await res.json()
      if (res.status === 429) { toast.error(data.error); return }
      if (!res.ok) { toast.error(data.error ?? 'Failed to resend email'); return }
      toast.success('Confirmation email resent! Check your inbox and spam folder.')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setResendingId(null)
    }
  }

  const handleCancel = async (eventId: string) => {
    setCancellingId(eventId);
    try {
      const res = await fetch('/api/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();

      if (res.status === 400 && data.code === 'PAID_NON_REFUNDABLE') {
        toast.error('Paid registrations cannot be cancelled. Contact admin.');
        return;
      }
      if (!res.ok) { toast.error(data.error ?? 'Cancellation failed'); return; }

      toast.success('Registration cancelled');
      await fetchRegistrations();
    } catch { toast.error('Something went wrong'); }
    finally { setCancellingId(null); setShowCancelConfirm(null); }
  };

  function openLeaveModal(eventId: string, eventTitle: string, position: number | null) {
    setLeaveModal({ open: true, eventId, eventTitle, position, loading: false })
  }

  function closeLeaveModal() {
    if (leaveModal.loading) return
    setLeaveModal(prev => ({ ...prev, open: false }))
  }

  async function confirmLeaveWaitlist() {
    setLeaveModal(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: leaveModal.eventId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setWaitlists(prev => prev.filter(w => w.eventId?._id !== leaveModal.eventId))
      setLeaveModal({ open: false, eventId: '', eventTitle: '', position: null, loading: false })
      toast.success('Left the waitlist')
    } catch (err: any) {
      setLeaveModal(prev => ({ ...prev, loading: false }))
      toast.error(err.message || 'Failed to leave waitlist')
    }
  }

  return (
    <div className="min-h-screen grid-bg">
      <TitleSetter title="My Events" />
      <Navbar />

      {/* Leave Waitlist Modal */}
      <LeaveWaitlistModal
        isOpen={leaveModal.open}
        eventTitle={leaveModal.eventTitle}
        position={leaveModal.position}
        onConfirm={confirmLeaveWaitlist}
        onCancel={closeLeaveModal}
        loading={leaveModal.loading}
      />
      <div className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-display font-extrabold text-4xl">
              My <span className="text-accent">Events</span>
            </h1>
          </div>
          <p className="text-gray-400 mb-6">Your registered events and waitlist queue</p>

          {/* Banned banner */}
          {banStatus?.isBanned && (
            <div className="mb-6 p-4 rounded-2xl"
                 style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-start gap-3">
                <Ban size={24} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-400 mb-1">Account Restricted</p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>
                    {banStatus.banReason || 'Your account has been restricted.'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#475569' }}>
                    You can view your existing registrations but cannot register for new events.
                    Visit the admin office with your student ID to appeal.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => { setActiveTab('registered'); router.push('/my-events?tab=registered', { scroll: false }); }}
              className={`pb-4 px-2 font-semibold transition-colors relative ${activeTab === 'registered' ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
            >
              Registered ({loading ? <span className="inline-block w-4 h-4 bg-white/20 rounded animate-pulse align-middle" /> : registrations.length})
              {activeTab === 'registered' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />}
            </button>
            <button
              onClick={() => { setActiveTab('waitlisted'); router.push('/my-events?tab=waitlisted', { scroll: false }); }}
              className={`pb-4 px-2 font-semibold transition-colors relative ${activeTab === 'waitlisted' ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
            >
              Waitlisted ({loading ? <span className="inline-block w-4 h-4 bg-white/20 rounded animate-pulse align-middle" /> : waitlists.length})
              {activeTab === 'waitlisted' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />}
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <RegistrationCardSkeleton key={i} />)}
            </div>
          ) : activeTab === 'registered' ? (
            registrations.length === 0 ? (
              <div className="text-center py-20">
                <Ticket size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="font-display font-bold text-2xl mb-2">No registrations yet</h3>
                <p className="text-gray-400 mb-6">Browse events and register to see them here</p>
                <button onClick={() => router.push('/events')} className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-semibold transition-colors">
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((reg: any, i: number) => {
                  const isPaid = !!reg.paymentId
                  return (
                    <motion.div
                      key={reg._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="card p-6"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Title + badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-bold text-xl text-white">{reg.eventId?.title || 'Event'}</h3>
                            {reg.checkedIn && (
                              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
                                <HiCheckCircle /> Checked In
                              </span>
                            )}
                            {reg.reviewStatus === 'denied' && (
                              <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded-full">
                                <HiCheckCircle /> Denied
                              </span>
                            )}
                            {!reg.confirmed && !reg.checkedIn && !isPaid && reg.reviewStatus !== 'denied' && (
                              <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">
                                <HiClock /> Pending Confirmation
                              </span>
                            )}
                            {reg.confirmed && !reg.checkedIn && reg.reviewStatus !== 'denied' && (
                              <span className="flex items-center gap-1 text-xs text-teal-400 bg-teal-500/20 px-2 py-1 rounded-full">
                                <HiCheckCircle /> Confirmed
                              </span>
                            )}
                            {isPaid && !reg.checkedIn && reg.reviewStatus !== 'denied' && (
                              <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">
                                💳 Paid
                              </span>
                            )}
                          </div>

                          {/* Meta */}
                          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <HiCalendar className="text-teal-400" />
                              {reg.eventId?.date ? format(new Date(reg.eventId.date), 'MMM d, yyyy') : 'N/A'}
                            </span>
                            <span className="flex items-center gap-1">
                              <HiLocationMarker className="text-teal-400" />
                              {reg.eventId?.venue || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1">
                              <HiClock className="text-teal-400" />
                              Registered {format(new Date(reg.createdAt), 'MMM d')}
                            </span>
                          </div>

                          {/* Consequence warning for pending confirmation */}
                          {!reg.confirmed && !reg.checkedIn && !isPaid && reg.reviewStatus !== 'denied' && (
                            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                              <p className="text-amber-400 font-semibold mb-1">Confirmation required</p>
                              <p className="text-gray-400">
                                You must confirm your attendance before the event. If you don&apos;t confirm, your spot will be automatically released to the next student on the waitlist 2 hours before the event starts.
                              </p>
                            </div>
                          )}

                          {/* Denied info */}
                          {reg.reviewStatus === 'denied' && (
                            <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <p className="text-red-400 font-semibold mb-1">Check-in denied</p>
                              {reg.flagReason && (
                                <p className="text-gray-300 mb-1">Reason: {reg.flagReason}</p>
                              )}
                              {reg.adminNote && (
                                <p className="text-red-300">{reg.adminNote}</p>
                              )}
                            </div>
                          )}

                          {/* Attendance confirmed indicator */}
                          {reg.confirmed && !reg.checkedIn && (
                            <div className="flex items-center gap-1.5 mt-1" style={{ color: '#14b8a6' }}>
                              <CheckCircle size={12} />
                              <span className="text-xs font-medium">Attendance confirmed</span>
                            </div>
                          )}

                          {/* Cancel registration — only if NOT confirmed */}
                          {!isPaid && !reg.confirmed && !reg.checkedIn && reg.eventId?.date && new Date(reg.eventId.date) > new Date() && reg.reviewStatus !== 'denied' && (
                            <>
                              {showCancelConfirm === reg.eventId._id ? (
                                <div className="flex items-center gap-2 mt-3">
                                  <span className="text-xs" style={{ color: '#94a3b8' }}>Cancel registration?</span>
                                  <button onClick={() => handleCancel(reg.eventId._id)}
                                    disabled={cancellingId === reg.eventId._id}
                                    className="text-xs px-2 py-1 rounded-lg"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                                             border: '1px solid rgba(239,68,68,0.2)' }}>
                                    {cancellingId === reg.eventId._id ? 'Cancelling...' : 'Yes, cancel'}
                                  </button>
                                  <button onClick={() => setShowCancelConfirm(null)}
                                    className="text-xs px-2 py-1 rounded-lg"
                                    style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                                             border: '1px solid rgba(255,255,255,0.08)' }}>
                                    Keep it
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setShowCancelConfirm(reg.eventId._id)}
                                  className="text-xs mt-2 font-medium px-3 py-1.5 rounded-lg transition-all"
                                  style={{
                                    color: '#f87171',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
                                  Cancel registration
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {reg.reviewStatus === 'denied' ? (
                            <span className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl block text-center">
                              Check-in denied
                            </span>
                          ) : reg.qrCode || isPaid ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => router.push(`/my-events/checkin/${reg.registrationId}`)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                                style={{
                                  background: 'rgba(20,184,166,0.1)',
                                  border: '1px solid rgba(20,184,166,0.25)',
                                  color: '#2dd4bf',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.18)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.1)')}
                              >
                                <Smartphone size={15} />
                                Open Ticket
                              </button>
                              <a
                                href={`/my-events/ticket/${reg.registrationId}`}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  color: '#94a3b8',
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                                  (e.currentTarget as HTMLElement).style.color = '#2dd4bf';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                                  (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                                }}
                              >
                                <Printer size={14} />
                                Print
                              </a>
                            </div>
                          ) : isPaid ? (
                            <span className="px-4 py-2 text-xs text-gray-500 bg-gray-500/10 border border-gray-500/20 rounded-xl block text-center">
                              QR after confirmation
                            </span>
                          ) : (
                            <>
                              {reg.confirmed && (
                                <div className="flex items-center gap-1.5 text-teal-400 text-sm font-medium">
                                  <CheckCircle size={14} />
                                  <span>Confirmed</span>
                                </div>
                              )}

                              {!reg.confirmed && !reg.confirmationEmailSent && (
                                <div className="relative group">
                                  <button
                                    disabled
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed select-none"
                                  >
                                    Confirm Attendance
                                  </button>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-56 pointer-events-none">
                                    <div className="bg-gray-900 border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 text-center shadow-xl">
                                      Awaiting confirmation email from admin
                                    </div>
                                  </div>
                                </div>
                              )}

                              {!reg.confirmed && reg.confirmationEmailSent && (
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    onClick={() => handleDirectConfirm(reg.registrationId)}
                                    disabled={confirmingId === reg.registrationId}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-500 hover:bg-teal-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {confirmingId === reg.registrationId ? 'Confirming...' : 'Confirm Attendance'}
                                  </button>
                                  <button
                                    onClick={() => handleResend(reg.registrationId)}
                                    disabled={resendingId === reg.registrationId}
                                    className="text-xs text-gray-500 hover:text-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
                                  >
                                    {resendingId === reg.registrationId ? 'Sending...' : 'Resend confirmation email'}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )
          ) : (
            waitlists.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">⌛</div>
                <h3 className="font-display font-bold text-2xl mb-2">No waitlists</h3>
                <p className="text-gray-400 mb-6">You&apos;re not on any waitlists right now.</p>
                <button onClick={() => router.push('/events')} className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-semibold transition-colors">
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {waitlists.map((wl: any, i: number) => (
                  <motion.div
                    key={wl._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="card p-6 border-l-4"
                    style={{ borderLeftColor: '#f59e0b' }}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-bold text-xl text-white">{wl.eventId?.title || 'Event'}</h3>
                          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">
                            <HiClock /> On Waitlist
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
                          <span className="flex items-center gap-1">
                            <HiCalendar className="text-amber-400" />
                            {wl.eventId?.date ? format(new Date(wl.eventId.date), 'MMM d, yyyy') : 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <HiLocationMarker className="text-amber-400" />
                            {wl.eventId?.venue || 'N/A'}
                          </span>
                        </div>
                        <div className="inline-flex gap-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <div>
                            <p className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Your Position</p>
                            <p className="text-amber-400 font-bold text-xl">#{wl.position}</p>
                          </div>
                          <div className="w-px bg-amber-500/20" />
                          <div>
                            <p className="text-gray-400 mb-1 text-xs uppercase tracking-wider">Queue Length</p>
                            <p className="text-white font-bold text-xl">{wl.queueLength} <span className="text-sm font-normal text-gray-400">waiting</span></p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0 mt-4 md:mt-0">
                        <button
                          onClick={() => openLeaveModal(wl.eventId?._id, wl.eventId?.title || 'Event', wl.position ?? null)}
                          className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl text-sm font-semibold transition-all"
                        >
                          Leave Waitlist
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </motion.div>
      </div>
    </div>
  )
}


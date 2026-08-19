'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiCheckCircle, HiExclamationCircle, HiQrcode } from 'react-icons/hi'
import Navbar from '@/components/Navbar'
import { AlertTriangle, Ban } from 'lucide-react'

export default function LiveCheckinStatusPage({ params }: { params: { registrationId: string } }) {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [status, setStatus] = useState<string>('PENDING')
  const [eventTitle, setEventTitle] = useState<string>('Event')
  const [qrCode, setQrCode] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/login')
    if (sessionStatus === 'authenticated' && (session?.user as any)?.role === 'admin') {
      router.replace('/admin/dashboard')
    }
  }, [sessionStatus, session, router])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;

      const fetchStatus = async () => {
        try {
          const res = await fetch(`/api/register/checkin-status?registrationId=${params.registrationId}`)
          if (res.ok) {
            const data = await res.json()
            setStatus(data.status)
            if (data.eventTitle) setEventTitle(data.eventTitle)
            if (data.qrCode) setQrCode(data.qrCode)
          }
        } catch (err) {
          console.error('Error fetching checkin status:', err)
        }
      }

    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [sessionStatus, params.registrationId])

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center pt-32 pb-16 px-4 max-w-md mx-auto w-full">
        <button onClick={() => router.push('/my-events')} className="self-start text-gray-400 hover:text-white mb-6 text-sm transition-colors">
          ← Back to My Events
        </button>
        
        <div className="card p-8 w-full text-center flex flex-col items-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-pulse-500"></div>
          
          <h2 className="font-display font-bold text-2xl text-white mb-1">{eventTitle}</h2>
          <p className="text-gray-400 text-xs mb-8 font-mono bg-white/5 py-1 px-3 rounded-lg border border-white/10">{params.registrationId}</p>

          <div className="min-h-[260px] flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {status === 'PENDING' && (
                <motion.div
                  key="pending"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center w-full"
                >
                    <div className="relative mb-8 mt-4">
                      {qrCode ? (
                        <div className="bg-white p-3 rounded-xl shadow-[0_0_30px_rgba(20,184,166,0.15)] relative z-10" style={{ border: '3px solid #14b8a6' }}>
                           <img src={qrCode} alt="QR Code" className="w-40 h-40" />
                        </div>
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-surface border border-border rounded-xl relative z-10">
                        <HiQrcode className="text-6xl text-gray-600" />
                      </div>
                    )}
                    <div className="absolute -inset-4 border-2 border-teal-500/20 rounded-2xl animate-pulse"></div>
                    <div className="absolute -inset-4 border-4 border-transparent border-t-teal-500 rounded-2xl animate-spin" style={{ animationDuration: '2s' }}></div>
                  </div>
                  <h3 className="text-xl font-bold text-teal-400 mb-2">Waiting for scan...</h3>
                  <p className="text-gray-400 text-sm">Please show this screen to the event staff</p>
                </motion.div>
              )}

              {status === 'CHECKED_IN' && (
                <motion.div
                  key="checked_in"
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex flex-col items-center w-full"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    className="w-28 h-28 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border-4 border-green-500/30"
                  >
                    <HiCheckCircle className="text-7xl" />
                  </motion.div>
                  <h3 className="text-3xl font-display font-bold text-green-400 mb-2">Welcome in!</h3>
                  <p className="text-gray-300 text-sm">You have been successfully checked in.</p>
                </motion.div>
              )}

              {status === 'FLAGGED' && (
                <motion.div
                  key="flagged"
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex flex-col items-center w-full"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    className="w-28 h-28 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mb-6 border-4 border-amber-500/30"
                  >
                    <HiCheckCircle className="text-7xl" /> 
                  </motion.div>
                  <h3 className="text-3xl font-display font-bold text-amber-400 mb-2">Welcome in!</h3>
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-3 py-1 rounded-full mb-3">Verified after review</span>
                  <p className="text-gray-300 text-sm">You have been successfully checked in.</p>
                </motion.div>
              )}

              {status === 'FLAGGED_PENDING_REVIEW' && (
                <motion.div
                  key="flagged_pending"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                       style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)' }}>
                    <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    Verification Required
                  </h2>
                  <p className="text-sm mb-2" style={{ color: '#94a3b8' }}>
                    Your entry is being reviewed by the organiser.
                  </p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>
                    Please speak with the event organiser at the entrance.
                  </p>
                  <div className="mt-5 px-4 py-2.5 rounded-xl text-xs font-mono"
                       style={{ background: 'rgba(255,255,255,0.04)', color: '#475569' }}>
                    Ref: {params.registrationId}
                  </div>
                </motion.div>
              )}

              {status === 'BLOCKED' && (
                <motion.div
                  key="blocked"
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                       style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}>
                    <Ban size={32} style={{ color: '#ef4444' }} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    Entry Not Permitted
                  </h2>
                  <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
                    Your entry could not be verified. Please speak with the
                    event organiser for assistance.
                  </p>
                  <div className="mt-4 px-4 py-2.5 rounded-xl text-xs font-mono"
                       style={{ background: 'rgba(255,255,255,0.04)', color: '#475569' }}>
                    Ref: {params.registrationId}
                  </div>
                </motion.div>
              )}

              {status === 'QR_EXPIRED' && (
                <motion.div
                  key="expired"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="w-28 h-28 bg-gray-500/20 text-gray-400 rounded-full flex items-center justify-center mb-6 border-4 border-gray-500/30">
                    <HiExclamationCircle className="text-7xl" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-gray-400 mb-2">Event has ended</h3>
                  <p className="text-gray-500 text-sm">This QR code is no longer valid for entry.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

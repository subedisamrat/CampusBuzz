'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiXCircle, HiQrcode, HiRefresh, HiCheck, HiClock, HiCamera } from 'react-icons/hi'
import TitleSetter from '@/components/TitleSetter'
import { AlertTriangle } from 'lucide-react'

export default function ScannerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const processingRef = useRef(false)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') router.push('/events')
  }, [status])

  useEffect(() => {
    if (!scanning) return

    let html5QrCode: any = null

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')
        html5QrCode = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        )
        html5QrCode.render(
          async (decodedText: string) => {
            if (processingRef.current || cooldownRef.current) return
            processingRef.current = true
            await html5QrCode.clear()
            setScanning(false)
            await processQR(decodedText)
            processingRef.current = false
            cooldownRef.current = true
            setTimeout(() => { cooldownRef.current = false }, 1500)
          },
          (error: any) => {}
        )
      } catch (err) {
        console.error('Scanner init error:', err)
        toast.error('Camera scanner not available. Use manual input.')
        setScanning(false)
      }
    }

    initScanner()

    return () => {
      if (html5QrCode) {
        html5QrCode.clear().catch((err: unknown) => console.error(err));
      }
    }
  }, [scanning])

  const processQR = async (qrData: string) => {
    setLoading(true)
    try {
      // QR data is JSON: {"registrationId":"CP-...","eventId":"...","userId":"..."}
      // Extract registrationId — also handle plain CP-... strings
      let registrationId = qrData.trim()
      if (registrationId.startsWith('{')) {
        try {
          const parsed = JSON.parse(registrationId)
          registrationId = parsed.registrationId || registrationId
        } catch {
          // not valid JSON — use as-is
        }
      }

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      })
      const data = await res.json()

      // Handle flagged/blocked response that still returns 200
      if (data.requiresAdminApproval) {
        setResult({
          type: data.blocked ? 'blocked' : 'flagged',
          message: data.blocked
            ? 'Access Blocked — Review in Flagged Section'
            : 'Held for Review — Check Flagged Section',
          anomalyScore: data.anomalyScore,
          requiresReview: true,
        })
        toast.error(data.blocked ? 'Access blocked — review needed' : 'Flagged — pending admin review')
        return
      }

      if (res.ok) {
        setResult({ success: true, ...data })
        if (data.success) toast.success(`${data.registration?.attendeeName} checked in!`)
      } else {
        setResult({
          success: false,
          eventEnded: data.eventEnded || false,
          blocked: data.blocked || false,
          message: data.message || data.error || 'Check-in failed',
          checkedInAt: data.checkedInAt,
          registration: data.registration || null,
          anomalyScore: data.anomalyScore ?? null,
        })
        if (data.eventEnded) toast.error('Event has already ended')
      }
    } catch {
      toast.error('Failed to process QR code')
    } finally {
      setLoading(false)
    }
  }

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim() || processingRef.current) return
    processingRef.current = true
    await processQR(manualCode)
    processingRef.current = false
  }

  return (
    <div className="min-h-screen">
      <TitleSetter title="QR Scanner" />
      <div className="pb-16 px-4 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-6 transition-colors">
            ← Back to Dashboard
          </button>
          <h1 className="font-display font-extrabold text-4xl mb-2">
            QR <span className="gradient-text">Scanner</span>
          </h1>
          <p className="text-gray-400 mb-8">Scan attendee QR codes for event check-in</p>

          {/* Scanner Area */}
          {!scanning ? (
            <div className="gradient-border p-8 text-center mb-6">
              <div className="w-24 h-24 bg-pulse-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <HiQrcode className="text-5xl text-pulse-400" />
              </div>
              <h2 className="font-display font-bold text-2xl mb-2">Ready to Scan</h2>
              <p className="text-gray-400 mb-6">Click below to start the camera scanner</p>
              <button
                onClick={() => { setResult(null); setScanning(true) }}
                className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 w-full max-w-sm mx-auto shadow-lg shadow-teal-500/20"
              >
                <HiCamera size={24} /> Start Camera Scanner
              </button>
            </div>
          ) : (
            <div className="gradient-border p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-xl">Scanning...</h2>
                <button onClick={() => setScanning(false)} className="text-gray-400 hover:text-white text-sm">
                  Stop
                </button>
              </div>
              <div id="qr-reader" className="rounded-xl overflow-hidden" />
            </div>
          )}

          {/* Manual Input */}
          <div className="card p-6 mb-6">
            <h2 className="font-bold text-lg text-white mb-1">Manual Entry</h2>
            <p className="text-gray-400 text-sm mb-4">Paste the Registration ID</p>
            <form onSubmit={handleManual} className="flex flex-col gap-3">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-surface2 flex items-center justify-center border border-border group-focus-within:border-teal-500/50 group-focus-within:bg-teal-500/10 transition-colors">
                  <HiQrcode size={16} className="text-muted-foreground group-focus-within:text-teal-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="CP-XXXXXXXXXXXXXXXX"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  className="input w-full font-mono text-sm pl-14 h-12 bg-surface/50 border-2 focus:border-teal-500 transition-all placeholder:text-muted-foreground/50"
                  style={{ letterSpacing: '0.05em' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !manualCode.trim()}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                ) : (
                  <><HiCheck size={20} /> Check In</>
                )}
              </button>
            </form>
          </div>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="overflow-hidden rounded-2xl shadow-2xl bg-surface"
              >
                {/* Status Banner */}
                <div className={`p-8 text-center border-b ${
                  result.success ? 'bg-green-500/10 border-green-500/20' :
                  result.eventEnded ? 'bg-orange-500/10 border-orange-500/20' :
                  'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex justify-center mb-5">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg ${
                      result.success ? 'bg-green-500/20 text-green-400 shadow-green-500/10 border border-green-500/30' :
                      result.eventEnded ? 'bg-orange-500/20 text-orange-400 shadow-orange-500/10 border border-orange-500/30' :
                      'bg-red-500/20 text-red-400 shadow-red-500/10 border border-red-500/30'
                    }`}>
                      {result.success
                        ? <HiCheckCircle size={40} />
                        : result.eventEnded
                          ? <HiClock size={40} />
                          : <HiXCircle size={40} />}
                    </div>
                  </div>
                  <h3 className={`font-display font-extrabold text-2xl md:text-3xl tracking-tight mb-2 ${
                    result.success ? 'text-green-400' :
                    result.eventEnded ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {result.success ? 'CHECK-IN APPROVED' : result.eventEnded ? 'EVENT EXPIRED' : 'ACCESS DENIED'}
                  </h3>
                  <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">{result.message}</p>
                </div>

                <div className="p-6">
                  {result.registration ? (
                    <div className="space-y-4">
                      {/* Name & Event */}
                      <div className="text-center pb-4 border-b border-border">
                        <h4 className="text-3xl font-extrabold text-white mb-1">{result.registration.attendeeName}</h4>
                        <p className={`text-lg font-medium ${ result.eventEnded ? 'text-orange-400' : 'text-teal-400' }`}>
                          {result.registration.eventTitle}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div className="bg-surface2 p-3 rounded-xl border border-border">
                          <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Email</span>
                          <span className="text-white font-medium break-all">{result.registration.attendeeEmail}</span>
                        </div>
                        <div className="bg-surface2 p-3 rounded-xl border border-border">
                          <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Registration ID</span>
                          <span className="text-white font-mono text-sm">{result.registration.registrationId}</span>
                        </div>
                      </div>

                      {/* Anomaly Badge — show for any score > 0.1 now that heuristics fire */}
                      {result.anomalyScore !== null && result.anomalyScore !== undefined && result.anomalyScore > 0.1 && (
                        <div className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${
                          result.anomalyScore >= 0.8 ? 'bg-red-500/10 border-red-500/30' :
                          result.anomalyScore >= 0.6 ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-yellow-500/10 border-yellow-500/30'
                        }`}>
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
                            <div>
                              <span className="block text-white font-bold">
                                {result.anomalyScore >= 0.8 ? 'High Risk — Verify ID' :
                                 result.anomalyScore >= 0.6 ? 'Anomaly Detected' :
                                 'Low-level Flag'}
                              </span>
                              <span className="text-xs text-gray-400">Please verify identity manually</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold ${
                              result.anomalyScore >= 0.8 ? 'text-red-400' :
                              result.anomalyScore >= 0.6 ? 'text-amber-400' :
                              'text-yellow-400'
                            }`}>
                              {(result.anomalyScore * 100).toFixed(0)}%
                            </div>
                            <span className="text-xs text-gray-400 uppercase">Risk Score</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-400">
                      Please verify the registration manually.
                    </div>
                  )}

                  <button
                    onClick={() => { setResult(null); setManualCode(''); cooldownRef.current = false }}
                    className="mt-6 w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <HiRefresh size={22} /> SCAN NEXT ATTENDEE
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

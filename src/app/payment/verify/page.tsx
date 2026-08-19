'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { HiCheckCircle, HiArrowRight, HiXCircle } from 'react-icons/hi'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [verificationState, setVerificationState] = useState<'loading' | 'success' | 'failed'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [fetchedEventName, setFetchedEventName] = useState<string | null>(null)

  const eventName = searchParams.get('event') || fetchedEventName
  const eventId = searchParams.get('eventId')

  // Fetch event name if not provided but eventId is
  useEffect(() => {
    if (eventName || !eventId) return
    fetch(`/api/events/${eventId}`)
      .then(r => r.json())
      .then(d => { if (d?.title) setFetchedEventName(d.title) })
      .catch(() => {})
  }, [eventName, eventId])
  
  useEffect(() => {
    let cancelled = false

    async function verify() {
      const pidx = searchParams.get('pidx')
      const provider = searchParams.get('provider')
      const status = searchParams.get('status')
      const eventId = searchParams.get('eventId')
      const reason = searchParams.get('reason')

      // eSewa: verification already done server-side in callback
      if (provider === 'esewa') {
        if (status === 'success') {
          setVerificationState('success')
        } else {
          setErrorMsg(reason || 'Payment verification failed.')
          setVerificationState('failed')
        }
        return
      }

      const resolvedProvider = provider || (pidx ? 'khalti' : searchParams.get('data') ? 'esewa' : null)
      let data = searchParams.get('data')

      if (resolvedProvider && resolvedProvider.includes('esewa?data=')) {
        data = resolvedProvider.split('esewa?data=')[1];
      } else if (resolvedProvider && resolvedProvider.includes('?data=')) {
        data = resolvedProvider.split('?data=')[1];
      }

      if (!resolvedProvider) {
        if (searchParams.get('payment') === 'success') {
          setVerificationState('success')
        } else {
          setErrorMsg('Invalid payment verification parameters.')
          setVerificationState('failed')
        }
        return
      }

      const payload = resolvedProvider === 'khalti' 
        ? { provider: resolvedProvider, pidx, status, purchase_order_id: searchParams.get('purchase_order_id'), transaction_id: searchParams.get('transaction_id'), tidx: searchParams.get('tidx') }
        : { provider: resolvedProvider, data }

      const minDuration = new Promise(resolve => setTimeout(resolve, 1500))

      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const resData = await res.json()

        await minDuration
        if (cancelled) return

        if (resData.success) {
          setVerificationState('success')
        } else {
          setErrorMsg(resData.error || 'Payment verification failed.')
          setVerificationState('failed')
        }
      } catch (err) {
        await minDuration
        if (cancelled) return
        setErrorMsg('An error occurred during verification.')
        setVerificationState('failed')
        console.error(err)
      }
    }

    verify()

    return () => { cancelled = true }
  }, [searchParams])

  if (verificationState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#14b8a6', borderTopColor: 'transparent' }} />
          <p className="text-gray-400 text-lg">Verifying your payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f172a' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
      >
        <div className="rounded-2xl p-8 border"
          style={{ background: '#1e293b', borderColor: '#334155' }}>
          
          {verificationState === 'success' ? (
            <>
              <div className="flex justify-center mb-6">
                <HiCheckCircle className="w-20 h-20" style={{ color: '#14b8a6' }} />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
              {eventName && (
                <p className="text-gray-300 mb-2">
                  You&apos;re registered for <span className="font-semibold" style={{ color: '#14b8a6' }}>{eventName}</span>
                </p>
              )}
              <p className="text-gray-400 mb-8">
                Your registration is confirmed. Check your email for the QR code ticket.
              </p>
              <Link
                href="/my-events"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#14b8a6' }}
              >
                View My Events <HiArrowRight />
              </Link>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <HiXCircle className="w-20 h-20 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Payment Failed</h1>
              <p className="text-gray-400 mb-8">
                {errorMsg || 'We could not verify your payment. Please try again.'}
              </p>
              <Link
                href={eventId ? `/events/${eventId}` : "/events"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 bg-slate-600 hover:bg-slate-500"
              >
                Try Again <HiArrowRight />
              </Link>
            </>
          )}

          <div className="mt-6">
            <Link href="/events" className="text-sm text-gray-400 hover:text-gray-300 transition-colors">
              Browse more events
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function PaymentVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#14b8a6', borderTopColor: 'transparent' }} />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}

'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { HiXCircle, HiRefresh, HiArrowLeft } from 'react-icons/hi'

function FailedContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const eventId = searchParams.get('eventId')

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
          <div className="flex justify-center mb-6">
            <HiXCircle className="w-20 h-20 text-red-500" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Payment Failed</h1>

          {reason && (
            <p className="text-gray-300 mb-4">
              Reason: <span className="text-red-400">{reason}</span>
            </p>
          )}

          <p className="text-gray-400 mb-8">
            Your payment could not be processed. No charges have been made. Please try again or contact support.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {eventId ? (
              <Link
                href={`/events/${eventId}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#14b8a6' }}
              >
                <HiRefresh /> Try Again
              </Link>
            ) : (
              <Link
                href="/events"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#14b8a6' }}
              >
                <HiRefresh /> Try Again
              </Link>
            )}

            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all border"
              style={{ borderColor: '#334155', color: '#94a3b8' }}
            >
              <HiArrowLeft /> Back to Events
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#14b8a6', borderTopColor: 'transparent' }} />
      </div>
    }>
      <FailedContent />
    </Suspense>
  )
}

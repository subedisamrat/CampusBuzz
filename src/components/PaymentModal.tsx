'use client'
import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, ShieldCheck, Lock, AlertTriangle } from 'lucide-react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventTitle: string
  amount: number
  onSuccess: () => void
}

const PaymentModal = memo(function PaymentModal({ isOpen, onClose, eventId, eventTitle, amount, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<'khalti' | 'esewa' | null>(null)
  const [error, setError] = useState('')
  const [policyAccepted, setPolicyAccepted] = useState(false)

  useEffect(() => { if (!isOpen) setPolicyAccepted(false); }, [isOpen])

  const handlePayment = async (provider: 'khalti' | 'esewa') => {
    setLoading(true)
    setError('')
    setSelectedProvider(provider)

    try {
      const res = await fetch('/api/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, provider }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (provider === 'khalti') {
        const paymentUrl = data.khaltiConfig?.additionalData?.payment_url
        if (!paymentUrl) throw new Error('Failed to get Khalti payment URL')
        window.location.href = paymentUrl
      } else if (provider === 'esewa') {
        const config = data.esewaConfig
        const transactionUuid = data.productIdentity

        const form = document.createElement('form')
        form.method = 'POST'
        form.action = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

        const fields: Record<string, string> = {
          amount: String(config.amount),
          tax_amount: '0',
          total_amount: String(config.totalAmount),
          transaction_uuid: transactionUuid,
          product_code: config.merchantId || 'EPAYTEST',
          product_service_charge: '0',
          product_delivery_charge: '0',
          success_url: config.merchantCallbackUrl,
          failure_url: `${window.location.origin}/payment/failed?eventId=${eventId}`,
          signed_field_names: 'total_amount,transaction_uuid,product_code',
          signature: data.signature || '',
        }

        Object.entries(fields).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = value
          form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment')
      setLoading(false)
      setSelectedProvider(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#14b8a620' }}>
                  <Lock size={18} style={{ color: '#14b8a6' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Secure Payment</h2>
                  <p className="text-xs" style={{ color: '#64748b' }}>256-bit encrypted</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="p-2 rounded-lg transition-all disabled:opacity-50"
                style={{ color: '#64748b' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Event Summary */}
            <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Registering for</p>
              <p className="text-white font-semibold text-base mb-3 line-clamp-1">{eventTitle}</p>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #334155' }}>
                <span className="text-sm" style={{ color: '#94a3b8' }}>Total Amount</span>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-white">Rs. {amount}</span>
                  <p className="text-xs" style={{ color: '#64748b' }}>One-time payment</p>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ backgroundColor: '#14b8a610', border: '1px solid #14b8a630' }}>
                <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: '#14b8a6' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#14b8a6' }}>
                    Redirecting to {selectedProvider === 'khalti' ? 'Khalti' : 'eSewa'}...
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>Please wait, do not close this window</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl p-3 mb-4 text-sm" style={{ backgroundColor: '#ef444410', border: '1px solid #ef444430', color: '#f87171' }}>
                {error}
              </div>
            )}

            {/* Policy notice */}
            <div className="p-3 rounded-xl mb-4"
                 style={{ background: 'rgba(245,158,11,0.06)',
                          border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-1">Non-Refundable</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                    Ticket fees are non-refundable unless the event is cancelled by the organiser.
                  </p>
                </div>
              </div>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <div className="relative mt-0.5">
                <input type="checkbox" checked={policyAccepted}
                       onChange={(e) => setPolicyAccepted(e.target.checked)}
                       className="sr-only" />
                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                  policyAccepted ? 'bg-teal-500' : 'bg-white/5 border border-white/20'
                }`}>
                  {policyAccepted && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                I understand this payment is non-refundable unless the event is cancelled.
              </span>
            </label>

            {/* Payment buttons */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
                Choose Payment Method
              </p>

              {/* Khalti */}
              <button
                onClick={() => handlePayment('khalti')}
                disabled={loading || !policyAccepted}
                className="w-full rounded-xl flex items-center gap-4 transition-all relative overflow-hidden"
                style={{
                  padding: '14px 16px',
                  background: loading && selectedProvider === 'khalti'
                    ? 'linear-gradient(135deg, #7c3aed, #db2777)'
                    : !policyAccepted
                      ? 'linear-gradient(135deg, #1e1e2e, #2a2a3e)'
                      : 'linear-gradient(135deg, #7c3aed, #db2777)',
                  opacity: (!policyAccepted || (loading && selectedProvider !== 'khalti')) ? 0.4 : 1,
                  cursor: !policyAccepted || loading ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  {loading && selectedProvider === 'khalti' ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <span className="text-white font-bold text-sm">K</span>
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold">Pay with Khalti</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {loading && selectedProvider === 'khalti' ? 'Processing...' : 'Wallet · Mobile Banking · Cards'}
                  </p>
                </div>
                {!loading && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    →
                  </span>
                )}
              </button>

              {/* eSewa */}
              <button
                onClick={() => handlePayment('esewa')}
                disabled={loading || !policyAccepted}
                className="w-full rounded-xl flex items-center gap-4 transition-all"
                style={{
                  padding: '14px 16px',
                  background: !policyAccepted
                    ? 'linear-gradient(135deg, #1e1e2e, #2a2a3e)'
                    : 'linear-gradient(135deg, #16a34a, #0d9488)',
                  opacity: (!policyAccepted || (loading && selectedProvider !== 'esewa')) ? 0.4 : 1,
                  cursor: !policyAccepted || loading ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  {loading && selectedProvider === 'esewa' ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <span className="text-white font-bold text-sm">eS</span>
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold">Pay with eSewa</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {loading && selectedProvider === 'esewa' ? 'Processing...' : 'eSewa Wallet · Bank Transfer'}
                  </p>
                </div>
                {!loading && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    →
                  </span>
                )}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <ShieldCheck size={14} style={{ color: '#64748b' }} />
              <p className="text-xs" style={{ color: '#64748b' }}>
                Secured by Khalti & eSewa · Your data is protected
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default PaymentModal

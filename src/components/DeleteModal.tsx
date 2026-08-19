'use client'
import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (cancelReason?: string) => void
  title: string
  itemName: string
  loading?: boolean
  deleteText?: string
  showReasonInput?: boolean
}

const DeleteModal = memo(function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  loading = false,
  deleteText = 'Delete',
  showReasonInput = false,
}: DeleteModalProps) {
  const [cancelReason, setCancelReason] = useState('')

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mb-4 mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
            <p className="text-muted-foreground text-center mb-6">
              Are you sure you want to {deleteText.toLowerCase()} &quot;{itemName}&quot;? This action cannot be undone.
            </p>

            {showReasonInput && (
              <div className="mb-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs font-bold">!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All attendees will be notified and their registrations cancelled.
                  </p>
                </div>
                <label className="block text-xs font-semibold text-red-400 mb-2">
                  Cancellation reason
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Venue unavailable, event postponed..."
                  rows={3}
                  className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5
                             text-white text-sm placeholder-gray-600 resize-none
                             focus:outline-none focus:border-red-500/40 transition-all"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(cancelReason)}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {deleteText}...
                  </>
                ) : (
                  deleteText
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default DeleteModal

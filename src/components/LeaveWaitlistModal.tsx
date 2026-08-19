'use client';
import { useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle } from 'lucide-react';

interface LeaveWaitlistModalProps {
  isOpen: boolean;
  eventTitle: string;
  position: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const LeaveWaitlistModal = memo(function LeaveWaitlistModal({
  isOpen,
  eventTitle,
  position,
  onConfirm,
  onCancel,
  loading = false,
}: LeaveWaitlistModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, loading, onCancel]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: '#0a1a18',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <Clock size={17} style={{ color: '#f59e0b' }} />
                </div>
                <h2 className="text-base font-bold text-white">Leave Waitlist?</h2>
              </div>
              <button
                onClick={onCancel}
                disabled={loading}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{ color: '#64748b' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* Warning notice */}
              <div
                className="flex items-start gap-3 p-3 rounded-xl mb-5"
                style={{
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.18)',
                }}
              >
                <AlertTriangle
                  size={15}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: '#f59e0b' }}
                />
                <p className="text-xs leading-relaxed" style={{ color: '#cbd5e1' }}>
                  You&apos;re currently{' '}
                  {position ? (
                    <span className="font-semibold" style={{ color: '#f59e0b' }}>
                      #{position} in line
                    </span>
                  ) : (
                    'on the waitlist'
                  )}{' '}
                  for{' '}
                  <span className="font-semibold text-white">
                    {eventTitle}
                  </span>
                  . Leaving will permanently remove your spot and you will lose your queue position.
                </p>
              </div>

              <p className="text-sm text-center mb-6" style={{ color: '#94a3b8' }}>
                Are you sure you want to leave the waitlist?
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                  }}
                >
                  Keep My Spot
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                  style={{
                    background: loading ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.85)',
                    color: '#fff',
                  }}
                  onMouseEnter={e => {
                    if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#ef4444';
                  }}
                  onMouseLeave={e => {
                    if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.85)';
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Leaving...
                    </span>
                  ) : (
                    'Yes, Leave'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default LeaveWaitlistModal;

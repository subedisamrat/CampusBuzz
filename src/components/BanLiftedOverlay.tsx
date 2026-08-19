'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle, X, ArrowRight } from 'lucide-react';

function storageKey(key: string): string {
  return `${key}`;
}

export default function BanLiftedOverlay() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ?? '';
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const lastBannedRef = useRef<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUserIdRef = useRef<string>('');

  function checkBanStatus() {
    if (!userId) return;

    fetch('/api/user/ban-status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const isBanned = data.isBanned;

        const lastBanKey = storageKey('lastBanStatus');
        const dismissedKey = storageKey('banLiftedOverlayDismissed');

        // Persist current ban state
        if (isBanned) {
          localStorage.setItem(lastBanKey, 'banned');
          // Clean up dismissed flag so next lift will show overlay
          localStorage.removeItem(dismissedKey);
        }

        // User changed — reset ref so first-check logic runs again
        if (prevUserIdRef.current !== userId) {
          prevUserIdRef.current = userId;
          lastBannedRef.current = null;
        }

        // First check — initialize from localStorage
        if (lastBannedRef.current === null) {
          const stored = localStorage.getItem(lastBanKey);
          lastBannedRef.current = stored === 'banned';
          if (lastBannedRef.current && !isBanned) {
            setShow(true);
            setTimeout(() => setVisible(true), 100);
            lastBannedRef.current = false;
          }
          return;
        }

        // Transition: banned → not banned
        if (lastBannedRef.current === true && !isBanned) {
          const dismissed = localStorage.getItem(dismissedKey);
          if (dismissed === 'true') {
            lastBannedRef.current = false;
            return;
          }
          setShow(true);
          setTimeout(() => setVisible(true), 100);
          lastBannedRef.current = false;
        }

        lastBannedRef.current = isBanned;
      })
      .catch(err => console.error(err));
  }

  useEffect(() => {
    // Reset on user change so new user gets fresh detection
    if (prevUserIdRef.current !== userId && userId) {
      prevUserIdRef.current = userId;
      lastBannedRef.current = null;
    }

    checkBanStatus();
    intervalRef.current = setInterval(checkBanStatus, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey('banLiftedOverlayDismissed'), 'true');
    setVisible(false);
    setTimeout(() => setShow(false), 300);
  };

  if (!show || !userId) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: visible ? 'rgba(0,0,0,0.75)' : 'transparent',
        backdropFilter: visible ? 'blur(8px)' : 'none',
        transition: 'background 0.5s ease, backdrop-filter 0.5s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#0a0a0f',
          border: visible ? '1px solid rgba(20,184,166,0.3)' : '1px solid transparent',
          boxShadow: visible ? '0 0 80px rgba(20,184,166,0.1)' : 'none',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, border 0.3s ease',
        }}
      >
        <div className="h-1.5 w-full"
             style={{ background: 'linear-gradient(90deg,#14b8a6,#0d9488,#14b8a6)',
                      backgroundSize: '200% 100%',
                      animation: 'ban-gradient 2s linear infinite' }} />

        <div className="p-8 text-center">
          <button onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg"
            style={{ color: '#4b5563' }}
            title="Dismiss">
            <X size={16} />
          </button>

          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ background: 'rgba(20,184,166,0.1)',
                        border: '2px solid rgba(20,184,166,0.3)' }}>
            <CheckCircle size={36} style={{ color: '#14b8a6' }} />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Restriction Lifted</h2>
          <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>
            Your account restriction has been removed by an admin.
            You can now register for events again.
          </p>

          <button onClick={handleDismiss}
            className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(20,184,166,0.1)',
                     border: '1px solid rgba(20,184,166,0.25)',
                     color: '#14b8a6' }}>
            <span className="flex items-center justify-center gap-2">
              Continue browsing
              <ArrowRight size={14} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

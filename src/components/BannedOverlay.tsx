'use client';

import { useState, useEffect, useRef } from 'react';
import { Ban, X, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';

interface BanInfo {
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
}

function storageKey(key: string): string {
  return `${key}`;
}

export default function BannedOverlay() {
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id ?? '';
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const prevUserIdRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function checkBanStatus() {
    if (!userId) return;

    fetch('/api/user/ban-status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.isBanned) {
          localStorage.setItem(storageKey('lastBanStatus'), 'banned');
          // Check if dismissed for this user
          const dismissed = localStorage.getItem(storageKey('bannedOverlayDismissed'));
          if (dismissed === 'true') return;
          setBanInfo(data);
          setTimeout(() => setVisible(true), 100);
        } else {
          setVisible(false);
          setTimeout(() => setBanInfo(null), 300);
        }
      })
      .catch(err => console.error(err));
  }

  useEffect(() => {
    const isNowAuth = status === 'authenticated';
    if (!isNowAuth || !userId) {
      setBanInfo(null);
      setVisible(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // User changed — clear previous dismissal and re-check
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      setBanInfo(null);
      setVisible(false);
    }

    checkBanStatus();
    intervalRef.current = setInterval(checkBanStatus, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, userId]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey('bannedOverlayDismissed'), 'true');
    setVisible(false);
    setTimeout(() => setBanInfo(null), 300);
  };

  if (!banInfo?.isBanned || !userId) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: visible
          ? 'rgba(0, 0, 0, 0.85)'
          : 'transparent',
        backdropFilter: visible ? 'blur(8px)' : 'none',
        transition: 'background 0.5s ease, backdrop-filter 0.5s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#0a0a0f',
          border: visible ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
          boxShadow: visible ? '0 0 80px rgba(0,0,0,0.5)' : 'none',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, border 0.3s ease',
        }}
      >
        <div className="p-8 text-center">
          <button onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg"
            style={{ color: '#4b5563' }}
            title="Dismiss">
            <X size={16} />
          </button>

          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ background: 'rgba(100,100,100,0.1)',
                        border: '2px solid rgba(100,100,100,0.2)' }}>
            <Ban size={36} style={{ color: '#9ca3af' }} />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Account Restricted</h2>
          <p className="text-sm mb-5" style={{ color: '#9ca3af' }}>
            Your account has been restricted from registering for events.
          </p>

          {banInfo.banReason && (
            <div className="p-4 rounded-xl mb-5 text-left"
                 style={{ background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#9ca3af' }}>
                Reason:
              </p>
              <p className="text-sm" style={{ color: '#d1d5db' }}>
                {banInfo.banReason}
              </p>
            </div>
          )}

          {banInfo.bannedAt && (
            <p className="text-xs mb-5" style={{ color: '#4b5563' }}>
              Restricted on {format(new Date(banInfo.bannedAt), 'MMM d, yyyy')}
            </p>
          )}

          <div className="p-3 rounded-xl mb-5"
               style={{ background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              If you believe this is a mistake, visit the admin office
              with your student ID to appeal this decision.
            </p>
          </div>

          <button onClick={handleDismiss}
            className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)',
                     border: '1px solid rgba(255,255,255,0.1)',
                     color: '#d1d5db' }}>
            <span className="flex items-center justify-center gap-2">
              I understand — Continue browsing
              <ArrowRight size={14} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

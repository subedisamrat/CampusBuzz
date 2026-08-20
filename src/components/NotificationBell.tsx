'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, X, AlertTriangle, Clock, Ticket, CreditCard, Trophy, Calendar, Ban, ShieldX, Trash2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  eventId?: string;
  eventTitle?: string;
  registrationId?: string;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string;
  bannedAt?: string;
  position?: number;
  queueLength?: number;
  feeAmount?: number;
  readAt: string | null;
  createdAt: string;
  isLive?: boolean;
  isUrgent?: boolean;
  priority: number;
}

// ─── Icon + colour config per type ───────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
}> = {
  confirm_attendance: {
    icon: Clock,
    iconBg: 'rgba(245,158,11,0.15)',
    iconColor: '#f59e0b',
    label: 'Action required',
  },
  qr_ready: {
    icon: Ticket,
    iconBg: 'rgba(20,184,166,0.15)',
    iconColor: '#14b8a6',
    label: 'QR ready',
  },
  event_tomorrow: {
    icon: Calendar,
    iconBg: 'rgba(59,130,246,0.15)',
    iconColor: '#60a5fa',
    label: 'Upcoming',
  },
  event_soon: {
    icon: AlertTriangle,
    iconBg: 'rgba(239,68,68,0.15)',
    iconColor: '#f87171',
    label: 'Starting soon',
  },
  checked_in: {
    icon: Check,
    iconBg: 'rgba(34,197,94,0.15)',
    iconColor: '#4ade80',
    label: 'Checked in',
  },
  promoted: {
    icon: Trophy,
    iconBg: 'rgba(20,184,166,0.15)',
    iconColor: '#14b8a6',
    label: 'Got a spot',
  },
  waitlist_position: {
    icon: Clock,
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#f59e0b',
    label: 'Waitlist',
  },
  notify_me: {
    icon: Bell,
    iconBg: 'rgba(168,85,247,0.15)',
    iconColor: '#c084fc',
    label: 'Watching',
  },
  payment_confirmed: {
    icon: CreditCard,
    iconBg: 'rgba(20,184,166,0.15)',
    iconColor: '#14b8a6',
    label: 'Paid',
  },
  banned: {
    icon: Ban,
    iconBg: 'rgba(239,68,68,0.15)',
    iconColor: '#f87171',
    label: 'Account',
  },
  check_denied: {
    icon: ShieldX,
    iconBg: 'rgba(239,68,68,0.15)',
    iconColor: '#f87171',
    label: 'Denied',
  },
  event_cancelled: {
    icon: X,
    iconBg: 'rgba(239,68,68,0.15)',
    iconColor: '#f87171',
    label: 'Cancelled',
  },
  ban_lifted: {
    icon: Check,
    iconBg: 'rgba(20,184,166,0.15)',
    iconColor: '#14b8a6',
    label: 'Restriction lifted',
  },
  tier_override: {
    icon: Trophy,
    iconBg: 'rgba(250,204,21,0.15)',
    iconColor: '#fbbf24',
    label: 'Tier updated',
  },
};

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  onAction,
  onDelete,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onAction: (url: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.notify_me;
  const Icon = cfg.icon;
  const isRead = !!notif.readAt;
  const isUrgent = notif.isUrgent;

  // Countdown for confirm_attendance
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (notif.type !== 'confirm_attendance' || !notif.expiresAt) return;
    const update = () => {
      const diff = new Date(notif.expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [notif.expiresAt, notif.type]);

  return (
    <div
      className="group relative px-4 py-3.5 transition-colors"
      style={{
        background: isRead ? 'transparent' : isUrgent ? 'rgba(239,68,68,0.04)' : 'rgba(20,184,166,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
          style={{ background: cfg.iconBg }}
        >
          <Icon size={16} style={{ color: cfg.iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-[13px] font-semibold leading-snug"
              style={{ color: isRead ? '#94a3b8' : '#f1f5f9' }}
            >
              {notif.title}
            </p>
          </div>

          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: isRead ? '#475569' : '#94a3b8' }}
          >
            {notif.body}
          </p>

          {/* Countdown pill for confirm_attendance */}
          {notif.type === 'confirm_attendance' && timeLeft && (
            <div
              className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: timeLeft === 'Expired' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: timeLeft === 'Expired' ? '#f87171' : '#f59e0b',
              }}
            >
              <Clock size={9} />
              {timeLeft}
            </div>
          )}

          {/* Waitlist position badge */}
          {notif.type === 'waitlist_position' && notif.position && (
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
              >
                #{notif.position} in queue
              </span>
              {notif.queueLength && (
                <span className="text-[10px]" style={{ color: '#475569' }}>
                  {notif.queueLength} total waiting
                </span>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px]" style={{ color: '#374151' }}>
              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
            </span>

            <div className="flex items-center gap-1 ml-auto">
              {/* Tick — Mark as read */}
              {!isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRead(notif._id); }}
                  className="p-1 rounded-md transition-colors hover:bg-white/10"
                  title="Mark as read"
                >
                  <Check size={11} style={{ color: '#64748b' }} />
                </button>
              )}

              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(notif._id); }}
                className="p-1 rounded-md transition-colors hover:bg-red-500/20"
                title="Delete notification"
              >
                <Trash2 size={11} style={{ color: '#6b7280' }} />
              </button>

              {/* Action link */}
              {notif.actionUrl && notif.actionLabel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRead(notif._id);
                    onAction(notif.actionUrl!);
                  }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
                  style={{
                    background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(20,184,166,0.12)',
                    color: isUrgent ? '#f87171' : '#14b8a6',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background =
                      isUrgent ? 'rgba(239,68,68,0.25)' : 'rgba(20,184,166,0.22)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background =
                      isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(20,184,166,0.12)';
                  }}
                >
                  {notif.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Unread dot */}
        {!isRead && (
          <div
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2"
            style={{ background: isUrgent ? '#f87171' : '#14b8a6' }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Bell Component ──────────────────────────────────────────────────────

export default function NotificationBell() {
  const router = useRouter();
  const bellRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      let items = data.notifications ?? [];
      // Filter out notifications the user has already dismissed on this device
      try {
        const liveDismissed = new Set(JSON.parse(sessionStorage.getItem('readLiveNotifs') || '[]'));
        const allDismissed = new Set(JSON.parse(sessionStorage.getItem('readNotifIds') || '[]'));
        const dismissed = new Set([...liveDismissed, ...allDismissed]);
        if (dismissed.size > 0) {
          items = items.filter((n: Notification) => !dismissed.has(n._id));
        }
      } catch {}
      setNotifications(items);
      const unread = items.filter((n: Notification) => !n.readAt).length;
      setUnreadCount(unread);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + 15s auto-refresh
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const isLiveId = (id: string) =>
    id.startsWith('confirm-') || id.startsWith('tomorrow-') ||
    id.startsWith('soon-') || id.startsWith('waitlist-') ||
    id.startsWith('notifyme-') || id.startsWith('banned') ||
    id.startsWith('denied-');

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      n._id === id ? { ...n, readAt: new Date().toISOString() } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Persist read state in sessionStorage so it survives navigation
    try {
      const dismissed = new Set(JSON.parse(sessionStorage.getItem('readNotifIds') || '[]'));
      dismissed.add(id);
      sessionStorage.setItem('readNotifIds', JSON.stringify([...dismissed]));
    } catch {}

    if (!isLiveId(id)) {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      }).catch(err => console.error(err));
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic remove
    setNotifications(prev => prev.filter(n => n._id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (!id.startsWith('confirm-') && !id.startsWith('tomorrow-') &&
        !id.startsWith('soon-') && !id.startsWith('waitlist-') &&
        !id.startsWith('notifyme-') && !id.startsWith('banned') &&
        !id.startsWith('denied-')) {
      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      }).catch(err => console.error(err));
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    // Optimistic update + persist live notification IDs to sessionStorage
    setNotifications(prev => {
      const liveIds = prev.filter(n => isLiveId(n._id)).map(n => n._id);
      if (liveIds.length > 0) {
        try {
          const readSet = new Set(JSON.parse(sessionStorage.getItem('readLiveNotifs') || '[]'));
          liveIds.forEach(id => readSet.add(id));
          sessionStorage.setItem('readLiveNotifs', JSON.stringify([...readSet]));
        } catch {}
      }
      return prev.map(n => ({ ...n, readAt: n.readAt ?? now }));
    });
    setUnreadCount(0);
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(err => console.error(err));
    setLoading(false);
  }, []);

  const handleAction = useCallback((url: string) => {
    setOpen(false);
    router.push(url);
  }, [router]);

  const toggleOpen = () => {
    setOpen(prev => !prev);
    if (!open) fetchNotifications(); // fresh fetch on open
  };

  // ── Display filtering ──────────────────────────────────────────────────────
  const unreadItems = notifications.filter(n => !n.readAt);
  const allItems = notifications;
  const displayItems = activeTab === 'unread' ? unreadItems : allItems;

  // Group display items
  const urgent = displayItems.filter(n => n.isUrgent && !n.readAt);
  const actionRequired = displayItems.filter(
    n => !n.isUrgent && !n.readAt &&
    ['confirm_attendance', 'banned', 'check_denied'].includes(n.type)
  );
  const rest = displayItems.filter(
    n => !urgent.includes(n) && !actionRequired.includes(n)
  );

  return (
    <div className="relative" ref={bellRef}>
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5
                   transition-all"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5
                       bg-teal-500 text-[#042f2e] text-[9px] font-bold rounded-full
                       flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] rounded-2xl shadow-2xl z-[9999]
                     flex flex-col"
          style={{
            width: 'min(400px, calc(100vw - 32px))',
            maxHeight: 'min(580px, calc(100vh - 100px))',
            background: '#0a1520',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-white">Notifications</p>
              {unreadCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg
                             transition-colors disabled:opacity-50"
                  style={{ color: '#64748b' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#374151' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div
            className="flex flex-shrink-0 px-4 pt-3 pb-0 gap-1"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            {(['unread', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-3 pb-3 text-[12px] font-semibold transition-colors relative capitalize"
                style={{ color: activeTab === tab ? '#14b8a6' : '#475569' }}
              >
                {tab === 'unread' ? `Unread (${unreadCount})` : `All (${allItems.length})`}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ background: '#14b8a6' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Notification list ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <Bell size={20} style={{ color: '#374151' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#64748b' }}>
                  {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#374151' }}>
                  {activeTab === 'unread'
                    ? 'Switch to "All" to see your history'
                    : 'Notifications will appear here'}
                </p>
              </div>
            ) : (
              <>
                {/* Urgent group */}
                {urgent.length > 0 && (
                  <>
                    <div
                      className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.04)' }}
                    >
                      Urgent
                    </div>
                    {urgent.map(n => (
                      <NotifRow
                        key={n._id}
                        notif={n}
                        onRead={markRead}
                        onAction={handleAction}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </>
                )}

                {/* Action required group */}
                {actionRequired.length > 0 && (
                  <>
                    <div
                      className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.03)' }}
                    >
                      Action required
                    </div>
                    {actionRequired.map(n => (
                      <NotifRow
                        key={n._id}
                        notif={n}
                        onRead={markRead}
                        onAction={handleAction}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </>
                )}

                {/* Rest */}
                {rest.length > 0 && (
                  <>
                    {(urgent.length > 0 || actionRequired.length > 0) && (
                      <div
                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: '#374151' }}
                      >
                        Other
                      </div>
                    )}
                    {rest.map(n => (
                      <NotifRow
                        key={n._id}
                        notif={n}
                        onRead={markRead}
                        onAction={handleAction}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button
              onClick={() => { handleAction('/my-events'); }}
              className="text-[12px] font-semibold transition-colors flex items-center gap-1"
              style={{ color: '#14b8a6' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#5eead4')}
              onMouseLeave={e => (e.currentTarget.style.color = '#14b8a6')}
            >
              View my events →
            </button>
            <button
              onClick={fetchNotifications}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={{
                color: '#94a3b8',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.color = '#94a3b8';
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

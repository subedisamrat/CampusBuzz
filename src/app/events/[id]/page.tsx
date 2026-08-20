"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { cacheGet, cacheSet } from '@/lib/client-cache';
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import PaymentModal from "@/components/PaymentModal";
import LeaveWaitlistModal from "@/components/LeaveWaitlistModal";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ArrowLeft,
  Ticket,
  CheckCircle,
  XCircle,
  CreditCard,
  Share2,
  AlertTriangle,
  Check,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import TitleSetter from '@/components/TitleSetter';
import SoldOutStamp from '@/components/ui/SoldOutStamp';
import { CATEGORY_COLORS, TIER_CONFIG, formatWindowTime } from '@/lib/constants';

interface EventData {
  _id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  endDate: string;
  venue: string;
  capacity: number;
  registeredCount: number;
  organizer: string;
  imageUrl: string;
  tags: string[];
  feeType: 'free' | 'paid';
  feeAmount: number;
  registrationDeadline?: string;
  isCancelled: boolean;
  cancelReason?: string;
}

interface Registration {
  _id: string;
  eventId: string;
  registrationId: string;
}

interface WaitlistStatus {
  position: number;
  queueLength: number;
  tier?: string;
  championsAhead?: number;
  priorityNote?: string;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);
  const [waitlistInfo, setWaitlistInfo] = useState<WaitlistStatus | null>(null);
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [interested, setInterested] = useState(false); // paid event "Notify Me"
  const [copied, setCopied] = useState(false);
  const [reliabilityData, setReliabilityData] = useState<{
    tier: string;
    confirmationWindowHours: number;
    waitlistMultiplier: number;
    waitlistPenaltyHours: number;
  } | null>(null);
  const [denialInfo, setDenialInfo] = useState<{ flagReason?: string; adminNote?: string } | null>(null);
  const [banMessage, setBanMessage] = useState<{ reason?: string; bannedAt?: string } | null>(null);
  // Ban status fetched on mount so buttons are disabled before first click
  const [banStatus, setBanStatus] = useState<{ isBanned: boolean; banReason?: string } | null>(null);
  const [banStatusLoading, setBanStatusLoading] = useState(true);
  // Leave waitlist modal
  const [leaveWaitlistModal, setLeaveWaitlistModal] = useState(false);
  const [leavingWaitlist, setLeavingWaitlist] = useState(false);
  // Hydrate event from cache before first paint (synchronous)
  useEffect(() => {
    const cached = cacheGet<any>(`event_detail_${id}`)
    if (cached) {
      setEvent(cached);
      setLoading(false);
    }
  }, [id])

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEvent(data);
        cacheSet(`event_detail_${id}`, data, 300_000);
        setLoading(false);
      });

    if (session) {
      // Fetch ban status upfront so buttons are disabled before first click
      fetch('/api/user/ban-status')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setBanStatus(d); })
        .catch(err => console.error(err))
        .finally(() => setBanStatusLoading(false));
      // Fetch student's tier for context below register button
      fetch('/api/user/reliability')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) setReliabilityData({
            tier: d.tier,
            confirmationWindowHours: d.benefits.confirmationWindowHours,
            waitlistMultiplier: d.benefits.waitlistMultiplier,
            waitlistPenaltyHours: d.benefits.waitlistPenaltyHours ?? 0,
          });
        })
        .catch(err => console.error(err));

      fetch('/api/registrations')
        .then((r) => r.json())
        .then((data) => {
          const regs = data.registrations || [];
          // eventId may be a populated object or a string
          const hasReg = regs.some((reg: any) => {
            const eid = typeof reg.eventId === 'object' ? reg.eventId?._id?.toString() : reg.eventId?.toString();
            return eid === id?.toString();
          });
          if (hasReg) {
            setRegistered(true);
            const existingReg = regs.find((reg: any) => {
              const eid = typeof reg.eventId === 'object' ? reg.eventId?._id?.toString() : reg.eventId?.toString();
              return eid === id?.toString();
            });
            if (existingReg?.confirmed && existingReg?.qrCode) setQrCode(existingReg.qrCode);
            if (existingReg?.registrationId) setRegistrationId(existingReg.registrationId);
            if (existingReg?.reviewStatus === 'denied') {
              setDenialInfo({
                flagReason: existingReg.flagReason,
                adminNote: existingReg.adminNote,
              });
            }
          }
        });

      fetch(`/api/waitlist?eventId=${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.onWaitlist) {
            setWaitlisted(true);
            setWaitlistInfo({
              position: data.position,
              queueLength: data.queueLength,
              tier: data.tier,
              championsAhead: data.championsAhead,
              priorityNote: data.priorityNote,
            });
          }
        })
        .catch(err => console.error(err));

      // Check paid event interest
      fetch(`/api/event-interest?eventId=${id}`)
        .then((r) => r.json())
        .then((data) => { if (data.interested) setInterested(true); })
        .catch(err => console.error(err));
    } else {
      // Not logged in — no ban check needed, clear loading state immediately
      setBanStatusLoading(false);
    }
  }, [id, session]);

  // Poll waitlist position every 10s when waitlisted
  useEffect(() => {
    if (!waitlisted || !id) return;
    const refresh = () => {
      fetch(`/api/waitlist?eventId=${id}`)
        .then(r => r.json())
        .then(data => {
          if (data.onWaitlist) {
            setWaitlistInfo({
              position: data.position,
              queueLength: data.queueLength,
              tier: data.tier,
              championsAhead: data.championsAhead,
              priorityNote: data.priorityNote,
            });
          } else {
            // Promoted or removed — refresh registration state
            setWaitlisted(false);
            setWaitlistInfo(null);
            fetch('/api/registrations')
              .then(r => r.json())
              .then(d => {
                const regs = d.registrations || [];
                const hasReg = regs.some((reg: any) => {
                  const eid = typeof reg.eventId === 'object' ? reg.eventId?._id?.toString() : reg.eventId?.toString();
                  return eid === id?.toString();
                });
                if (hasReg) {
                  setRegistered(true);
                  const existingReg = regs.find((reg: any) => {
                    const eid = typeof reg.eventId === 'object' ? reg.eventId?._id?.toString() : reg.eventId?.toString();
                    return eid === id?.toString();
                  });
                  if (existingReg?.confirmed && existingReg?.qrCode) setQrCode(existingReg.qrCode);
                  if (existingReg?.registrationId) setRegistrationId(existingReg.registrationId);
                  toast.success("You've been promoted! You are now registered for this event.");
                }
              })
              .catch(() => {});
          }
        })
        .catch(err => console.error(err));
    };
    const id_ = setInterval(refresh, 10_000);
    return () => clearInterval(id_);
  }, [waitlisted, id]);

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title ?? 'Campus Event',
          text: `Check out ${event?.title} on CampusBuzz!`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User cancelled share or browser blocked clipboard — silent
    }
  };

  async function handleRegister() {    if (!session) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/events/${id}`)}`);
      return;
    }
    
    if (event?.feeType === 'paid' && event?.feeAmount > 0) {
      setShowPayment(true);
      return;
    }
    
    setRegistering(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await res.json();
      if (data.code === 'ACCOUNT_BANNED') {
        setBanMessage({ reason: data.banReason, bannedAt: data.bannedAt });
        return;
      }
      if (!res.ok) throw new Error(data.error);
      setRegistered(true);
      setQrCode('');
      setRegistrationId(data.registrationId || '');
      toast.success("Registered! Check your email to confirm your attendance.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!session) {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/events/${id}`)}`);
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWaitlisted(true);
      setWaitlistInfo({ position: data.position, queueLength: data.queueLength });
      const joinMsg = data.wasPromotedBefore
        ? `Rejoined waitlist at #${data.position}. Note: you have a penalty for previously cancelling after promotion.`
        : `Joined waitlist at #${data.position}. Students with better attendance history may rank ahead of you.`;
      toast.success(joinMsg, { duration: 5000 });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setRegistering(false);
    }
  }

  async function handleLeaveWaitlist() {
    if (!session) return;
    // Open modal — actual deletion happens in confirmLeaveWaitlist
    setLeaveWaitlistModal(true);
  }

  async function confirmLeaveWaitlist() {
    if (!session) return;
    setLeavingWaitlist(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLeaveWaitlistModal(false);
      setWaitlisted(false);
      setWaitlistInfo(null);
      toast.success("Left the waitlist");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to leave waitlist");
    } finally {
      setLeavingWaitlist(false);
    }
  }

  function handlePaymentSuccess() {
    setShowPayment(false);
    setRegistered(true);
    toast.success("Payment successful! Check your email for QR code.");
  }

  async function handleNotifyMe() {
    if (!session) { router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/events/${id}`)}`); return; }
    setRegistering(true);
    try {
      const res = await fetch("/api/event-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInterested(true);
      toast.success("We'll notify you when spots open up!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRegistering(false);
    }
  }

  async function handleRemoveInterest() {
    if (!session) return;
    try {
      await fetch("/api/event-interest", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      setInterested(false);
      toast.success("Removed from notify list");
    } catch { /* silent */ }
  }

  if (loading)
    return (
      <div className="min-h-screen grid-bg">
        <TitleSetter title="Loading..." />
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-4 w-24 bg-white/10 rounded mb-6" />
          <div className="h-72 bg-white/10 rounded-2xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-white/10 rounded" />
              <div className="h-4 w-1/2 bg-white/10 rounded" />
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-white/10 rounded-full" />
                <div className="h-6 w-20 bg-white/10 rounded-full" />
              </div>
              <div className="h-48 bg-white/10 rounded-2xl" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-white/10 rounded" />
                <div className="h-4 w-5/6 bg-white/10 rounded" />
                <div className="h-4 w-4/6 bg-white/10 rounded" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-48 bg-white/10 rounded-2xl" />
              <div className="h-32 bg-white/10 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );

  if (!event)
    return (
      <div>
        <Navbar />
        <div className="py-16 px-6 text-center text-gray-400">Event not found</div>
      </div>
    );

  const capacity = event.capacity ?? 0;
  const registeredCount = event.registeredCount ?? 0;
  const spotsLeft = capacity - registeredCount;
  const isFull = spotsLeft <= 0;
  const now = new Date();
  const eventDate = new Date(event.date);
  const eventEndDate = new Date(event.endDate || event.date);
  const deadlineDate = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

  const isCancelled = event.isCancelled;
  const isEnded = now > eventEndDate;
  const isHappening = now >= eventDate && now <= eventEndDate;
  const deadlinePassed = deadlineDate && now > deadlineDate;
  const isAdmin = (session?.user as any)?.role === 'admin';

  // Admins should use the admin event view, not the student page.
  // Redirect as soon as we know the role — prevents any flash of student UI.
  if (sessionStatus === 'authenticated' && isAdmin) {
    router.replace(`/admin/events/${event._id}/view`);
    return null;
  }

  return (
    <div>
      <TitleSetter title={event?.title || 'Event'} />
      <Navbar />
      {searchParams?.get('released') === 'true' && (
        <div className="mx-auto max-w-[900px] px-6 pt-6">
          <div className="p-3 rounded-xl flex items-start gap-2"
               style={{ background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.2)' }}>
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs" style={{ color: '#d97706' }}>
              Your previous registration expired. You can register again if spots are available.
            </p>
          </div>
        </div>
      )}
      <div className="max-w-[900px] mx-auto px-5 pt-10 pb-12 sm:px-6 sm:pt-12">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 font-semibold transition-colors"
        >
          <ArrowLeft size={16} /> Back to Events
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

          {/* Main Content */}
          <div>
            {/* Banner */}
            <div
              className="h-48 sm:h-[280px] rounded-2xl mb-8 bg-cover bg-center flex items-end p-5 sm:p-6 relative overflow-hidden"
              style={{
                background: event.imageUrl
                  ? `url(${event.imageUrl}) center/cover`
                  : `linear-gradient(135deg, ${
                      event.category === "Technical"
                        ? "#14b8a6, #0d9488"
                        : event.category === "Cultural"
                          ? "#f43f5e, #e11d48"
                          : event.category === "Sports"
                            ? "#f59e0b, #d97706"
                            : "#a78bfa, #7c3aed"
                    })`,
              }}
            >
            </div>

            {/* Badge row */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {(() => {
                const catColor = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Other;
                return (
                  <span
                    className={`inline-flex items-center px-3 py-1.5 rounded-full
                                text-xs font-semibold border
                                ${catColor.bg} ${catColor.text} ${catColor.border}`}
                  >
                    {event.category}
                  </span>
                );
              })()}
              {event.feeType === 'free' ? (
                <span
                  className="inline-flex items-center px-3 py-1.5 rounded-full
                             text-xs font-semibold border"
                  style={{
                    background: 'rgba(20,184,166,0.12)',
                    color: '#2dd4bf',
                    borderColor: 'rgba(20,184,166,0.3)',
                  }}
                >
                  Free Entry
                </span>
              ) : (
                <span
                  className="inline-flex items-center px-3 py-1.5 rounded-full
                             text-xs font-semibold border"
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    color: '#fbbf24',
                    borderColor: 'rgba(245,158,11,0.3)',
                  }}
                >
                  Rs. {event.feeAmount?.toLocaleString()}
                </span>
              )}
              {isFull && (
                <span
                  className="inline-flex items-center px-3 py-1.5 rounded-full
                             text-xs font-semibold border"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#f87171',
                    borderColor: 'rgba(239,68,68,0.3)',
                  }}
                >
                  At Capacity
                </span>
              )}
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 800,
                margin: "0 0 16px",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {event.title}
            </h1>

            {/* Share button */}
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={handleShare}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: copied ? '#14b8a6' : '#9ca3af',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-teal-400" style={{ lineHeight: 1 }} />
                    <span>Link copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={13} />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                marginBottom: 32,
              }}
            >
              {[
                { icon: Calendar, text: format(new Date(event.date), "PPP") },
                {
                  icon: Clock,
                  text: event.endDate
                    ? `${format(new Date(event.date), "p")} – ${format(new Date(event.endDate), "p")}`
                    : format(new Date(event.date), "p"),
                },
                // { icon: Clock, text: `${format(new Date(event.date), 'p')} – ${format(new Date(event.endDate), 'p')}` },
                { icon: MapPin, text: event.venue },
                {
                  icon: Users,
                  text: `${registeredCount}/${capacity} registered`,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--text-muted)",
                    fontSize: 14,
                  }}
                >
                  <item.icon size={16} style={{ color: "var(--accent)" }} />
                  {item.text}
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
                About this Event
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  lineHeight: 1.8,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {event.description}
              </p>
            </div>

            {event.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "6px 12px",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ position: "sticky", top: 84 }}>
            {/* Registration Card */}
            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              {isCancelled ? (
                <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, textAlign: 'center' }}>
                  <h3 style={{ color: '#ef4444', fontWeight: 700, margin: '0 0 8px', fontSize: 18 }}>Event Cancelled</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{event.cancelReason || 'No reason provided'}</p>
                </div>
              ) : isEnded ? (
                <div style={{ padding: 20, background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 12, textAlign: 'center' }}>
                  <h3 style={{ color: '#94a3b8', fontWeight: 700, margin: '0 0 8px', fontSize: 18 }}>Event Ended</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Ended on {format(eventEndDate, 'MMM d, yyyy')}</p>
                </div>
              ) : isHappening ? (
                <div style={{ padding: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, textAlign: 'center' }}>
                  <h3 style={{ color: '#3b82f6', fontWeight: 700, margin: 0, fontSize: 18 }}>Event is happening now</h3>
                </div>
              ) : deadlinePassed && !registered && !waitlisted ? (
                <div style={{ padding: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, textAlign: 'center' }}>
                  <h3 style={{ color: '#f59e0b', fontWeight: 700, margin: '0 0 8px', fontSize: 18 }}>Registration Closed</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Closed on {format(deadlineDate!, 'MMM d, yyyy')}</p>
                </div>
              ) : registered && denialInfo ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, background: "rgba(239,68,68,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <XCircle size={28} color="#ef4444" />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#ef4444" }}>
                    Check-in Denied ⛔
                  </h3>
                  {denialInfo.flagReason && (
                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 8px" }}>
                      {denialInfo.flagReason}
                    </p>
                  )}
                  {denialInfo.adminNote && (
                    <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 16, marginTop: 8 }}>
                      <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>
                        {denialInfo.adminNote}
                      </p>
                    </div>
                  )}
                </div>
              ) : registered ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, background: "rgba(20,184,166,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <CheckCircle size={28} color="var(--accent)" />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "var(--accent)" }}>
                    You&apos;re Registered! 🎉
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>
                    Check your email for confirmation details.
                  </p>
                  {qrCode ? (
                    <>
                      <Link 
                        href={`/my-events/checkin/${registrationId}`}
                        className="btn-primary" 
                        style={{ width: '100%', fontSize: 15, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}
                      >
                        <Ticket size={18} /> View my QR →
                      </Link>
                    </>
                  ) : (
                    <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: 16, marginTop: 8 }}>
                      <p style={{ color: "#f59e0b", fontSize: 13, margin: 0 }}>
                        QR code will be available after you confirm attendance 24h before the event.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Capacity bar */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        Capacity
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {spotsLeft} spots left
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--border)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${capacity > 0 ? (registeredCount / capacity) * 100 : 0}%`,
                          background:
                            spotsLeft < 20 ? "#f43f5e" : "var(--accent)",
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      marginBottom: 20,
                      fontSize: 14,
                      color: "var(--text-muted)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Organizer</span>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {event.organizer}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Date</span>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {format(new Date(event.date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Entry</span>
                      <span style={{ 
                        color: event.feeType === 'paid' ? "#f59e0b" : "var(--accent)", 
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {event.feeType === 'paid' ? (
                          <>
                            <CreditCard size={14} /> Rs. {event.feeAmount}
                          </>
                        ) : (
                          'FREE'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* ── Ban notice — shown upfront if student is banned ── */}
                  {session && banStatus?.isBanned && (
                    <div className="p-4 rounded-2xl mb-5"
                         style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="flex items-start gap-3">
                        <Ban size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-400 mb-1">
                            Account Restricted
                          </p>
                          <p className="text-xs leading-relaxed mb-2" style={{ color: '#94a3b8' }}>
                            {banStatus.banReason || 'Your account has been restricted from event registration.'}
                          </p>
                          <p className="text-xs" style={{ color: '#475569' }}>
                            If you believe this is an error, please visit the admin office with your student ID.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {event.feeType === 'paid' && spotsLeft <= 0 ? (
                    // PAID + FULL → Notify Me / Sold Out
                    interested ? (
                      <div style={{ textAlign: 'center' }}>
                        <div className="flex justify-center mb-4">
                          <SoldOutStamp size="md" />
                        </div>
                        <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                          🔔 You&apos;ll be notified when spots open
                        </div>
                        <button onClick={handleRemoveInterest} className="btn-ghost" style={{ width: '100%', fontSize: 13 }}>
                          Remove notification
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-center mb-4">
                          <SoldOutStamp size="lg" />
                        </div>
                        {/* Banned students can't join notify-me either */}
                        {session && banStatus?.isBanned ? (
                          <div
                            style={{
                              width: '100%', fontSize: 14, padding: '13px 24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 10, color: '#475569', cursor: 'not-allowed',
                            }}
                          >
                            Registration restricted
                          </div>
                        ) : (
                          <button
                            onClick={handleNotifyMe}
                            disabled={registering || banStatusLoading}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                                       flex items-center justify-center gap-2 disabled:opacity-50
                                       disabled:cursor-not-allowed"
                            style={{
                              background: 'rgba(99,102,241,0.15)',
                              border: '1px solid rgba(99,102,241,0.4)',
                              color: '#818cf8',
                              boxShadow: '0 0 20px rgba(99,102,241,0.05)',
                            }}
                          >
                            {registering ? 'Saving...' : 'Notify Me When Available'}
                          </button>
                        )}
                      </>
                    )

                  ) : event.feeType === 'free' && spotsLeft <= 0 ? (
                    // FREE + FULL → Waitlist (if already on it, show position + leave button)
                    waitlisted && waitlistInfo ? (
                      <div className="space-y-3">
                        <div style={{ textAlign: 'center', padding: '16px', borderRadius: 16, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <Clock size={16} className="text-amber-400" />
                            <span className="text-amber-400 font-bold text-lg">
                              #{waitlistInfo.position} in line
                            </span>
                          </div>
                          <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                            {waitlistInfo.queueLength} students waiting total
                          </p>
                        </div>
                        {waitlistInfo.priorityNote && (
                          <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {waitlistInfo.priorityNote}
                            </p>
                            {waitlistInfo.championsAhead && waitlistInfo.championsAhead > 0 && waitlistInfo.tier !== 'champion' && (
                              <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 6 }}>
                                {waitlistInfo.championsAhead} Champion student
                                {waitlistInfo.championsAhead > 1 ? 's are' : ' is'} ahead of you
                                due to their attendance history.
                              </p>
                            )}
                          </div>
                        )}
                        <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', margin: 0 }}>
                          You will receive your QR code by email when a spot opens. No further action needed.
                        </p>
                        <button onClick={handleLeaveWaitlist} disabled={leavingWaitlist}
                          className="w-full py-2 rounded-xl text-xs font-medium text-center
                                     transition-all border border-gray-700/50 text-gray-400
                                     hover:text-coral-400 hover:border-coral-500/30
                                     hover:bg-coral-500/5 disabled:opacity-50">
                          {leavingWaitlist ? 'Leaving...' : 'Leave waitlist'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-center mb-4">
                          <SoldOutStamp size="lg" />
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', margin: '0 0 16px' }}>
                          This event has reached capacity
                        </p>
                        {/* Banned students can't join waitlist */}
                        {session && banStatus?.isBanned ? (
                          <div
                            style={{
                              width: '100%', fontSize: 14, padding: '13px 24px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 10, color: '#475569', cursor: 'not-allowed',
                            }}
                          >
                            Registration restricted
                          </div>
                        ) : (
                          <button
                            onClick={handleJoinWaitlist}
                            disabled={registering || banStatusLoading}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                                       flex items-center justify-center gap-2 disabled:opacity-50
                                       disabled:cursor-not-allowed"
                            style={{
                              background: registering
                                ? 'rgba(245,158,11,0.05)'
                                : 'rgba(245,158,11,0.10)',
                              border: '1px solid rgba(245,158,11,0.35)',
                              color: '#f59e0b',
                              boxShadow: '0 0 20px rgba(245,158,11,0.05)',
                            }}
                          >
                            <Clock size={16} />
                            {registering ? 'Joining...' : 'Join Waitlist'}
                          </button>
                        )}
                      </>
                    )

                  ) : (
                    // SPOTS AVAILABLE → Register / Buy Ticket
                    <>
                      {/* Banned students see disabled button, not the real one */}
                      {session && banStatus?.isBanned ? (
                        <div
                          style={{
                            width: '100%', fontSize: 15, padding: '14px 24px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10, color: '#475569', cursor: 'not-allowed',
                          }}
                        >
                            Registration restricted
                          </div>
                        ) : (
                          <button
                            onClick={handleRegister}
                          disabled={registering || banStatusLoading}
                          className="btn-primary"
                          style={{ width: '100%', fontSize: 16, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          {registering
                            ? 'Processing...'
                            : event.feeType === 'paid'
                              ? <><CreditCard size={18} /> Buy Rs.{event.feeAmount}</>
                              : <><Ticket size={18} /> Register Free</>
                          }
                        </button>
                      )}

                      {/* Reliability benefit card — shown below register button */}
                      {session && reliabilityData && !banStatus?.isBanned && (
                        <div style={{
                          marginTop: 12,
                          borderRadius: 12,
                          padding: '12px 16px',
                          background: reliabilityData.tier === 'champion'
                            ? 'rgba(250,204,21,0.06)'
                            : reliabilityData.tier === 'unreliable'
                              ? 'rgba(239,68,68,0.06)'
                              : 'rgba(20,184,166,0.06)',
                          border: `1px solid ${
                            reliabilityData.tier === 'champion'
                              ? 'rgba(250,204,21,0.15)'
                              : reliabilityData.tier === 'unreliable'
                                ? 'rgba(239,68,68,0.15)'
                                : 'rgba(20,184,166,0.15)'
                          }`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              background: reliabilityData.tier === 'champion'
                                ? 'rgba(250,204,21,0.12)'
                                : reliabilityData.tier === 'unreliable'
                                  ? 'rgba(239,68,68,0.12)'
                                  : 'rgba(20,184,166,0.12)',
                            }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={
                                reliabilityData.tier === 'champion'
                                  ? '#fbbf24'
                                  : reliabilityData.tier === 'unreliable'
                                    ? '#f87171'
                                    : '#2dd4bf'
                              } strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13, fontWeight: 700,
                                color: reliabilityData.tier === 'champion'
                                  ? '#fbbf24'
                                  : reliabilityData.tier === 'unreliable'
                                    ? '#f87171'
                                    : '#2dd4bf',
                              }}>
                                {(() => {
                                  const conf = TIER_CONFIG[reliabilityData.tier as keyof typeof TIER_CONFIG];
                                  return `${formatWindowTime(conf.confirmationWindowHours)} confirmation window`;
                                })()}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                {reliabilityData.tier === 'champion'
                                  ? 'Priority access — maximum time to confirm your spot'
                                  : reliabilityData.tier === 'unreliable'
                                    ? 'Reduced window — confirm promptly to keep your registration'
                                    : 'Standard confirmation window for event registration'}
                              </div>
                            </div>
                            {reliabilityData.tier === 'champion' && (
                              <div style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: 'rgba(250,204,21,0.12)', color: '#fbbf24',
                              }}>
                                CHAMPION
                              </div>
                            )}
                            {reliabilityData.tier === 'unreliable' && (
                              <div style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: 'rgba(239,68,68,0.12)', color: '#f87171',
                              }}>
                                LIMITED
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!session && (
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 12,
                      }}
                    >
                      <Link
                        href="/auth/login"
                        style={{ color: "var(--accent)" }}
                      >
                        Login
                      </Link>{" "}
                      to register
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Organizer card */}
            <div className="card" style={{ padding: 20 }}>
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  margin: "0 0 12px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Organized by
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#042f2e",
                  }}
                >
                  {event.organizer[0]}
                </div>
                <span style={{ fontWeight: 600 }}>{event.organizer}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations Strip */}
        <RecommendationsStrip currentEvent={event} />

      </div>

      {/* Leave Waitlist Modal */}
      <LeaveWaitlistModal
        isOpen={leaveWaitlistModal}
        eventTitle={event?.title ?? ''}
        position={waitlistInfo?.position ?? null}
        onConfirm={confirmLeaveWaitlist}
        onCancel={() => { if (!leavingWaitlist) setLeaveWaitlistModal(false); }}
        loading={leavingWaitlist}
      />

      {/* Payment Modal */}
      {event && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          eventId={event._id}
          eventTitle={event.title}
          amount={event.feeAmount}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function RecommendationsStrip({ currentEvent }: { currentEvent: EventData }) {
  const [recommendations, setRecommendations] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?category=${encodeURIComponent(currentEvent.category)}`)
      .then(r => r.json())
      .then((data: EventData[]) => {
        const recs = data.filter(e => e._id !== currentEvent._id).slice(0, 3);
        setRecommendations(recs);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [currentEvent._id, currentEvent.category]);

  return (
    <div style={{ marginTop: 64, borderTop: '1px solid var(--border)', paddingTop: 40 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>You might also like...</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
        {loading ? (
          <>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 120, background: 'var(--surface2)', animation: 'pulse 2s infinite' }} />
              <div style={{ padding: 20 }}>
                <div style={{ height: 16, width: '60%', background: 'var(--surface2)', borderRadius: 6 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--surface2)', borderRadius: 6, marginTop: 8 }} />
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 120, background: 'var(--surface2)', animation: 'pulse 2s infinite' }} />
              <div style={{ padding: 20 }}>
                <div style={{ height: 16, width: '60%', background: 'var(--surface2)', borderRadius: 6 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--surface2)', borderRadius: 6, marginTop: 8 }} />
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 120, background: 'var(--surface2)', animation: 'pulse 2s infinite' }} />
              <div style={{ padding: 20 }}>
                <div style={{ height: 16, width: '60%', background: 'var(--surface2)', borderRadius: 6 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--surface2)', borderRadius: 6, marginTop: 8 }} />
              </div>
            </div>
          </>
        ) : recommendations.length > 0 ? (
          recommendations.map(event => (
            <Link href={`/events/${event._id}`} key={event._id} className="card" style={{ display: 'block', textDecoration: 'none', transition: 'transform 0.2s', padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 160, background: event.imageUrl ? `url(${event.imageUrl}) center/cover` : 'var(--surface2)', display: 'flex', alignItems: 'flex-end', padding: 16 }}>
                 <span className={`badge cat-${event.category}`} style={{ fontSize: 11 }}>{event.category}</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>{event.title}</h3>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {format(new Date(event.date), 'MMM d, yyyy')} • {event.venue}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No similar events found.</p>
        )}
      </div>
    </div>
  );
}

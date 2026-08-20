"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ArrowLeft,
  Building,
  Tag,
  Edit2,
  Eye,
  XCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import TierBadge from "@/components/TierBadge";
import TitleSetter from "@/components/TitleSetter";

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
  feeType: "free" | "paid";
  feeAmount: number;
  isActive: boolean;
  registrationDeadline?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  createdAt: string;
}

export default function AdminEventViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [notifyCount, setNotifyCount] = useState(0);
  const [eventStats, setEventStats] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  const handleCancelEvent = async () => {
    if (!cancelReason.trim()) {
      toast.error("Reason required");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Event cancelled! ${data.refundCount} refunds initiated.`);
      setCancelModal(false);
      setEvent((prev) =>
        prev ? { ...prev, isCancelled: true, cancelReason } : prev,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel event");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    if (
      status === "authenticated" &&
      (session?.user as any)?.role !== "admin"
    ) {
      router.push("/events");
      return;
    }

    if (status === "authenticated") {
      fetch(`/api/events/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setEvent(data);
          setLoading(false);
        });

      fetch(`/api/admin/event-stats/${id}`)
        .then((r) => r.json())
        .then((d) => {
          setWaitlistCount(d.waitlistCount || 0);
          setNotifyCount(d.notifyCount || 0);
        })
        .catch(err => console.error(err));

      fetch(`/api/admin/events/${id}/stats`)
        .then((r) => r.json())
        .then((d) => {
          setEventStats(d);
        })
        .catch(err => console.error(err));
    }
  }, [id, session, status]);

  const fetchRegistrations = async () => {
    if (loadingRegistrations) return;
    setLoadingRegistrations(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/registrations`);
      if (res.ok) {
        const d = await res.json();
        setRegistrations(d.registrations || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const toggleRegistrations = () => {
    if (!showRegistrations && registrations.length === 0) {
      fetchRegistrations();
    }
    setShowRegistrations((prev) => !prev);
  };

  if (loading || status === "loading")
    return (
      <div className="min-h-screen">
        <div className="max-w-[1000px] mx-auto px-6 py-12">
          <div className="w-40 h-4 bg-surface2 animate-pulse rounded mb-6" />
          <div className="w-96 h-10 bg-surface2 animate-pulse rounded-lg mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-surface2 animate-pulse rounded-2xl"
              />
            ))}
          </div>
          <div className="h-64 bg-surface2 animate-pulse rounded-2xl mb-6" />
          <div className="h-40 bg-surface2 animate-pulse rounded-2xl" />
        </div>
      </div>
    );

  if (!event)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted-foreground mb-4">Event not found</p>
          <Link href="/admin/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );

  const spotsLeft = event.capacity - event.registeredCount;
  const fillRate = Math.round((event.registeredCount / event.capacity) * 100);
  const isEnded = new Date(event.date) < new Date();

  return (
    <div className="min-h-screen">
      <TitleSetter title="Event Details" />
      <div className="max-w-[1000px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition mb-4 text-sm"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`badge cat-${event.category}`}>
                  {event.category}
                </span>
                {event.feeType === "paid" ? (
                  <span className="badge bg-amber-500/20 text-amber-400">
                    Rs. {event.feeAmount}
                  </span>
                ) : (
                  <span className="badge bg-green-500/20 text-green-400">
                    Free
                  </span>
                )}
                {isEnded && (
                  <span className="badge bg-gray-500/20 text-gray-400">
                    Ended
                  </span>
                )}
                {!event.isActive && (
                  <span className="badge bg-red-500/20 text-red-400">
                    Hidden
                  </span>
                )}
              </div>
              <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
                {event.title}
              </h1>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/admin/events/${event._id}/edit`}
                className="btn-ghost flex items-center gap-2"
              >
                <Edit2 size={16} /> Edit
              </Link>
              <Link
                href={`/events/${event._id}`}
                target="_blank"
                className="btn-ghost flex items-center gap-2"
              >
                <Eye size={16} /> View Public
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar size={14} /> Date
            </div>
            <p className="text-lg font-bold text-white">
              {format(new Date(event.date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.date), "h:mm a")}
              {event.endDate &&
                ` - ${format(new Date(event.endDate), "h:mm a")}`}
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <MapPin size={14} /> Venue
            </div>
            <p className="text-lg font-bold text-white">{event.venue}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users size={14} /> Registrations
            </div>
            <p className="text-lg font-bold text-white">
              {event.registeredCount}/{event.capacity}
            </p>
            <div className="mt-2 w-full h-2 bg-surface2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${fillRate >= 100 ? "bg-red-500" : fillRate >= 80 ? "bg-amber-500" : "bg-teal-500"}`}
                style={{ width: `${fillRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fillRate}% filled
            </p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock size={14} /> Spots Left
            </div>
            <p
              className={`text-lg font-bold ${spotsLeft <= 10 ? "text-amber-400" : "text-white"}`}
            >
              {spotsLeft > 0 ? spotsLeft : "FULL"}
            </p>
            {event.registrationDeadline && (
              <p className="text-xs text-muted-foreground mt-1">
                Closes: {format(new Date(event.registrationDeadline), "MMM d")}
              </p>
            )}
          </div>
          {event.feeType === "free" && (
            <div className="card p-4 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                <Clock size={14} /> Waitlist
              </div>
              <p className="text-lg font-bold text-amber-400">
                {waitlistCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                students waiting
              </p>
            </div>
          )}
          {event.feeType === "paid" && (
            <div className="card p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                <span>🔔</span> Notify Me
              </div>
              <p className="text-lg font-bold text-purple-400">{notifyCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                interested students
              </p>
            </div>
          )}
        </div>

        {/* Detailed Analytics */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">
            Detailed Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface2 p-4 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">
                Total Registrations
              </p>
              <p className="text-2xl font-bold text-white">
                {eventStats?.totalRegistrations || 0}
              </p>
            </div>
            <div className="bg-surface2 p-4 rounded-xl border-l-2 border-teal-500">
              <p className="text-sm text-muted-foreground mb-1">Check-ins</p>
              <p className="text-2xl font-bold text-teal-400">
                {eventStats?.checkIns || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {eventStats?.totalRegistrations
                  ? Math.round(
                      (eventStats.checkIns / eventStats.totalRegistrations) *
                        100,
                    )
                  : 0}
                % check-in rate
              </p>
            </div>
            {event.feeType === "paid" && (
              <div className="bg-surface2 p-4 rounded-xl border-l-2 border-amber-500">
                <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                <p className="text-2xl font-bold text-amber-400">
                  Rs. {eventStats?.revenue || 0}
                </p>
              </div>
            )}
            <div className="bg-surface2 p-4 rounded-xl border-l-2 border-red-500">
              <p className="text-sm text-muted-foreground mb-1">
                Anomalies Detected
              </p>
              <p className="text-2xl font-bold text-red-400">
                {eventStats?.anomalyCount || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Flagged for review
              </p>
            </div>
          </div>
        </div>

        {/* ── Registrations Table ─────────────────────────────────────────── */}
        <div className="card mb-8 overflow-hidden">
          <button
            onClick={toggleRegistrations}
            className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users size={18} className="text-teal-400" />
              <h3 className="text-lg font-bold text-white">
                Registrations
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({event.registeredCount} total)
                </span>
              </h3>
            </div>
            {showRegistrations ? (
              <ChevronUp size={18} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={18} className="text-muted-foreground" />
            )}
          </button>

          {showRegistrations && (
            <div className="border-t border-border">
              {loadingRegistrations ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : registrations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No registrations yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border bg-surface2/50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Tier
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Registered
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Check-in
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {registrations.map((reg: any) => {
                        const user = reg.userId as any;
                        return (
                          <tr
                            key={reg._id}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-white text-sm">
                                {user?.name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user?.email || ""}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <TierBadge
                                tier={user?.engagementTier ?? "new"}
                                size="sm"
                                audience="admin"
                              />
                            </td>
                            <td className="px-6 py-4">
                              {reg.flagged ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">
                                  <AlertTriangle size={10} /> Flagged
                                </span>
                              ) : reg.confirmed ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-teal-500/10 text-teal-400">
                                  <CheckCircle size={10} /> Confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-500/10 text-gray-400">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {reg.createdAt
                                ? format(
                                    new Date(reg.createdAt),
                                    "MMM d, h:mm a",
                                  )
                                : "—"}
                            </td>
                            <td className="px-6 py-4">
                              {reg.checkedIn ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                                    <CheckCircle size={10} /> Checked In
                                  </span>
                                  {reg.checkedInAt && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {format(
                                        new Date(reg.checkedInAt),
                                        "h:mm a",
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Banner */}
            <div
              className="h-64 rounded-2xl overflow-hidden relative"
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
              {!event.imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <Calendar size={80} className="text-white" />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {event.description}
              </p>
            </div>

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Tag size={18} /> Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-surface2 border border-border rounded-lg text-sm text-muted-foreground font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organizer */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Building size={18} /> Organizer
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center text-lg font-bold text-teal-950">
                  {event.organizer?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {event.organizer || "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Event Organizer
                  </p>
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`font-semibold ${!event.isActive ? "text-red-400" : isEnded ? "text-gray-400" : "text-green-400"}`}
                  >
                    {!event.isActive ? "Hidden" : isEnded ? "Ended" : "Active"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span
                    className={`font-semibold ${event.feeType === "paid" ? "text-amber-400" : "text-green-400"}`}
                  >
                    {event.feeType === "paid"
                      ? `Rs. ${event.feeAmount}`
                      : "Free"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-semibold text-white">
                    {event.category}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-sm text-gray-400">
                    {event.createdAt
                      ? format(new Date(event.createdAt), "MMM d, yyyy")
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Cancel Event */}
            {!event.isCancelled && !isEnded && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-3">
                  Danger Zone
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cancelling will notify all registrants and initiate refunds
                  for paid events.
                </p>
                <button
                  onClick={() => setCancelModal(true)}
                  className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle size={16} /> Cancel Event
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0d1f1e] rounded-2xl w-full max-w-md shadow-2xl mx-4">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mb-4 mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">Cancel Event</h2>
              <p className="text-[#8b9fa0] text-sm text-center mb-6">
                Are you sure you want to cancel{" "}
                <strong className="text-white">{event.title}</strong>? All registrants will be notified and refunds initiated.
              </p>
            </div>
            <div className="px-6 pb-6">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs font-bold">!</span>
                  </div>
                  <p className="text-sm text-[#8b9fa0]">
                    This action cannot be undone. All registrations will be voided.
                  </p>
                </div>
              </div>
              <label className="block text-xs font-semibold text-red-400 mb-2">
                Cancellation reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Venue unavailable, event postponed..."
                className="w-full bg-[#142826] border border-[#1e3a38] rounded-xl px-4 py-3
                           text-white text-sm placeholder-[#4a6663] resize-none
                           focus:outline-none focus:border-red-500/50 transition-all min-h-[100px]"
              />
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setCancelModal(false)}
                disabled={cancelling}
                className="px-5 py-2.5 rounded-xl font-semibold text-[#8b9fa0] hover:text-white transition-colors disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={cancelling || !cancelReason.trim()}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                    Cancelling...
                  </>
                ) : (
                  "Cancel Event"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client'
import { memo, useCallback } from 'react'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { HiCalendar, HiLocationMarker, HiUserGroup } from 'react-icons/hi'
import { Share2, CheckCircle, Clock, XCircle, Bell } from 'lucide-react'
import { CATEGORY_COLORS } from '@/lib/constants'
import SoldOutStamp from '@/components/ui/SoldOutStamp'
import { toast } from 'react-hot-toast'

interface EventCardProps {
  event: any
  index?: number
  registered?: boolean
  waitlisted?: boolean
  onLeaveWaitlist?: (eventId: string) => void
}

function EventCard({ event, index = 0, registered = false, waitlisted = false, onLeaveWaitlist }: EventCardProps) {
  const capacity = event.capacity ?? 0
  const registeredCount = event.registeredCount ?? 0
  const spotsLeft = capacity - registeredCount
  const isFull = spotsLeft <= 0
  const fillPercent = capacity > 0 ? Math.min((registeredCount / capacity) * 100, 100) : 0
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const catColor = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Other

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/events/${event._id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      // silent
    }
  }, [event._id, event.title])

  const handleLeaveWaitlist = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (leaving) return
    setLeaving(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event._id }),
      })
      if (!res.ok) throw new Error('Failed to leave waitlist')
      toast.success('Left waitlist')
      onLeaveWaitlist?.(event._id)
    } catch {
      toast.error('Could not leave waitlist')
    } finally {
      setLeaving(false)
    }
  }, [event._id, leaving, onLeaveWaitlist])

  const now = new Date()
  const isEnded = new Date(event.date) < now

  const catBg =
    event.category === 'Technical'  ? '#14b8a6, #0d9488' :
    event.category === 'Cultural'   ? '#f43f5e, #e11d48' :
    event.category === 'Sports'     ? '#f59e0b, #d97706' :
    event.category === 'Workshop'   ? '#a78bfa, #7c3aed' :
    event.category === 'Seminar'    ? '#fb923c, #ea580c' :
    event.category === 'Hackathon'  ? '#ec4899, #db2777' :
                                      '#60a5fa, #2563eb'

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={{ y: -4 }}
      className="relative bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden
                 hover:border-teal-500/30 hover:bg-white/[0.05] transition-all
                 duration-200 group flex flex-col h-full"
    >
      {/* Image / gradient header */}
      <Link href={`/events/${event._id}`} className="block relative h-40 flex-shrink-0 overflow-hidden">
        {event.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500
                       group-hover:scale-105"
            onError={(e) => {
              const wrapper = (e.target as HTMLImageElement).closest('.img-wrapper') as HTMLElement | null
              if (wrapper) wrapper.style.background = `linear-gradient(135deg, ${catBg})`
            }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${catBg})` }}
          />
        )}
        {isFull && !registered && event.imageUrl && (
          <div className="absolute top-2 right-2 opacity-80 pointer-events-none">
            <SoldOutStamp size="sm" />
          </div>
        )}
        {isFull && !registered && !event.imageUrl && (
          <div className="absolute top-3 right-3 opacity-70 pointer-events-none">
            <SoldOutStamp size="sm" />
          </div>
        )}
      </Link>

      <div className="p-5 flex flex-col flex-1">
        {/* Badge row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full
                            text-xs font-semibold border
                            ${catColor.bg} ${catColor.text} ${catColor.border}`}>
            {event.category}
          </span>
          {registered && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                             text-xs font-semibold border"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                           borderColor: 'rgba(34,197,94,0.25)' }}>
              <CheckCircle size={11} /> Registered
            </span>
          )}
          {waitlisted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                             text-xs font-semibold border"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                           borderColor: 'rgba(245,158,11,0.25)' }}>
            <Clock size={11} /> Waitlisted
          </span>
          )}
          {event.feeType === 'free' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full
                              text-xs font-semibold border"
                  style={{ background: 'rgba(20,184,166,0.1)', color: '#2dd4bf',
                           borderColor: 'rgba(20,184,166,0.25)' }}>
              Free
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full
                              text-xs font-semibold border"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24',
                           borderColor: 'rgba(245,158,11,0.25)' }}>
              Rs. {event.feeAmount?.toLocaleString()}
            </span>
          )}
          {isFull && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                              text-xs font-semibold border"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171',
                           borderColor: 'rgba(239,68,68,0.2)' }}>
              <XCircle size={11} /> Sold Out
            </span>
          )}
        </div>

        {/* Title + share */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link href={`/events/${event._id}`} className="flex-1 min-w-0">
            <h3 className="font-bold text-[17px] leading-snug text-white
                           group-hover:text-teal-300 transition-colors line-clamp-2">
              {event.title}
            </h3>
          </Link>
          <button
            onClick={handleShare}
            className="flex-shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10
                       text-gray-500 hover:text-white transition-colors mt-0.5"
            title={copied ? 'Link copied!' : 'Share event'}
          >
            {copied
              ? <CheckCircle size={13} className="text-teal-400" />
              : <Share2 size={13} />
            }
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4 line-clamp-2 flex-1">{event.description}</p>

        {/* Meta info */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <HiCalendar className="text-teal-400 flex-shrink-0" />
            <span className="truncate">{format(new Date(event.date), 'EEE, MMM d · h:mm a')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <HiLocationMarker className="text-teal-400 flex-shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <HiUserGroup className="text-teal-400 flex-shrink-0" />
            <span>{capacity === 0 ? '—' : isFull ? 'No spots left' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}</span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{registeredCount} registered</span>
              <span>{capacity} capacity</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                fillPercent > 80 ? 'bg-red-500' : fillPercent > 50 ? 'bg-yellow-500' : 'bg-teal-500'
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        {registered ? (
          <Link
            href={`/my-events`}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                       transition-all mt-auto block"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#4ade80',
            }}
            onClick={e => e.stopPropagation()}
          >
            <CheckCircle size={14} className="inline mr-1.5 -mt-0.5" />
            View Ticket
          </Link>
        ) : waitlisted ? (
          <div className="flex flex-col gap-2 mt-auto">
            <Link
              href={`/events/${event._id}`}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                         transition-all block"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f59e0b',
              }}
              onClick={e => e.stopPropagation()}
            >
              <Clock size={14} className="inline mr-1.5 -mt-0.5" />
              View Waitlist Position
            </Link>
            <button
              onClick={handleLeaveWaitlist}
              disabled={leaving}
              className="w-full py-2 rounded-xl text-xs font-medium text-center
                         transition-all border border-gray-700/50 text-gray-400
                         hover:text-red-400 hover:border-red-500/30
                         hover:bg-red-500/5 disabled:opacity-50"
            >
              {leaving ? 'Leaving...' : 'Leave waitlist'}
            </button>
          </div>
        ) : isFull && event.feeType === 'paid' ? (
          <Link
            href={`/events/${event._id}`}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                       transition-all mt-auto block"
            style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Bell size={14} className="inline mr-1.5 -mt-0.5" />
            Notify Me When Available
          </Link>
        ) : isFull ? (
          <Link
            href={`/events/${event._id}`}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                       transition-all mt-auto block"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Clock size={14} className="inline mr-1.5 -mt-0.5" />
            Join Waitlist
          </Link>
        ) : (
          <Link
            href={`/events/${event._id}`}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                       bg-teal-600 hover:bg-teal-500 text-white transition-all mt-auto block"
            onClick={e => e.stopPropagation()}
          >
            View & Register →
          </Link>
        )}
      </div>
    </motion.div>
  )
}

export default memo(EventCard)

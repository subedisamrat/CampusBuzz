'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Calendar, MapPin, Users, DollarSign, Clock, Tag, ArrowLeft } from 'lucide-react'
import ImageUpload from '@/components/admin/ImageUpload'
import { EVENT_CATEGORIES } from '@/lib/constants'
import TitleSetter from '@/components/TitleSetter'

function getMinDateTime() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function formatDateForInput(date: Date | string) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function EditEventPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Technical',
    feeType: 'free',
    feeAmount: 0,
    date: '',
    endDate: '',
    venue: '',
    capacity: 100,
    registrationDeadline: '',
    tags: '',
    imageUrl: '',
    organizer: '',
  })

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${params.id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        
        setForm({
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'Technical',
          feeType: data.feeType || 'free',
          feeAmount: data.feeAmount || 0,
          date: data.date ? formatDateForInput(data.date) : '',
          endDate: data.endDate ? formatDateForInput(data.endDate) : '',
          venue: data.venue || '',
          capacity: data.capacity || 100,
          registrationDeadline: data.registrationDeadline ? formatDateForInput(data.registrationDeadline) : '',
          tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
          imageUrl: data.imageUrl || '',
          organizer: data.organizer || '',
        })
      } catch (err: any) {
        toast.error(err.message || 'Failed to load event')
        router.push('/admin')
      } finally {
        setFetching(false)
      }
    }
    fetchEvent()
  }, [params.id])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (new Date(form.date) < new Date()) {
      toast.error('Event date cannot be in the past')
      return
    }
    
    if (form.endDate && new Date(form.endDate) <= new Date(form.date)) {
      toast.error('End date must be after start date')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          feeType: form.feeType,
          feeAmount: Number(form.feeAmount),
          date: new Date(form.date),
          endDate: form.endDate ? new Date(form.endDate) : undefined,
          venue: form.venue,
          capacity: Number(form.capacity),
          registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline) : undefined,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          imageUrl: form.imageUrl,
          organizer: form.organizer,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Event updated successfully!')
      router.push('/admin')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${params.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.softDeleted ? 'Event hidden from users' : 'Event deleted')
      router.push('/admin')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
    }
  }

  if (fetching) return (
    <div className="min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-12">
        <div className="w-32 h-4 bg-surface2 animate-pulse rounded mb-4" />
        <div className="w-48 h-10 bg-surface2 animate-pulse rounded-lg mb-2" />
        <div className="w-40 h-4 bg-surface2 animate-pulse rounded mb-8" />
        <div className="card p-8 space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="w-28 h-3 bg-surface2 animate-pulse rounded mb-3" />
              <div className="h-12 bg-surface2 animate-pulse rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <TitleSetter title="Edit Event" />
      <div className="max-w-[900px] mx-auto px-6 py-12">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition mb-4 text-sm">
            <ArrowLeft size={16} /> Back to Events
          </Link>
          <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
            Edit <span className="text-accent">Event</span>
          </h1>
          <p className="text-muted-foreground mt-1">Update event details</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          {/* Title */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Event Title *
            </label>
            <input 
              type="text" 
              placeholder="e.g. Annual Tech Fest 2025"
              value={form.title} 
              onChange={e => set('title', e.target.value)} 
              required 
              className="input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Description *
            </label>
            <textarea 
              rows={4} 
              placeholder="Describe your event..."
              value={form.description} 
              onChange={e => set('description', e.target.value)} 
              required 
              className="input w-full resize-none"
            />
          </div>

          {/* Category & Fee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Category *
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select 
                  value={form.category} 
                  onChange={e => set('category', e.target.value)}
                  className="input w-full pl-10"
                >
                  {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Fee Type *
              </label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select 
                  value={form.feeType} 
                  onChange={e => set('feeType', e.target.value)}
                  className="input w-full pl-10"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Fee Amount (Rs.)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
                <input 
                  type="number" 
                  min="0" 
                  value={form.feeAmount}
                  onChange={e => set('feeAmount', e.target.value)}
                  disabled={form.feeType === 'free'}
                  className="input w-full pl-12 disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Event Date & Time *
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="datetime-local" 
                  value={form.date}
                  min={getMinDateTime()}
                  onChange={e => set('date', e.target.value)} 
                  required 
                  className="input w-full pl-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                End Date & Time
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="datetime-local" 
                  value={form.endDate}
                  min={form.date || getMinDateTime()}
                  onChange={e => set('endDate', e.target.value)} 
                  className="input w-full pl-10"
                />
              </div>
            </div>
          </div>

          {/* Registration Deadline */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Registration Deadline *
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="datetime-local" 
                value={form.registrationDeadline}
                min={getMinDateTime()}
                max={form.date}
                onChange={e => set('registrationDeadline', e.target.value)} 
                required 
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Venue & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Venue *
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="e.g. Main Auditorium, Block A"
                  value={form.venue} 
                  onChange={e => set('venue', e.target.value)} 
                  required 
                  className="input w-full pl-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Capacity *
              </label>
              <div className="relative">
                <Users size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="number" 
                  min="1" 
                  value={form.capacity}
                  onChange={e => set('capacity', e.target.value)} 
                  required 
                  className="input w-full pl-10"
                />
              </div>
            </div>
          </div>

          {/* Organizer */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Organizer
            </label>
            <input 
              type="text" 
              placeholder="Event organizer name"
              value={form.organizer} 
              onChange={e => set('organizer', e.target.value)} 
              className="input w-full"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Tags
            </label>
            <div className="relative">
              <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="e.g. coding, prizes, networking (comma separated)"
                value={form.tags} 
                onChange={e => set('tags', e.target.value)} 
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Event Image
            </label>
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm(prev => ({ ...prev, imageUrl: url }))}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-border">
            <button 
              type="button" 
              onClick={() => setShowDeleteModal(true)}
              className="flex-1 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-xl font-semibold transition-all"
            >
              Delete Event
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-[2] py-3 bg-pulse-600 hover:bg-pulse-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 max-w-md mx-4"
          >
            <h3 className="text-xl font-bold text-white mb-2">Delete Event?</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete &quot;{form.title}&quot;?
              {form.capacity > 0 && ' This event has registrations and will be hidden from users.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-surface hover:bg-dark-border text-white rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

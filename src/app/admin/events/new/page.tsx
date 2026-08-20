"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import toast from "react-hot-toast";
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Tag,
  ArrowLeft,
  Building,
} from "lucide-react";
import ImageUpload from '@/components/admin/ImageUpload';
import { EVENT_CATEGORIES, getMinDateTime } from '@/lib/constants';
import TitleSetter from '@/components/TitleSetter';

export default function NewEventPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Technical",
    feeType: "free",
    feeAmount: 0,
    date: "",
    endDate: "",
    venue: "",
    capacity: 100,
    registrationDeadline: "",
    tags: "",
    imageUrl: "",
    organizer: "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(form.date) < new Date()) {
      toast.error("Event date cannot be in the past");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capacity: Number(form.capacity),
          feeAmount: Number(form.feeAmount),
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Event created successfully!");
      router.push("/admin");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setForm({
      title: "",
      description: "",
      category: "Technical",
      feeType: "free",
      feeAmount: 0,
      date: "",
      endDate: "",
      venue: "",
      capacity: 100,
      registrationDeadline: "",
      tags: "",
      imageUrl: "",
      organizer: "",
    });
  };

  return (
    <div className="min-h-screen">
      <TitleSetter title="Create Event" />
      <div className="max-w-[900px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition mb-4 text-sm"
          >
            <ArrowLeft size={16} /> Back to Events
          </Link>
          <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
            Create <span className="text-accent">New Event</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Fill in the details to create a new campus event
          </p>
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
              onChange={(e) => set("title", e.target.value)}
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
              onChange={(e) => set("description", e.target.value)}
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
                <Calendar
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="input w-full pl-10"
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Fee Type *
              </label>
              <div className="relative">
                <DollarSign
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <select
                  value={form.feeType}
                  onChange={(e) => set("feeType", e.target.value)}
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.feeAmount}
                  onChange={(e) => set("feeAmount", e.target.value)}
                  disabled={form.feeType === "free"}
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
                <Clock
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="datetime-local"
                  value={form.date}
                  min={getMinDateTime()}
                  onChange={(e) => set("date", e.target.value)}
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
                <Clock
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="datetime-local"
                  value={form.endDate}
                  min={form.date || getMinDateTime()}
                  onChange={(e) => set("endDate", e.target.value)}
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
              <Calendar
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="datetime-local"
                value={form.registrationDeadline}
                min={getMinDateTime()}
                max={form.date}
                onChange={(e) => set("registrationDeadline", e.target.value)}
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
                <MapPin
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium"
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
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
                <Users
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  required
                  className="input w-full pl-10"
                />
              </div>
            </div>
          </div>

          {/* Organizer */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Organizer *
            </label>
            <div className="relative">
              <Building
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="e.g. Computer Science Department, Student Council"
                value={form.organizer}
                onChange={(e) => set("organizer", e.target.value)}
                required
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              Tags (comma separated)
            </label>
            <div className="relative">
              <Tag
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="e.g. coding, prizes, networking"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
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

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleClear}
              className="btn-ghost flex-1"
            >
              Clear All
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-[2]"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

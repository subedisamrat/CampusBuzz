import Link from "next/link";
import Navbar from "@/components/Navbar";
import { HeroCTA, CtaLink } from "@/components/HeroCTA";
import connectDB from "@/lib/mongodb";
import Event from "@/models/Event";
import User from "@/models/User";
import Registration from "@/models/Registration";
import TitleSetter from "@/components/TitleSetter";
import EventCard from "@/components/EventCard";
import AnimatedStat from "@/components/AnimatedStat";
import FaqSection from "@/components/FaqSection";
import AnimateIn from "@/components/AnimateIn";
import { LANDING_FEATURES, FOOTER_LINKS, APP_CONFIG } from "@/lib/constants";
import {
  Zap,
  Calendar,
  QrCode,
  BarChart3,
  Users,
  Shield,
  Brain,
  Star,
  ArrowRight,
  GraduationCap,
  Award,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// Icon map — maps iconName strings from LANDING_FEATURES constants to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Calendar, QrCode, BarChart3, Shield, Brain, Star,
};

interface EventDoc {
  _id: string;
  title: string;
  date: string;
  venue: string;
  category: string;
  capacity: number;
  registeredCount: number;
  imageUrl?: string;
}

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export default async function HomePage() {
  await connectDB();

  const now = new Date();

  const [totalEvents, totalStudents, totalCheckins, totalRegistrations, categoryCount, rawEvents] =
    await Promise.all([
      Event.countDocuments({ isActive: true, isCancelled: { $ne: true } }),
      User.countDocuments({ role: "student" }),
      Registration.countDocuments({ checkedIn: true }),
      Registration.countDocuments({}),
      Registration.distinct('eventId').then(ids => Event.distinct('category', { _id: { $in: ids } }).then(cats => cats.length)),
      Event.find({
        isActive: true,
        isCancelled: { $ne: true },
        date: { $gte: now },
      })
        .sort({ registeredCount: -1 })
        .limit(6)
        .select(
          "_id title description category date venue capacity registeredCount feeType feeAmount imageUrl"
        )
        .lean(),
    ]);

  const upcomingEvents = serialize(rawEvents);

  const checkinRate =
    totalRegistrations > 0
      ? Math.round((totalCheckins / totalRegistrations) * 100)
      : 0;

  const stats = [
    { val: String(totalEvents), label: "Events Hosted" },
    { val: String(totalStudents), label: "Students Registered" },
    { val: `${checkinRate}%`, label: "Check-in Rate" },
    { val: String(totalRegistrations), label: "Registrations" },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <TitleSetter title="Home" />

      {/* Hero Section */}
      <section className="grid-bg relative overflow-hidden px-6 pb-[80px] pt-[120px]">
        <div className="pointer-events-none absolute left-1/2 top-[10%] h-[600px] w-[600px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(20,184,166,0.12)_0%,transparent_70%)]" />

        <div className="relative mx-auto max-w-[900px] text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5">
            <Zap size={14} className="text-teal-500" />
            <span className="text-[13px] font-bold tracking-widest text-teal-500 uppercase">
              Campus Event Platform
            </span>
          </div>

          <h1 className="mb-6 text-[clamp(48px,8vw,88px)] font-extrabold leading-[1] tracking-tighter text-white">
            Your Campus. <span className="block text-accent">Fully Alive.</span>
          </h1>

          <p className="mx-auto mb-12 max-w-[560px] text-lg leading-relaxed text-muted-foreground">
            Discover, register, and attend the best events at your college.All
            in one place. QR check-in, live tracking, and instant notifications.
          </p>

          <HeroCTA />
        </div>

        {/* Stats bar — server rendered with real data, no flash */}
        <div className="mx-auto mt-20 grid max-w-[800px] grid-cols-2 overflow-hidden rounded-2xl bg-border md:grid-cols-4 gap-[1px]">
          {stats.map((s) => (
            <AnimatedStat key={s.label} targetValue={s.val} label={s.label} />
          ))}
        </div>
      </section>

      {/* Popular Events Section */}
      {upcomingEvents.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-6 py-[60px]">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
                Trending Events
              </h2>
              <p className="text-muted-foreground mt-1">
                Most popular events on campus right now
              </p>
            </div>
            <Link href="/events">
              <button className="btn-ghost flex items-center gap-2 text-sm">
                Browse All <ArrowRight size={16} />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event: any, i: number) => (
              <EventCard key={event._id.toString()} event={event} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* How Reliability Scoring Works */}
      <section className="mx-auto max-w-[1200px] px-6 py-[72px]">
        <AnimateIn>
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5">
              <Award size={14} className="text-teal-400" />
              <span className="text-[12px] font-bold tracking-widest text-teal-400 uppercase">ML-Powered</span>
            </div>
            <h2 className="mb-3 text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
              How your reliability score works
            </h2>
            <p className="mx-auto max-w-[600px] text-base leading-relaxed text-muted-foreground">
              Our Isolation Forest model tracks your campus engagement across 7 metrics to classify your tier.
              Higher attendance unlocks better perks.
            </p>
          </div>
        </AnimateIn>

        {/* 7 Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {[
            { icon: CheckCircle, title: 'Attendance Rate', desc: 'Percentage of confirmed events you actually attended', color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { icon: TrendingUp, title: 'Recent Attendance', desc: 'Attendance trend across your last 5 registered events', color: 'text-teal-400', bg: 'bg-teal-500/10' },
            { icon: Clock, title: 'Confirmation Speed', desc: 'How quickly you confirm attendance after email is sent', color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: AlertTriangle, title: 'Cancellation Rate', desc: 'How often you cancel after registering for events', color: 'text-coral-400', bg: 'bg-coral-500/10' },
            { icon: Star, title: 'Waitlist Conversion', desc: 'Frequency of accepting a spot when promoted from waitlist', color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: Shield, title: 'Waitlist Abandonment', desc: 'How often you leave the waitlist before getting a spot', color: 'text-coral-400', bg: 'bg-coral-500/10' },
            { icon: Zap, title: 'Bulk Registration', desc: 'Unconfirmed registrations piling up — lower is better', color: 'text-teal-400', bg: 'bg-teal-500/10' },
          ].map((m, i) => (
            <div key={m.title} className="card p-5 hover:border-teal-500/20 transition-colors animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${m.bg}`}>
                <m.icon size={18} className={m.color} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-white">{m.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>

        {/* Tier Benefits */}
        <div className="mb-8">
          <h3 className="text-center text-lg font-bold text-white mb-6">Tiers &amp; Their Benefits</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                tier: 'Champion',
                icon: Trophy,
                color: 'text-amber-400',
                border: 'border-amber-500/25',
                bg: 'bg-amber-500/8',
                score: '85+',
                benefits: ['24h confirmation window', '2× waitlist priority', 'Priority access to events'],
              },
              {
                tier: 'Regular',
                icon: Shield,
                color: 'text-teal-400',
                border: 'border-teal-500/25',
                bg: 'bg-teal-500/8',
                score: '40–70',
                benefits: ['12h confirmation window', '1.5× waitlist priority', 'Standard access'],
              },
              {
                tier: 'New',
                icon: Sparkles,
                color: 'text-blue-400',
                border: 'border-blue-500/25',
                bg: 'bg-blue-500/8',
                score: 'Pending',
                benefits: ['6h confirmation window', '1× waitlist priority', 'Attend 3 events to unlock score'],
              },
              {
                tier: 'Unreliable',
                icon: AlertTriangle,
                color: 'text-orange-400',
                border: 'border-orange-500/25',
                bg: 'bg-orange-500/8',
                score: '< 40',
                benefits: ['4h confirmation window', '0.5× waitlist priority', 'Improve attendance to recover'],
              },
            ].map((t, ti) => {
              const TierIcon = t.icon;
              return (
                <div key={t.tier} className={`rounded-2xl p-5 border ${t.border} ${t.bg} text-center animate-fade-up transition-all duration-300 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/10`} style={{ animationDelay: `${ti * 0.1 + 0.5}s` }}>
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${t.border} ${t.bg}`}>
                    <TierIcon size={22} className={t.color} />
                  </div>
                  <h4 className={`text-lg font-extrabold ${t.color} mb-1`}>{t.tier}</h4>
                  <p className="text-xs text-muted-foreground mb-3">Score: {t.score}</p>
                  <ul className="space-y-1.5 text-left">
                    {t.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle size={12} className="text-teal-400 mt-0.5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-[1200px] px-6 py-[60px]">
        <AnimateIn>
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter text-white">
              Everything you need
            </h2>
            <p className="text-lg text-muted-foreground">
              Built for students, designed for admins.
            </p>
          </div>
        </AnimateIn>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_FEATURES.map((f, fi) => {
            const Icon = ICON_MAP[f.iconName];
            return (
              <div key={f.title} className="card p-6 animate-fade-up" style={{ animationDelay: `${fi * 0.1}s` }}>
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.bgClass}`}>
                  {Icon && <Icon size={22} className={f.colorClass} />}
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-[80px]">
        <AnimateIn>
          <div className="glow-teal mx-auto max-w-[600px] rounded-2xl border border-teal-500/30 bg-gradient-to-br from-[#0d1f1e] to-[#050d0c] px-10 py-12 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20">
            <Users size={24} className="text-[#042f2e]" />
          </div>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
            Ready to get started?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Join thousands of students discovering campus events.
          </p>
          <CtaLink />
        </div>
        </AnimateIn>
      </section>

      <AnimateIn>
        <FaqSection />
      </AnimateIn>

      {/* Footer */}
      <footer
        className="px-6 py-12"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={20} className="text-teal-400" />
                <span className="text-white font-bold text-lg">{APP_CONFIG.name}</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                {APP_CONFIG.description}.
                Powered by machine learning for a fair experience.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                 style={{ color: '#475569' }}>
                Quick Links
              </p>
              <div className="space-y-2">
                {FOOTER_LINKS.quickLinks.map(link => (
                  <Link key={link.href} href={link.href}
                    className="block text-sm transition-colors hover:text-teal-400"
                    style={{ color: '#94a3b8' }}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                 style={{ color: '#475569' }}>
                Technology
              </p>
              <div className="space-y-2">
                {FOOTER_LINKS.technology.map(tech => (
                  <p key={tech} className="text-sm" style={{ color: '#94a3b8' }}>{tech}</p>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
               className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/70">
              © {new Date().getFullYear()} {APP_CONFIG.name}. Built for campus life.
            </p>
            <p className="text-sm font-bold tracking-wider text-teal-400/80">
              Final Year BCA Project: {APP_CONFIG.collegeShort}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

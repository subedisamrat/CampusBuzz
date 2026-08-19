'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Zap, LogOut, LayoutDashboard, ScanLine, Menu, X, Plus, Calendar, CreditCard, Activity } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

interface NavbarProps { showAdminLinks?: boolean; }

export default function Navbar({ showAdminLinks = true }: NavbarProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const isAdmin = session?.user?.role === 'admin';
  const sessionReady = status !== 'loading';

  const handleLogout = () => signOut({ callbackUrl: '/' });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const nl = (href: string, icon: React.ReactNode, label: string) => (
    <Link key={href} href={href} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${isActive(href) ? 'text-pulse-400 bg-pulse-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
      {icon}{label}
    </Link>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#050d0c]/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between h-[68px]">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 no-underline flex-shrink-0">
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Zap size={18} className="text-teal-950 fill-teal-950" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Campus<span className="text-teal-400">Buzz</span>
              </span>
            </Link>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-1">
              {sessionReady && isAdmin && showAdminLinks && (
                <>
                  <Link href="/admin/events/new" className="px-4 py-2 text-sm font-semibold bg-teal-500 text-[#042f2e] rounded-lg hover:bg-teal-400 transition flex items-center gap-2">
                    <Plus size={15} /> New Event
                  </Link>
                  {nl('/admin/events', <Calendar size={15} />, 'Events')}
                  {nl('/admin/scanner', <ScanLine size={15} />, 'Scanner')}
                  {nl('/admin/dashboard', <LayoutDashboard size={15} />, 'Dashboard')}
                  {nl('/admin/payments', <CreditCard size={15} />, 'Payments')}
                </>
              )}
              {sessionReady && !isAdmin && session && (
                <>
                  {nl('/my-events', <Calendar size={15} />, 'My Events')}
                  {nl('/my-payments', <CreditCard size={15} />, 'My Payments')}
                  {nl('/my-reliability', <Activity size={15} />, 'Reliability')}
                </>
              )}

              {sessionReady && session ? (
                <div className="flex items-center gap-2 ml-2">

                  {/* Bell */}
                  {!isAdmin && <NotificationBell />}

                  {/* User chip */}
                  <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-xs font-bold text-teal-950">
                      {session.user?.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-white">{session.user?.name?.split(' ')[0]}</span>
                    {isAdmin && <span className="text-[10px] font-bold text-teal-400 bg-teal-400/10 px-1.5 py-[2px] rounded border border-teal-400/20">ADMIN</span>}
                  </div>

                  <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-1 px-3 py-2 text-sm btn-ghost">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              ) : sessionReady ? (
                <div className="flex gap-2 ml-3">
                  <Link href="/auth/login"><button className="px-5 py-2 text-sm btn-ghost">Login</button></Link>
                  <Link href="/auth/signup"><button className="px-5 py-2 text-sm btn-primary">Sign Up</button></Link>
                </div>
              ) : null}
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-1">
              {sessionReady && session && !isAdmin && <NotificationBell />}
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-gray-400 hover:text-white">
                {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {showMobileMenu && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-1">
                {sessionReady && isAdmin && showAdminLinks && (
                  <>
                    <Link href="/admin/events/new" onClick={() => setShowMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-teal-400 rounded-lg">+ New Event</Link>
                    <Link href="/admin/events" onClick={() => setShowMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-400 rounded-lg">Events</Link>
                    <Link href="/admin/scanner" onClick={() => setShowMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-400 rounded-lg">Scanner</Link>
                    <Link href="/admin/dashboard" onClick={() => setShowMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-400 rounded-lg">Dashboard</Link>
                    <Link href="/admin/payments" onClick={() => setShowMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-400 rounded-lg">Payments</Link>
                  </>
                )}
                {sessionReady && !isAdmin && session && (
                  <>
                    <Link href="/my-events" onClick={() => setShowMobileMenu(false)} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${isActive('/my-events') ? 'text-pulse-400 bg-pulse-500/10' : 'text-gray-400'}`}>My Events</Link>
                    <Link href="/my-payments" onClick={() => setShowMobileMenu(false)} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${isActive('/my-payments') ? 'text-pulse-400 bg-pulse-500/10' : 'text-gray-400'}`}>My Payments</Link>
                    <Link href="/my-reliability" onClick={() => setShowMobileMenu(false)} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${isActive('/my-reliability') ? 'text-pulse-400 bg-pulse-500/10' : 'text-gray-400'}`}>Reliability Score</Link>
                  </>
                )}
                {sessionReady && session && (
                  <button onClick={() => setShowLogoutConfirm(true)} className="px-4 py-2.5 text-sm font-semibold text-left text-gray-400 rounded-lg">Sign Out</button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Logout modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-8 max-w-sm mx-4 text-center">
            <h3 className="text-xl font-bold text-white mb-3">Sign Out?</h3>
            <p className="text-muted-foreground mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLogoutConfirm(false)} className="btn-ghost px-6">Cancel</button>
              <button onClick={handleLogout} className="btn-primary px-6">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

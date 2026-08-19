"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Calendar,
  ScanLine,
  CreditCard,
  Flag,
  LogOut,
  Shield,
  Plus,
  Users,
  X,
  Menu,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";

interface AdminSidebarProps {
  userName?: string | null;
  userEmail?: string | null;
}

const navItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/events", icon: Calendar, label: "Events" },
  { href: "/admin/events/new", icon: Plus, label: "New Event" },
  { href: "/admin/scanner", icon: ScanLine, label: "Scanner" },
  { href: "/admin/payments", icon: CreditCard, label: "Payments" },
  { href: "/admin/students", icon: Users, label: "Students" },
  { href: "/admin/flagged", icon: Flag, label: "Flagged Check-ins" },
];

const AdminSidebar = memo(function AdminSidebar({
  userName,
  userEmail,
}: AdminSidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = () => {
    signOut({ callbackUrl: "/admin/login" });
  };

  const isActive = (href: string) => {
    if (href === "/admin/dashboard")
      return pathname === "/admin/dashboard" || pathname === "/admin";
    if (href === "/admin/events")
      return (
        pathname === "/admin/events" ||
        (pathname.startsWith("/admin/events/") &&
          !pathname.startsWith("/admin/events/new"))
      );
    if (href === "/admin/events/new") return pathname === "/admin/events/new";
    return pathname.startsWith(href);
  };

  const nl = (item: (typeof navItems)[0], onClick?: () => void) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
        isActive(item.href)
          ? "text-white bg-dark-border"
          : "text-gray-400 hover:text-white hover:bg-dark-border"
      }`}
    >
      <item.icon size={18} />
      {item.label}
    </Link>
  );

  return (
    <>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface border-r border-border min-h-screen fixed left-0 top-0">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-teal-950 fill-teal-950" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-extrabold text-white">
                Campus
              </span>
              <span className="text-base font-extrabold text-teal-400">
                Buzz
              </span>
              <div className="flex items-center gap-1 -mt-0.5">
                <Shield size={9} className="text-teal-400/70" />
                <span className="text-[9px] font-bold text-teal-400/70 uppercase tracking-widest">
                  Admin
                </span>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => nl(item))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-xs font-bold text-teal-950">
              {userName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border px-4 h-16 flex items-center justify-between">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-teal-950 fill-teal-950" />
          </div>
          <span className="text-base font-extrabold text-white">
            Campus<span className="text-teal-400">Buzz</span>
          </span>
          <span className="text-[10px] font-bold text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded uppercase">
            Admin
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-surface border-b border-border p-4"
        >
          <nav className="space-y-1">
            {navItems.map((item) => nl(item, () => setMobileMenuOpen(false)))}
          </nav>
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </motion.div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-8 max-w-sm mx-4 text-center">
            <h3 className="text-xl font-bold text-white mb-3">Sign Out?</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to sign out of the admin panel?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-ghost px-6"
              >
                Cancel
              </button>
              <button onClick={handleLogout} className="btn-primary px-6">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default AdminSidebar;

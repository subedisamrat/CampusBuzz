'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Home, Calendar, LayoutDashboard } from 'lucide-react';

export default function NotFoundActions() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  if (isAdmin) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/admin/dashboard"
          className="flex items-center justify-center gap-2 px-6 py-3
                     bg-teal-500 hover:bg-teal-400 text-white font-medium
                     text-sm rounded-xl transition-colors">
          <LayoutDashboard size={16} />
          Go to Dashboard
        </Link>
        <Link href="/admin/events"
          className="flex items-center justify-center gap-2 px-6 py-3
                     bg-white/5 hover:bg-white/8 text-gray-300 font-medium
                     text-sm rounded-xl border border-white/10 transition-colors">
          <Calendar size={16} />
          Manage Events
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link href="/"
        className="flex items-center justify-center gap-2 px-6 py-3
                   bg-teal-500 hover:bg-teal-400 text-white font-medium
                   text-sm rounded-xl transition-colors">
        <Home size={16} />
        Go to Homepage
      </Link>
      <Link href="/events"
        className="flex items-center justify-center gap-2 px-6 py-3
                   bg-white/5 hover:bg-white/8 text-gray-300 font-medium
                   text-sm rounded-xl border border-white/10 transition-colors">
        <Calendar size={16} />
        Browse Events
      </Link>
    </div>
  );
}
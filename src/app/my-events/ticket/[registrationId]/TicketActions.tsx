'use client';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';

export default function TicketActions() {
  const router = useRouter();

  return (
    <div className="flex gap-3 justify-center mb-6">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-teal-500/20"
      >
        <Printer size={16} />
        Print / Save PDF
      </button>
      <button
        onClick={() => router.push('/my-events')}
        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-gray-300 rounded-xl text-sm font-medium border border-white/10 transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
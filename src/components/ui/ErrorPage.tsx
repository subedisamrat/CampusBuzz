'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
  backHref = '/',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref?: string;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <Link
            href={backHref}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}
          >
            <ArrowLeft size={14} />
            Go Back
          </Link>
        </div>
      </div>
    </div>
  );
}

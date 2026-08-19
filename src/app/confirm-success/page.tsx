import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export const metadata = { title: 'Registration Confirmed' };

export default function ConfirmSuccessPage({
  searchParams,
}: {
  searchParams: { registrationId?: string };
}) {
  return (
    <div className="min-h-screen bg-[#050d0c] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
             style={{ background: 'rgba(20,184,166,0.1)', border: '2px solid rgba(20,184,166,0.3)' }}>
          <CheckCircle size={36} className="text-teal-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Attendance Confirmed!</h1>
        <p className="text-sm mb-2" style={{ color: '#94a3b8' }}>
          Your registration has been confirmed.
        </p>
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
          Your QR code has been sent to your email. Sign in to view it on My Events.
        </p>
        {searchParams.registrationId && (
          <p className="text-xs font-mono mb-6" style={{ color: '#475569' }}>
            Ref: {searchParams.registrationId}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/auth/login"
            className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white
                       font-semibold text-sm rounded-xl transition-colors">
            Sign In to View QR Code
          </Link>
          <Link href="/events"
            className="px-6 py-3 text-sm font-medium rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)',
                     border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}>
            Browse More Events
          </Link>
        </div>
      </div>
    </div>
  );
}

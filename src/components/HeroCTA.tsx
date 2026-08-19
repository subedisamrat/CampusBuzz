'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function HeroCTA() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-wrap justify-center gap-4">
      <Link href="/events">
        <button className="btn-primary flex items-center gap-2.5 px-9 py-4 text-base">
          Explore Events <ArrowRight size={18} />
        </button>
      </Link>
      {!session && (
        <Link href="/auth/signup">
          <button className="btn-ghost px-9 py-4 text-base">
            Get Started Free
          </button>
        </Link>
      )}
    </div>
  );
}

export function CtaLink() {
  const { data: session } = useSession();

  return (
    <Link href={session ? '/events' : '/auth/signup'}>
      <button className="btn-primary px-8 py-3">
        {session ? 'Browse Events' : 'Create Free Account'}
      </button>
    </Link>
  );
}
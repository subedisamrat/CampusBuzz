'use client';
import { useState, useEffect, Suspense } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import TitleSetter from '@/components/TitleSetter';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/events';
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState(true);

  useEffect(() => {
    fetch('/api/auth/csrf').finally(() => setWarming(false));
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      if ((session?.user as any)?.role === 'admin') {
        signOut({ redirect: false });
      } else {
        router.push('/events');
      }
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        toast.error('Invalid email or password');
        setLoading(false);
        return;
      }

      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();

      if (sessionData?.user?.role === 'admin') {
        await signOut({ redirect: false });
        toast.error('Invalid permission');
        setLoading(false);
        return;
      }

      const studentName = sessionData?.user?.name ?? '';
      const greeting = studentName ? `Welcome back, ${studentName.split(' ')[0]}!` : 'Welcome back!';

      const destination = decodeURIComponent(callbackUrl);
      router.push(destination);
      router.refresh();

      setTimeout(() => {
        toast.success(greeting);
      }, 300);

    } catch {
      toast.error('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-6">
      <TitleSetter title="Sign In" />
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline mb-6">
            <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center">
              <Zap size={22} className="text-[#042f2e] fill-[#042f2e]" />
            </div>
            <span className="text-2xl font-extrabold text-white">Campus<span className="text-accent">Buzz</span></span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white mb-2">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your account</p>
        </div>

        <div className="card p-6 sm:p-9">
          {warming && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 justify-center">
              <Loader2 size={12} className="animate-spin" />
              Connecting to server...
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                className="input w-full"
                type="email"
                placeholder="you@college.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  className="input w-full pr-11"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition p-1"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all
                ${loading
                  ? 'bg-teal-600/50 text-white/60 cursor-not-allowed'
                  : 'bg-teal-500 hover:bg-teal-400 text-white cursor-pointer'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          <p className="text-center mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-bold text-accent no-underline hover:underline">Sign up</Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm">
            <ArrowLeft size={15} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="grid-bg min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

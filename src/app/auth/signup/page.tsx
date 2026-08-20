'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import TitleSetter from '@/components/TitleSetter';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/events';
  const [form, setForm] = useState({ name: '', email: '', password: '', college: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.ok) {
        const destination = decodeURIComponent(callbackUrl);
        router.push(destination);
        router.refresh();

        setTimeout(() => {
          toast.success('Account created! Welcome to CampusBuzz.');
        }, 300);
      } else {
        router.push('/auth/login');
        setTimeout(() => {
          toast.success('Account created! Please log in.');
        }, 300);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center p-6">
      <TitleSetter title="Create Account" />
      <div className="w-full max-w-[440px]">

        <div className="mb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2.5 no-underline">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700">
              <Zap size={22} className="fill-[#042f2e] text-[#042f2e]" />
            </div>
            <span className="text-2xl font-extrabold text-white">
              Campus<span className="text-accent">Buzz</span>
            </span>
          </Link>
          <h1 className="mb-2 text-3xl font-extrabold text-white">Create account</h1>
          <p className="text-sm text-muted-foreground">Join CampusBuzz for free</p>
        </div>

        <div className="card p-6 sm:p-9 shadow-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Full Name
              </label>
              <input
                name="name"
                type="text"
                placeholder="Enter your full name"
                className="input w-full"
                value={form.name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                College Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="your.email@college.edu"
                className="input w-full"
                value={form.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                College Name (Optional)
              </label>
              <input
                name="college"
                type="text"
                placeholder="Your college name"
                className="input w-full"
                value={form.college}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  className="input w-full"
                  value={form.password}
                  onChange={handleChange}
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
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all mt-1
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-bold text-accent no-underline hover:underline">
              Sign in
            </Link>
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

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="grid-bg min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

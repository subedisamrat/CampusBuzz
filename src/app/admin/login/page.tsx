'use client';
import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState(true);

  // Pre-warm the auth endpoint on page load
  useEffect(() => {
    fetch('/api/auth/csrf').finally(() => setWarming(false));
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      if ((session?.user as any)?.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        // Student tried admin login — sign them out
        signOut({ redirect: false }).then(() => {
          toast.error('Admin credentials required.');
        });
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
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!res) {
        toast.error('No response from server. Please try again.');
        setLoading(false);
        return;
      }

      if (res.error) {
        toast.error('Invalid email or password');
        setLoading(false);
        return;
      }

      if (res.ok) {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();

        if (sessionData?.user?.role !== 'admin') {
          await signOut({ redirect: false });
          toast.error('Admin credentials required.');
          setLoading(false);
          return;
        }

        toast.success('Welcome, Admin!');
        router.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-500/20">
            <Shield size={32} color="#042f2e" fill="#042f2e" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-500 text-sm">Sign in to manage events and check-ins</p>
        </div>

        <div className="card p-8">
          {warming && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 justify-center">
              <Loader2 size={12} className="animate-spin" />
              Connecting to server...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                <input
                  className="input w-full pl-11"
                  type="email"
                  placeholder="admin@campusbuzz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                <input
                  className="input w-full pl-11 pr-11"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full text-base py-3.5 mt-2 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In as Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

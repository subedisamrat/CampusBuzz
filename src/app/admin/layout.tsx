import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminSidebar from '@/components/AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);

  // No session — render children as-is (the login page handles its own UI)
  // This allows /admin/login to render without being redirected
  if (!session) {
    return <>{children}</>;
  }

  // Authenticated but not admin — send to student login
  if (session.user?.role !== 'admin') {
    redirect('/auth/login');
  }

  // Authenticated admin — wrap with sidebar
  return (
    <div className="min-h-screen grid-bg flex">
      <AdminSidebar
        userName={session.user?.name}
        userEmail={session.user?.email}
      />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}

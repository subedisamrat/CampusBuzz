import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminSidebar from '@/components/AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <>{children}</>;
  }

  if (session.user?.role !== 'admin') {
    redirect('/auth/login');
  }

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

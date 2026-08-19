'use client';

import ErrorPage from '@/components/ui/ErrorPage';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} backHref="/admin/dashboard" />;
}

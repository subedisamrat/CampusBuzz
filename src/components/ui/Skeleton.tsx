interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <Skeleton className="h-4 w-1/2 mb-1" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <Skeleton className="h-2 w-full rounded-full mb-4" />
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  );
}

export function RegistrationCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-4 w-36 mb-1" />
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="min-h-screen grid-bg flex">
      {/* Sidebar skeleton — visible immediately during navigation */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface border-r border-border min-h-screen fixed left-0 top-0 p-5 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5" />
          <div className="h-5 w-24 bg-white/5 rounded" />
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-11 bg-white/5 rounded-xl" />
          ))}
        </div>
      </aside>

      {/* Mobile top bar skeleton */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5" />
          <div className="h-4 w-20 bg-white/5 rounded" />
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/5" />
      </div>

      {/* Content area */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen p-6">
        <div className="max-w-[1200px] mx-auto space-y-8 animate-pulse">
          <div className="h-8 w-64 bg-white/5 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-white/[0.03] border border-white/10 rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-white/[0.03] border border-white/10 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}

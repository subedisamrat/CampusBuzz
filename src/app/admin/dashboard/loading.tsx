export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-10 animate-pulse">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="h-9 w-64 bg-white/5 rounded mb-2" />
            <div className="h-4 w-48 bg-white/5 rounded" />
          </div>
          <div className="flex gap-2.5">
            <div className="h-10 w-28 bg-white/5 rounded-xl" />
            <div className="h-10 w-40 bg-white/5 rounded-xl" />
            <div className="h-10 w-32 bg-white/5 rounded-xl" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5" />
                <div className="h-4 w-20 bg-white/5 rounded" />
              </div>
              <div className="h-8 w-12 bg-white/5 rounded" />
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="h-80 bg-white/[0.03] border border-white/10 rounded-2xl" />
      </div>
    </div>
  );
}

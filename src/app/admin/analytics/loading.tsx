export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 bg-white/5 rounded-2xl" />
        <div>
          <div className="h-7 w-52 bg-white/5 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-white/5 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-white/[0.03] border border-white/10 rounded-2xl" />
        <div className="h-72 bg-white/[0.03] border border-white/10 rounded-2xl" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.03] border border-white/10 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

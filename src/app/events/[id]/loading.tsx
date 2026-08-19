import Navbar from '@/components/Navbar';
import TitleSetter from '@/components/TitleSetter';

export default function EventDetailLoading() {
  return (
    <div className="min-h-screen grid-bg">
      <TitleSetter title="Loading..." />
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-6" />
        <div className="h-72 bg-white/10 rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-white/10 rounded" />
            <div className="h-4 w-1/2 bg-white/10 rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-white/10 rounded-full" />
              <div className="h-6 w-20 bg-white/10 rounded-full" />
            </div>
            <div className="h-48 bg-white/10 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/10 rounded" />
              <div className="h-4 w-5/6 bg-white/10 rounded" />
              <div className="h-4 w-4/6 bg-white/10 rounded" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-white/10 rounded-2xl" />
            <div className="h-32 bg-white/10 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

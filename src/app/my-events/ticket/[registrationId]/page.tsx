import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Registration from '@/models/Registration';
import Event from '@/models/Event';
import { format } from 'date-fns';
import TicketActions from './TicketActions';
import QRCode from 'qrcode';
import { GraduationCap, Calendar, Clock, MapPin, User } from 'lucide-react';

export default async function TicketPage({
  params,
}: {
  params: { registrationId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login');
  if (session.user.role === 'admin') redirect('/admin/dashboard');

  await connectDB();

  let registration = await Registration.findOne({
    registrationId: params.registrationId,
    userId: session.user.id,
  }).lean();

  const reg = registration as any;
  if (!reg) notFound();

  const isPaid = !!reg.paymentId;
  const isValid = reg.confirmed || isPaid;

  if (!isValid) notFound();

  let qrCode = reg.qrCode;
  if (!qrCode && isPaid) {
    const qrData = JSON.stringify({ registrationId: reg.registrationId, eventId: reg.eventId, userId: reg.userId });
    qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2, errorCorrectionLevel: 'H' });
    await Registration.findByIdAndUpdate(reg._id, { qrCode });
  }

  if (!qrCode) notFound();

  const event = await Event.findById(reg.eventId).lean();
  if (!event) notFound();

  const ev = event as any;

  const ticketContent = (
    <div className="bg-gradient-to-br from-[#0f2420] to-[#050d0c] border border-teal-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-teal-500/5 print:shadow-none print:border-gray-300">
      <div className="relative p-6 pb-0 print:p-4 print:pb-0">
        <div className="absolute inset-0 opacity-5 print:hidden"
             style={{ backgroundImage: `radial-gradient(circle at 20% 50%, #14b8a6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #0891b2 0%, transparent 50%)` }} />

        <div className="flex items-center gap-2 mb-6 relative print:mb-3">
          <div className="w-7 h-7 bg-teal-500/20 rounded-lg flex items-center justify-center print:bg-teal-500/50">
            <GraduationCap size={16} className="text-teal-400 print:text-teal-700" />
          </div>
          <span className="text-teal-400 text-sm font-semibold tracking-wide print:text-teal-700">CampusBuzz</span>
          <div className="ml-auto">
            <span className="text-xs text-teal-400/60 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full print:text-teal-700 print:border-teal-700/30 print:bg-teal-500/30">ENTRY TICKET</span>
          </div>
        </div>

        <div className="mb-3 relative">
          <span className="text-xs text-teal-300 uppercase tracking-widest font-medium print:text-teal-600">{ev.category}</span>
        </div>

        <h1 className="text-2xl font-black text-white leading-tight mb-5 relative print:text-gray-900">{ev.title}</h1>

        <div className="space-y-2.5 mb-6 relative print:mb-3">
          {[
            { icon: Calendar, label: format(new Date(ev.date), 'EEEE, MMMM d yyyy') },
            { icon: Clock, label: format(new Date(ev.date), 'h:mm a') },
            { icon: MapPin, label: ev.venue },
            { icon: User, label: session.user.name },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={16} className="text-teal-400" />
              <span className="text-sm text-gray-300 print:text-gray-700">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-4 py-1">
        <div className="border-t border-dashed border-teal-500/20 print:border-gray-400" />
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#050d0c] print:bg-white" />
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#050d0c] print:bg-white" />
      </div>

      <div className="p-6 pt-4 text-center print:p-4 print:pt-2">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest print:text-gray-600">Scan to enter</p>
        <div className="inline-block relative">
          <div className="absolute inset-0 bg-teal-400/10 rounded-2xl blur-xl print:hidden" />
          <div className="relative bg-white p-3 rounded-2xl shadow-xl print:shadow-none" style={{ border: '3px solid #14b8a6' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Entry QR Code" className="w-44 h-44 block print:w-36 print:h-36" />
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 font-mono tracking-widest print:text-gray-600">{reg.registrationId}</p>
        <p className="mt-3 text-xs text-gray-600 leading-relaxed print:text-gray-500">Non-transferable · Valid for one entry only</p>
      </div>

      <div className="h-2 bg-gradient-to-r from-teal-600 via-teal-400 to-cyan-400 print:bg-gray-300" />
    </div>
  );

  return (
    <>
      {/* Screen controls */}
      <div className="print:hidden min-h-screen bg-[#050d0c] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <TicketActions />
          {ticketContent}
          <p className="text-center text-xs text-gray-600 mt-4">Save as PDF for offline access 💾</p>
        </div>
      </div>

      {/* Print version — white background, same ticket */}
      <div className="hidden print:block print:min-h-screen print:bg-white print:p-4">
        <div className="w-full max-w-sm mx-auto">
          {ticketContent}
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; background: white; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </>
  );
}

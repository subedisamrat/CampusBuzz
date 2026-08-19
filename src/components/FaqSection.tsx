'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '@/lib/constants';

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-[800px] px-6 py-[60px]">
      <div className="mb-10 text-center">
        <h2 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-tighter
                       text-white mb-3">
          Frequently asked questions
        </h2>
        <p style={{ color: '#64748b' }}>Everything you need to know about CampusBuzz.</p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} className="rounded-xl overflow-hidden transition-all duration-300"
               style={{
                 background: open === i ? 'rgba(20,184,166,0.06)' : 'rgba(255,255,255,0.03)',
                 border: open === i
                   ? '1px solid rgba(20,184,166,0.2)'
                   : '1px solid rgba(255,255,255,0.08)',
               }}
               onMouseEnter={(e) => {
                 if (open !== i) {
                   e.currentTarget.style.background = 'rgba(20,184,166,0.04)';
                   e.currentTarget.style.borderColor = 'rgba(20,184,166,0.15)';
                 }
               }}
               onMouseLeave={(e) => {
                 if (open !== i) {
                   e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                   e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                 }
               }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
              <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
              <ChevronDown size={16}
                style={{
                  color: open === i ? '#14b8a6' : '#64748b',
                  transform: open === i ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease, color 0.2s ease',
                  flexShrink: 0,
                }} />
            </button>
            {open === i && (
              <div className="px-5 pb-4">
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                  {faq.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

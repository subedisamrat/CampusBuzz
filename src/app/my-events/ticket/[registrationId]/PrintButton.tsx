'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
    >
      Print Ticket
    </button>
  );
}

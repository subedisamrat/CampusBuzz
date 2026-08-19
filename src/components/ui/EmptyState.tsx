'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-600" />
      </div>
      <h3 className="text-base font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 max-w-xs leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}

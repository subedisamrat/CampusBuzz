'use client';

import { memo } from 'react';
import { Trophy, Shield, AlertTriangle, Sparkles } from 'lucide-react';

type Tier = 'champion' | 'regular' | 'new' | 'unreliable';

interface TierBadgeProps {
  tier: Tier;
  size?: 'sm' | 'md' | 'lg';
  /** Admin sees real tier name. Students see friendly name (never 'unreliable'). */
  audience?: 'student' | 'admin';
}

const tierConfig: Record<Tier, {
  label: string;
  studentLabel: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
}> = {
  champion: {
    label: 'Champion',
    studentLabel: 'Champion',
    icon: <Trophy size={12} />,
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
  },
  regular: {
    label: 'Regular',
    studentLabel: 'Regular',
    icon: <Shield size={12} />,
    bg: 'bg-teal-500/10 border-teal-500/20',
    text: 'text-teal-400',
  },
  new: {
    label: 'New',
    studentLabel: 'Getting Started',
    icon: <Sparkles size={12} />,
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-400',
  },
  unreliable: {
    label: 'Unreliable',
    studentLabel: 'Build Your History',
    icon: <AlertTriangle size={12} />,
    bg: 'bg-orange-500/10 border-orange-500/20',
    text: 'text-orange-400',
  },
};

function TierBadgeNoMemo({ tier, size = 'sm', audience = 'student' }: TierBadgeProps) {
  const config = tierConfig[tier] ?? tierConfig.new;
  const label = audience === 'admin' ? config.label : config.studentLabel;

  const padding =
    size === 'lg' ? 'px-3 py-1.5 gap-1.5' :
    size === 'md' ? 'px-2.5 py-1 gap-1.5' :
    'px-2 py-1 gap-1';

  const textSize =
    size === 'lg' ? 'text-xs' :
    size === 'md' ? 'text-[11px]' :
    'text-[10px]';

  return (
    <span className={`inline-flex items-center ${padding} border rounded-full ${config.bg} ${config.text} ${textSize} font-semibold uppercase tracking-wider`}>
      {config.icon}
      {label}
    </span>
  );
}

export default memo(TierBadgeNoMemo);

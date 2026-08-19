interface SoldOutStampProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function SoldOutStamp({ size = 'md' }: SoldOutStampProps) {
  const sizeConfig = {
    sm: { outer: 'w-16 h-16', inner: 'w-12 h-12', text: 'text-[8px]', border: 'border-2' },
    md: { outer: 'w-24 h-24', inner: 'w-18 h-18', text: 'text-[11px]', border: 'border-2' },
    lg: { outer: 'w-32 h-32', inner: 'w-24 h-24', text: 'text-sm', border: 'border-[3px]' },
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center ${sizeConfig.outer}`}
      style={{ transform: 'rotate(-15deg)' }}
    >
      <div
        className={`absolute inset-0 rounded-full ${sizeConfig.border}`}
        style={{ borderColor: 'rgba(220,38,38,0.7)' }}
      />
      <div
        className={`absolute ${sizeConfig.border} rounded-full`}
        style={{
          inset: '4px',
          borderColor: 'rgba(220,38,38,0.7)',
        }}
      />
      <div className="relative flex flex-col items-center justify-center text-center px-1">
        <span
          className={`font-black tracking-widest uppercase leading-tight ${sizeConfig.text}`}
          style={{ color: 'rgba(220,38,38,0.85)' }}
        >
          SOLD
        </span>
        <div
          className="w-full my-0.5"
          style={{
            height: '1.5px',
            background: 'rgba(220,38,38,0.7)',
          }}
        />
        <span
          className={`font-black tracking-widest uppercase leading-tight ${sizeConfig.text}`}
          style={{ color: 'rgba(220,38,38,0.85)' }}
        >
          OUT
        </span>
      </div>
    </div>
  );
}

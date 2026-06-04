import { BRAND } from '../brand';

interface BrandMarkProps {
  showTagline?: boolean;
  size?: 'sm' | 'md';
}

export default function BrandMark({ showTagline = true, size = 'md' }: BrandMarkProps) {
  const isMd = size === 'md';
  return (
    <a href="#" className="flex items-center gap-3 shrink-0 group" aria-label={BRAND.name}>
      <div
        className={`${
          isMd ? 'w-10 h-10 text-lg' : 'w-9 h-9 text-base'
        } rounded-xl bg-gradient-to-br from-[#F5A623] to-[#C8841A] flex items-center justify-center font-bold text-black shadow-[0_0_15px_rgba(245,166,35,0.3)] transition-transform group-hover:scale-105 tracking-tight`}
      >
        {BRAND.initials.toLowerCase()}
      </div>
      <div className="flex flex-col">
        <span
          className={`text-white ${
            isMd ? 'text-base lg:text-lg' : 'text-base'
          } font-bold tracking-tight leading-none lowercase group-hover:opacity-90 transition-opacity`}
        >
          {BRAND.prefix.toLowerCase()}
          <span className="text-[#F5A623]">{BRAND.accent.toLowerCase()}</span>
          {BRAND.suffix.toLowerCase()}
        </span>
        {showTagline && (
          <span className="hidden sm:block text-neutral-400 text-[9px] lg:text-[10px] uppercase tracking-widest font-semibold mt-1">
            {BRAND.tagline}
          </span>
        )}
      </div>
    </a>
  );
}

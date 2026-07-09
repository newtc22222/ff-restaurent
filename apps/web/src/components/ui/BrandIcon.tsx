import { UtensilsCrossed } from 'lucide-react';

interface BrandIconProps {
  /**
   * The size in pixels of the brand icon box. Defaults to 48.
   */
  size?: number;
}

/**
 * BrandIcon displays the restaurant logo/icon with a consistent style.
 */
export default function BrandIcon({ size = 48 }: BrandIconProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-[#e9900c] text-white"
      style={{ width: size, height: size }}
    >
      <UtensilsCrossed size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </div>
  );
}

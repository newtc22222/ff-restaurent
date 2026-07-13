import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  label: string;
}

/** Shared back-navigation control for pages rendered inside the app shell. */
export default function BackButton({ onClick, label }: BackButtonProps) {
  return (
    <button
      type="button"
      className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
      onClick={onClick}
    >
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

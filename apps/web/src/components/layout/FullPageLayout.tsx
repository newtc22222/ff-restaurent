import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import AppHeader from './AppHeader';

interface FullPageLayoutProps {
  /**
   * Optional callback for the profile button in the header.
   */
  onProfile?: () => void;
  children: ReactNode;
}

/**
 * FullPageLayout wraps standalone pages (rendered outside the sidebar shell)
 * with the shared app header. Pages provide their own scroll container since
 * their content layouts differ.
 */
export default function FullPageLayout({
  onProfile,
  children,
}: FullPageLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppHeader onProfile={onProfile} />
      {children}
    </div>
  );
}

interface BackButtonProps {
  onClick: () => void;
  label: string;
}

/**
 * BackButton renders the shared back-navigation control used by standalone pages.
 */
export function BackButton({ onClick, label }: BackButtonProps) {
  return (
    <button
      className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
      onClick={onClick}
    >
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Scrollbar } from 'react-scrollbars-custom';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  desktopOnly?: boolean;
}

/** Shared vertical scroll container with native mobile fallback when requested. */
export default function ScrollArea({
  children,
  className = '',
  contentClassName = '',
  desktopOnly = false,
}: ScrollAreaProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(min-width: 1280px)').matches,
  );

  useEffect(() => {
    if (!desktopOnly) return;
    const query = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [desktopOnly]);

  if (desktopOnly && !isDesktop) {
    return <div className={contentClassName}>{children}</div>;
  }

  return (
    <Scrollbar
      className={className}
      noScrollX
      mobileNative
      removeTrackXWhenNotUsed
      removeTrackYWhenNotUsed
      contentProps={{ className: contentClassName }}
      trackYProps={{
        style: {
          width: 8,
          right: 2,
          top: 4,
          bottom: 4,
          background: 'transparent',
        },
      }}
      thumbYProps={{
        style: {
          width: 4,
          marginLeft: 2,
          borderRadius: 999,
          background: 'rgb(148 163 184 / 0.65)',
        },
      }}
    >
      {children}
    </Scrollbar>
  );
}

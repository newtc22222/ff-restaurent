import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Scrollbar } from 'react-scrollbars-custom';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  desktopOnly?: boolean;
  axis?: 'x' | 'y' | 'both';
  style?: CSSProperties;
}

/** Shared custom scroll container with an intentional native mobile fallback. */
export default function ScrollArea({
  children,
  className = '',
  contentClassName = '',
  desktopOnly = false,
  axis = 'y',
  style,
}: ScrollAreaProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? false
      : window.matchMedia('(min-width: 1280px)').matches,
  );

  useEffect(() => {
    if (!desktopOnly) return;
    if (typeof window.matchMedia !== 'function') return;
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
      style={style}
      noScrollX={axis === 'y'}
      noScrollY={axis === 'x'}
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
      trackXProps={{
        style: {
          height: 8,
          left: 4,
          right: 4,
          bottom: 2,
          background: 'transparent',
        },
      }}
      thumbXProps={{
        style: {
          height: 4,
          marginTop: 2,
          borderRadius: 999,
          background: 'rgb(148 163 184 / 0.65)',
        },
      }}
    >
      {children}
    </Scrollbar>
  );
}

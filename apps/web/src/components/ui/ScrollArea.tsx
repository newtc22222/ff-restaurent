import { type CSSProperties, type ReactNode, forwardRef } from 'react';

import { cn } from '@/lib/cn';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  axis?: 'x' | 'y' | 'both';
  style?: CSSProperties;
}

/** Shared native scroll container with consistent CSS-only styling. */
const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { children, className = '', contentClassName = '', axis = 'y', style },
    ref,
  ) {
    const overflowClass =
      axis === 'x'
        ? 'overflow-x-auto'
        : axis === 'both'
          ? 'overflow-auto'
          : 'overflow-y-auto overflow-x-hidden';

    return (
      <div
        ref={ref}
        data-scroll-area
        data-axis={axis}
        className={cn('scroll-area', overflowClass, className)}
        style={style}
      >
        {contentClassName ? (
          <div className={contentClassName}>{children}</div>
        ) : (
          children
        )}
      </div>
    );
  },
);

export default ScrollArea;

import type { CSSProperties, ReactNode } from 'react';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  axis?: 'x' | 'y' | 'both';
  style?: CSSProperties;
}

/** Shared native scroll container with consistent CSS-only styling. */
export default function ScrollArea({
  children,
  className = '',
  contentClassName = '',
  axis = 'y',
  style,
}: ScrollAreaProps) {
  const overflowClass =
    axis === 'x'
      ? 'overflow-x-auto overflow-y-hidden'
      : axis === 'both'
        ? 'overflow-auto'
        : 'overflow-y-auto overflow-x-hidden';

  return (
    <div
      data-scroll-area
      data-axis={axis}
      className={`scroll-area ${overflowClass} ${className}`}
      style={style}
    >
      {contentClassName ? (
        <div className={contentClassName}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

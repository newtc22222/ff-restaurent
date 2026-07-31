import type { LucideIcon } from 'lucide-react';

export type NavigationItem = readonly [
  path: string,
  icon: LucideIcon,
  label: string,
];

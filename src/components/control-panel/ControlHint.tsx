
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ControlHintProps = {
  children: ReactNode;
  className?: string;
};

export function ControlHint({ children, className }: ControlHintProps) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {children}
    </p>
  );
}

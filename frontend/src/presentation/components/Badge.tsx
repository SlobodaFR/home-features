import { ReactNode } from 'react';
import { pillClass } from '../ui';

type Tone = 'neutral' | 'warning' | 'solid';

const TONES: Record<Tone, string> = {
  neutral: 'border-hairline text-mute',
  warning: 'border-warning text-warning',
  solid: 'border-ink bg-ink text-on-primary',
};

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`${pillClass} ${TONES[tone]}`} title={title}>
      {children}
    </span>
  );
}

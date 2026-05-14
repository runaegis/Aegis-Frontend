'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-1.5',
};

const variantStyles: Record<Variant, string> = {
  // Primary uses a subtle vertical gradient + 1px lighter top inset to create
  // the soft 3D feel of premium product buttons (Stripe / Linear style).
  primary:
    'text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_rgba(206,94,18,0.30),0_1px_0_0_rgba(0,0,0,0.04)] [background:linear-gradient(180deg,#fb8939_0%,#fa7319_55%,#ed6a14_100%)] border border-[var(--primary-dark)] hover:[background:linear-gradient(180deg,#fa7d27_0%,#ed6a14_55%,#d75e10_100%)] active:[background:linear-gradient(180deg,#ed6a14_0%,#d75e10_100%)] disabled:opacity-60',
  secondary:
    'border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] active:bg-[var(--neutral-soft-200)]',
  ghost:
    'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
  danger:
    'border border-[var(--error)]/30 bg-[var(--error-lighter)] text-[var(--error-dark)] hover:bg-[var(--error)] hover:text-white',
  success:
    'text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_rgba(11,70,39,0.25)] [background:linear-gradient(180deg,#2ed480_0%,#1fc16b_55%,#19a45a_100%)] border border-[#19a45a] hover:[background:linear-gradient(180deg,#27c878_0%,#19a45a_100%)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    fullWidth,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-[8px] font-medium tracking-[-0.01em] transition-all duration-100',
        'disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex shrink-0">{leadingIcon}</span> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {trailingIcon ? <span className="inline-flex shrink-0">{trailingIcon}</span> : null}
    </button>
  );
});

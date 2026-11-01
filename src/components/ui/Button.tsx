'use client';
import type { ButtonHTMLAttributes } from 'react';

export function Button({ loading, children, className = '', disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button className={`btn ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spin" aria-hidden />}
      {children}
    </button>
  );
}

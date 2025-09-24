"use client";
import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  const base = 'btn';
  const map: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    destructive: 'btn-destructive',
    ghost: ''
  };
  const cn = [base, map[variant], className].filter(Boolean).join(' ');
  return <button className={cn} {...props} />;
}

export type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
};

export function LinkButton({ variant = 'secondary', className = '', ...props }: LinkButtonProps) {
  const base = 'btn';
  const map: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    destructive: 'btn-destructive',
    ghost: ''
  };
  const cn = [base, map[variant], className].filter(Boolean).join(' ');
  return <a className={cn} {...props} />;
}



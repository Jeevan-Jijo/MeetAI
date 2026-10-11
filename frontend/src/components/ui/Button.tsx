import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-[#4E6B56] hover:bg-[#415B49] text-white shadow-subtle hover:shadow focus:ring-[#4E6B56]',
    secondary: 'bg-[#F5F4EE] hover:bg-[#EBF1EC] text-[#232529] border border-[#E5E4DE] focus:ring-[#D0DDD4]',
    outline: 'border border-[#E5E4DE] hover:bg-[#FAF9F6] text-[#232529] focus:ring-[#D0DDD4]',
    ghost: 'hover:bg-[#F5F4EE] text-[#484B52] focus:ring-[#D0DDD4]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
  };

  return (
    <button
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-[#F5F4EE] text-[#484B52] border-[#E5E4DE]',
    success: 'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4]',
    warning: 'bg-[#FAF4EB] text-[#5C4524] border-[#E8DDCC]',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-[#EEF2F6] text-[#2C4258] border-[#D4DFE8]',
    purple: 'bg-[#F5EFF7] text-[#4F3356] border-[#DFD3E3]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

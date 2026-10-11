import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hover = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#E5E4DE] bg-white shadow-subtle p-5 transition-all text-[#232529]',
        hover && 'hover:shadow-card hover:border-[#D0DDD4] hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  brand?: 'tiza' | 'relevo';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ title, subtitle, children, className = '', brand = 'tiza', padding = 'md' }: CardProps) {
  const brandAccent = brand === 'tiza' ? 'border-t-[#F4813D]' : 'border-t-[#1A3A5C]';
  const paddings = { none: '', sm: 'p-3', md: 'p-6', lg: 'p-8' };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 border-t-4 ${brandAccent} ${className}`}>
      {(title || subtitle) && (
        <div className={`${paddings[padding]} pb-0`}>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={paddings[padding]}>{children}</div>
    </div>
  );
}

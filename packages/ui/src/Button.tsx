import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  brand?: 'tiza' | 'relevo';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  brand = 'tiza',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const brandColors = {
    tiza: {
      primary: 'bg-[#F4813D] hover:bg-[#ED8936] text-white',
      secondary: 'bg-[#2D3748] hover:bg-[#4A5568] text-white',
      outline: 'border-2 border-[#F4813D] text-[#F4813D] hover:bg-[#FFF8F0]',
      ghost: 'text-[#2D3748] hover:bg-gray-100',
      danger: 'bg-red-500 hover:bg-red-600 text-white',
    },
    relevo: {
      primary: 'bg-[#1A3A5C] hover:bg-[#2B6CB0] text-white',
      secondary: 'bg-[#4A5568] hover:bg-[#2D3748] text-white',
      outline: 'border-2 border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EBF4FF]',
      ghost: 'text-[#1A3A5C] hover:bg-gray-100',
      danger: 'bg-red-500 hover:bg-red-600 text-white',
    },
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 
        disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${brandColors[brand][variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

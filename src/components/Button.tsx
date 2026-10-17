
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isAutoWidth = className.split(/\s+/).includes('w-auto')

  const baseStyles =
    'rounded-xl px-6 py-3.5 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted focus-visible:ring-offset-2 focus-visible:ring-offset-milk disabled:cursor-not-allowed disabled:opacity-60'

  const variants = {
    primary: 'bg-plum text-milk hover:bg-plum-soft',
    secondary: 'border border-plum/20 text-plum hover:bg-plum-light',
  }

  return (
    <button
      className={`${isAutoWidth ? 'w-auto' : 'w-full'} ${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button

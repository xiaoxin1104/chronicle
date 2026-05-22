import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

const actionButtonVariants = cva(
  'flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-[var(--shadow-cta-sm)]',
        secondary: 'bg-secondary text-secondary-foreground',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
)

interface ActionButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof actionButtonVariants> {
  icon?: ReactNode
}

function ActionButton({ variant, icon, className, children, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      data-slot="action-button"
      className={cn(actionButtonVariants({ variant, className }))}
      {...props}
    >
      {icon ? <span className="shrink-0 [&_svg]:size-4 [&_svg]:stroke-[2.5]">{icon}</span> : null}
      {children}
    </button>
  )
}

interface ActionBarProps extends React.ComponentProps<'div'> {
  columns?: 2 | 4
}

function ActionBar({ columns = 2, className, children, ...props }: ActionBarProps) {
  return (
    <div
      data-slot="action-bar"
      className={cn('grid gap-3', columns === 4 ? 'grid-cols-4' : 'grid-cols-2', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { ActionBar, ActionButton, actionButtonVariants }

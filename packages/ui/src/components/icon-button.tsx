import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        ghost: 'text-text-tertiary hover:bg-foreground/6',
        muted: 'bg-secondary text-secondary-foreground',
        foreground: 'bg-foreground text-background',
      },
      size: {
        sm: 'h-9 w-9 [&_svg]:size-4',
        md: 'h-10 w-10 [&_svg]:size-5',
        lg: 'h-12 w-12 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'sm',
    },
  },
)

interface IconButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof iconButtonVariants> {
  icon: ReactNode
  label: string
}

function IconButton({ icon, label, variant, size, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      data-slot="icon-button"
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    >
      {icon}
    </button>
  )
}

export { IconButton, iconButtonVariants }

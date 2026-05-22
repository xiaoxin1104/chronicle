import { Slot } from '@radix-ui/react-slot'
import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 font-medium text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)] whitespace-nowrap transition-[color,box-shadow] [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary-hover',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive-hover',
        outline:
          'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        primary: 'border-transparent bg-primary-soft text-primary',
        success: 'border-transparent bg-success-surface text-success-text',
        neutral: 'border-transparent bg-secondary text-secondary-foreground',
        positive: 'border-transparent bg-positive-surface text-positive',
      },
      size: {
        sm: 'px-2 py-0.5 text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)]',
        md: 'px-2.5 py-1 text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)]',
        lg: 'px-3 py-1.5 text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

function Badge({
  variant,
  size,
  icon,
  asChild = false,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    icon?: ReactNode
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {icon ? <span className="shrink-0 [&_svg]:size-3">{icon}</span> : null}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }

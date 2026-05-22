import { Slot } from '@radix-ui/react-slot'
import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium text-[length:var(--text-body-md)] leading-[var(--text-body-md--line-height)] whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-cta-sm)] hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-primary-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-muted active:bg-accent disabled:bg-secondary disabled:text-muted-foreground',
        outline:
          'border border-border bg-background text-foreground hover:border-border-strong hover:bg-accent hover:text-accent-foreground disabled:border-border-subtle disabled:bg-background disabled:text-text-disabled',
        ghost:
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-primary-soft disabled:bg-transparent disabled:text-text-disabled',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive/20 disabled:bg-error-surface disabled:text-error-text dark:focus-visible:ring-destructive/40',
        foreground:
          'bg-foreground text-background hover:bg-brand-deep disabled:bg-muted disabled:text-text-disabled',
        link: 'text-primary underline-offset-4 hover:underline disabled:text-text-disabled',
      },
      size: {
        hero: 'h-14 px-density-spacious-x font-semibold text-[length:var(--text-body-lg)] leading-[var(--text-body-lg--line-height)] has-[>svg]:px-7',
        lg: 'h-12 px-density-comfortable-x has-[>svg]:px-5',
        default: 'h-10 px-4 py-density-compact-y has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-density-compact-x text-[length:var(--text-body-sm)] leading-[var(--text-body-sm--line-height)] has-[>svg]:px-2.5',
        xs: 'h-7 px-density-compact-x text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)]',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    compoundVariants: [{ variant: 'default', size: 'hero', class: 'shadow-[var(--shadow-cta)]' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      type={asChild ? undefined : type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

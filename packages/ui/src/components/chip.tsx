import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const chipVariants = cva(
  'inline-flex items-center justify-center rounded-full border text-xs-plus font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground hover:bg-secondary',
        selected: 'border-primary bg-primary/8 text-primary',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

interface ChipProps extends React.ComponentProps<'button'>, VariantProps<typeof chipVariants> {
  selected?: boolean
}

function Chip({ variant, size, selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-selected={selected || undefined}
      className={cn(
        chipVariants({
          variant: selected ? 'selected' : (variant ?? 'default'),
          size,
          className,
        }),
      )}
      {...props}
    />
  )
}

export { Chip, chipVariants }

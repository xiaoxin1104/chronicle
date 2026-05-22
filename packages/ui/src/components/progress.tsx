import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const progressTrackVariants = cva('relative w-full overflow-hidden rounded-full', {
  variants: {
    variant: {
      primary: 'bg-primary/20',
      success: 'bg-progress-track',
    },
    size: {
      sm: 'h-1.5',
      md: 'h-2',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'sm',
  },
})

const progressBarVariants = cva(
  'h-full w-full flex-1 rounded-full transition-all duration-[420ms]',
  {
    variants: {
      variant: {
        primary: 'bg-primary',
        success: 'bg-success',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

interface ProgressProps
  extends Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, 'children'>,
    VariantProps<typeof progressTrackVariants> {
  value: number
}

function Progress({ value, variant, size, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressTrackVariants({ variant, size, className }))}
      value={clamped}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(progressBarVariants({ variant }))}
        style={{
          transform: `translateX(-${100 - clamped}%)`,
          transitionTimingFunction: 'var(--ease-emphasis)',
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressTrackVariants }

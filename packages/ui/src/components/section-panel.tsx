import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const sectionPanelVariants = cva('rounded-xl border border-border bg-card', {
  variants: {
    variant: {
      default: 'shadow-[var(--shadow-card)]',
      elevated: 'shadow-[var(--shadow-card-md)]',
      flat: '',
    },
    padding: {
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
      xl: 'px-6 py-6 sm:px-8 sm:py-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
})

function SectionPanel({
  variant,
  padding,
  className,
  ...props
}: React.ComponentProps<'section'> & VariantProps<typeof sectionPanelVariants>) {
  return (
    <section
      data-slot="section-panel"
      className={cn(sectionPanelVariants({ variant, padding, className }))}
      {...props}
    />
  )
}

export { SectionPanel, sectionPanelVariants }

import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

const iconBoxVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground',
      'primary-soft': 'bg-surface-blue-dim text-primary',
      success: 'bg-success text-success-foreground',
      neutral: 'bg-secondary text-secondary-foreground',
      foreground: 'bg-foreground text-background',
    },
    size: {
      xs: 'h-8 w-8 rounded-10 [&_svg]:size-4',
      sm: 'h-10 w-10 rounded-md [&_svg]:size-5',
      md: 'h-16 w-16 rounded-20 [&_svg]:size-8',
      lg: 'h-[88px] w-[88px] rounded-28 [&_svg]:size-11',
      xl: 'h-24 w-24 rounded-28 [&_svg]:size-12',
      '2xl': 'h-[120px] w-[120px] rounded-34 [&_svg]:size-16',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface IconBoxProps extends React.ComponentProps<'div'>, VariantProps<typeof iconBoxVariants> {
  icon: ReactNode
}

function IconBox({ icon, variant, size, className, ...props }: IconBoxProps) {
  return (
    <div
      data-slot="icon-box"
      className={cn(iconBoxVariants({ variant, size, className }))}
      {...props}
    >
      {icon}
    </div>
  )
}

export { IconBox, iconBoxVariants }

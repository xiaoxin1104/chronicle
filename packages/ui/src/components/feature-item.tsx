import { cn } from '@repo/ui/lib/utils'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface FeatureItemProps extends React.ComponentProps<'div'> {
  icon?: ReactNode
  children: ReactNode
}

function FeatureItem({ icon, className, children, ...props }: FeatureItemProps) {
  return (
    <div
      data-slot="feature-item"
      className={cn('flex items-center gap-3 rounded-20 bg-surface-blue px-4 py-3', className)}
      {...props}
    >
      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-[var(--shadow-icon)]">
        {icon ?? <Check className="h-4 w-4" />}
      </div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

export { FeatureItem }

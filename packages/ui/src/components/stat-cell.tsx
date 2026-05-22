import { cn } from '@repo/ui/lib/utils'

interface StatCellProps extends React.ComponentProps<'div'> {
  label: string
  value: string
  valueClassName?: string
}

function StatCell({ label, value, valueClassName, className, ...props }: StatCellProps) {
  return (
    <div data-slot="stat-cell" className={cn(className)} {...props}>
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xs-plus font-semibold', valueClassName)}>{value}</div>
    </div>
  )
}

export { StatCell }

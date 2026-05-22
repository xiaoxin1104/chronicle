import { cn } from '@repo/ui/lib/utils'

interface HoldingCardProps extends React.ComponentProps<'div'> {
  label: string
  amount: string
  suffix?: string
  value: string
  change?: string
  pnl?: string
}

function HoldingCard({
  label,
  amount,
  suffix,
  value,
  change,
  pnl,
  className,
  ...props
}: HoldingCardProps) {
  return (
    <div
      data-slot="holding-card"
      className={cn(
        'rounded-20 border border-border bg-card p-5 shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-3 text-2xl font-bold">{amount}</div>
      {suffix ? <div className="text-xs text-muted-foreground">{suffix}</div> : null}
      <div className="mt-4 text-sm font-semibold">{value}</div>
      {change || pnl ? (
        <div className="mt-3 flex items-center justify-between text-xs">
          {change ? <span className="font-semibold text-success">{change}</span> : null}
          {pnl ? <span className="text-muted-foreground">{pnl}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export { HoldingCard }

import { cn } from '@repo/ui/lib/utils'
import type { ReactNode } from 'react'

interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value: string
  detail?: string
  detailColor?: string
}

function AssetRow({
  avatar,
  symbol,
  amount,
  value,
  detail,
  detailColor,
  className,
  ...props
}: AssetRowProps) {
  return (
    <div
      data-slot="asset-row"
      className={cn('flex items-center justify-between rounded-lg px-3 py-3', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        {avatar}
        <div>
          <div className="text-base font-semibold">{symbol}</div>
          <div className="text-sm text-muted-foreground">{amount}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-semibold">{value}</div>
        {detail ? (
          <div
            data-design-audit-allow="dynamic-token-color"
            className="text-sm font-medium"
            style={detailColor ? { color: detailColor } : undefined}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { AssetRow }

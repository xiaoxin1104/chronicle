import { cn } from '@repo/ui/lib/utils'
import type { ReactNode } from 'react'

interface TaskCardProps extends React.ComponentProps<'div'> {
  title: string
  subtitle?: string
  status: ReactNode
  stats: Array<{ label: string; value: string; valueClassName?: string }>
  progress?: { label?: string; value: number | string }
  actions?: ReactNode
  compact?: boolean
}

function TaskCard({
  title,
  subtitle = 'Auto-managed strategy',
  status,
  stats,
  progress,
  actions,
  compact,
  className,
  ...props
}: TaskCardProps) {
  return (
    <div
      data-slot="task-card"
      className={cn('rounded-18 border border-border p-4', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {status}
      </div>

      {stats.length > 0 ? (
        <div className={cn('mt-4 grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-3')}>
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                compact && i === stats.length - 1 && stats.length % 2 !== 0
                  ? 'col-span-2'
                  : undefined,
              )}
            >
              <div className="text-2xs text-muted-foreground">{stat.label}</div>
              <div className={cn('mt-1 text-xs-plus font-semibold', stat.valueClassName)}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {progress ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>{progress.label ?? 'Task progress'}</span>
            <span>
              {typeof progress.value === 'number' ? `${progress.value}%` : progress.value}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-primary/16">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{
                width: typeof progress.value === 'number' ? `${progress.value}%` : progress.value,
              }}
            />
          </div>
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">{actions}</div>
      ) : null}
    </div>
  )
}

export { TaskCard }

import { cn } from '@repo/ui/lib/utils'
import type { ReactNode } from 'react'

type ChecklistCardTone = 'info' | 'neutral' | 'success' | 'warning'

const checklistCardToneClassName: Record<ChecklistCardTone, string> = {
  info: 'bg-surface-blue-info',
  neutral: 'bg-card',
  success: 'bg-success-surface-tint',
  warning: 'bg-warning-surface',
}

interface ChecklistCardProps extends Omit<React.ComponentProps<'div'>, 'style'> {
  title: string
  description: string
  tone?: ChecklistCardTone
  action?: ReactNode
}

function ChecklistCard({
  title,
  description,
  tone,
  action,
  className,
  ...props
}: ChecklistCardProps) {
  return (
    <div
      data-slot="checklist-card"
      className={cn(
        'rounded-lg border border-border p-4',
        tone ? checklistCardToneClassName[tone] : undefined,
        className,
      )}
      {...props}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export { ChecklistCard }

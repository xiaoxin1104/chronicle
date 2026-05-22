import { cn } from '@repo/ui/lib/utils'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      data-slot="toaster"
      data-design-audit-allow="third-party-theme-vars"
      position="top-right"
      className={cn('toaster group', className)}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:shadow-[var(--shadow-card)]',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-secondary group-[.toast]:text-foreground',
          success:
            'group-[.toaster]:border-success-border group-[.toaster]:bg-success-surface group-[.toaster]:text-foreground',
          error:
            'group-[.toaster]:border-destructive group-[.toaster]:bg-error-surface group-[.toaster]:text-foreground',
          warning:
            'group-[.toaster]:border-warning-border group-[.toaster]:bg-warning-surface group-[.toaster]:text-foreground',
          info: 'group-[.toaster]:border-info group-[.toaster]:bg-info-surface group-[.toaster]:text-foreground',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

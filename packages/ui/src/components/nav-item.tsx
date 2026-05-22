import { cn } from '@repo/ui/lib/utils'
import type { ReactNode } from 'react'

interface NavItemProps extends React.ComponentProps<'button'> {
  icon?: ReactNode
  active?: boolean
  destructive?: boolean
}

function NavItem({ icon, active, destructive, className, children, ...props }: NavItemProps) {
  return (
    <button
      type="button"
      data-slot="nav-item"
      data-active={active || undefined}
      className={cn(
        'mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors',
        active && 'bg-primary text-primary-foreground shadow-[var(--shadow-nav-active)]',
        !active && !destructive && 'text-muted-foreground hover:bg-secondary',
        destructive && 'text-destructive hover:bg-destructive/8',
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
      {children}
    </button>
  )
}

export { NavItem }

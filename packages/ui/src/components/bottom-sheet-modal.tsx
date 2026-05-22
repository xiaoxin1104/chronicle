import { cn } from '@repo/ui/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useId } from 'react'

type BottomSheetModalProps = {
  children: React.ReactNode
  className?: string
  description?: string
  dismissible?: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

function BottomSheetModal({
  children,
  className,
  description,
  dismissible = true,
  onOpenChange,
  open,
  title,
}: BottomSheetModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        onOpenChange(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissible, onOpenChange, open])

  return (
    <div
      aria-describedby={open && description ? descriptionId : undefined}
      aria-hidden={!open}
      aria-labelledby={open ? titleId : undefined}
      aria-modal={open ? 'true' : undefined}
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center px-0 sm:px-4',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      data-slot="bottom-sheet-modal"
      role="dialog"
    >
      <button
        aria-label="Close modal"
        className={cn(
          'absolute inset-0 bg-foreground/28 backdrop-blur-[2px] transition-opacity duration-300 ease-[var(--ease-emphasis)]',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => {
          if (dismissible) {
            onOpenChange(false)
          }
        }}
        type="button"
      />

      <div
        className={cn(
          'relative z-10 w-full max-h-[min(82dvh,720px)] overflow-y-auto border border-border bg-card px-5 pb-8 pt-4 text-card-foreground shadow-[var(--shadow-dialog)]',
          'rounded-t-[32px] transition-[transform,opacity] duration-300 ease-[var(--ease-emphasis)]',
          'sm:mb-6 sm:max-w-[560px] sm:rounded-[32px]',
          open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 sm:translate-y-16',
          className,
        )}
      >
        <div className="mx-auto h-1.5 w-14 rounded-full bg-border" />

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold leading-[30px]" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p
                className="mt-2 text-[14px] leading-[22px] text-muted-foreground"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            aria-label="Close bottom sheet"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={!dismissible}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export { BottomSheetModal }

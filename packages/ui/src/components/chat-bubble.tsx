import { cn } from '@repo/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const chatBubbleVariants = cva('rounded-20 p-4 text-sm leading-relaxed whitespace-pre-line', {
  variants: {
    variant: {
      incoming: 'bg-secondary text-foreground',
      outgoing: 'bg-primary text-primary-foreground shadow-[var(--shadow-cta-sm)]',
    },
  },
  defaultVariants: {
    variant: 'incoming',
  },
})

function ChatBubble({
  variant,
  className,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof chatBubbleVariants>) {
  return (
    <div
      data-slot="chat-bubble"
      className={cn(chatBubbleVariants({ variant, className }))}
      {...props}
    />
  )
}

export { ChatBubble, chatBubbleVariants }

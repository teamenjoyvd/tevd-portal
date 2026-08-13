'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

function PopoverContent({
  children,
  align = 'end',
  sideOffset = 8,
  style,
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        style={{
          backgroundColor: 'var(--bg-global)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-modal)',
          outline: 'none',
          ...style,
        }}
        className={className}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }

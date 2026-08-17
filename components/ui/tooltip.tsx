'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({
  children,
  sideOffset = 6,
  style,
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        style={{
          backgroundColor: 'var(--bg-global)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-modal)',
          outline: 'none',
          maxWidth: '320px',
          padding: '8px 10px',
          ...style,
        }}
        className={className}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator

function DropdownMenuContent({
  children,
  align = 'end',
  sideOffset = 8,
  style,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        style={{
          width: 220,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          outline: 'none',
          animation: 'none',
          opacity: 1,
          ...style,
        }}
        className={className}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  children,
  style,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      style={{ outline: 'none', ...style }}
      className={className}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}

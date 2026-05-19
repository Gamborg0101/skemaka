"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={400} closeDelay={0}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "transition-opacity duration-100",
              className
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

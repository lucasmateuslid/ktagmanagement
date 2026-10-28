import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-2xs font-black uppercase tracking-widest transition-[background-color,border-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-fg-on-accent hover:bg-accent-hover",
        primary: "bg-accent text-fg-on-accent hover:bg-accent-hover",
        destructive: "bg-danger text-white hover:brightness-110",
        danger: "bg-danger text-white hover:brightness-110",
        outline:
          "border border-line bg-transparent text-fg-1 hover:bg-surface-2",
        secondary:
          "border border-line bg-surface-2 text-fg-1 hover:border-primary-500/40",
        ghost: "bg-transparent text-fg-1 hover:bg-surface-2",
        // Sólido escuro em light / claro em dark (ex.: "Relatório KPI").
        inverse: "bg-fg-1 text-surface hover:opacity-90",
        link: "text-accent underline-offset-4 hover:underline normal-case tracking-normal text-sm font-bold",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-14 px-8 text-xs",
        // CTA principal de módulo: pílula com brilho da marca.
        pill: "h-11 rounded-pill px-6 shadow-glow-amber",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

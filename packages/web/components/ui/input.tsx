import * as React from "react"

import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Injetado por <Field error>; aplica estado de erro sem vazar para o DOM. */
  invalid?: boolean
  /** Ícone à esquerda (Lucide, 16px). */
  leadingIcon?: React.ReactNode
}

/** Classes base do campo de texto do DS — para inputs especializados (CPF, telefone). */
export const inputClassName =
  "flex h-11 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3 transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, leadingIcon, ...props }, ref) => {
    const field = (
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-11 w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-danger" : "border-line",
          leadingIcon && "pl-10",
          className
        )}
        ref={ref}
        {...props}
      />
    )
    if (!leadingIcon) return field
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden>
          {leadingIcon}
        </span>
        {field}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }

import * as React from "react"

import { cn } from "@/lib/utils"

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  src?: string | null
  alt?: string
  fallback?: React.ReactNode
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-muted text-muted-foreground relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt ?? ""} className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-xs font-medium">
          {fallback}
        </span>
      )}
    </div>
  )
)
Avatar.displayName = "Avatar"

export { Avatar }

import { useState } from "react"

import { cn } from "@/lib/utils"

export type ProjectRepoAvatarProps = {
  owner: string | null
  displayName: string
  fullName: string
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: { box: "size-8 text-xs rounded-md", img: "size-8 rounded-md" },
  md: { box: "size-10 text-sm rounded-lg", img: "size-10 rounded-lg" },
  lg: { box: "size-12 text-base rounded-lg", img: "size-12 rounded-lg" },
} as const

export function ProjectRepoAvatar({
  owner,
  displayName,
  fullName,
  className,
  size = "md",
}: ProjectRepoAvatarProps) {
  const [failed, setFailed] = useState(false)
  const src = owner ? `https://github.com/${owner}.png?size=96` : null
  const initial = (displayName.trim() || fullName.trim() || "?").slice(0, 1).toUpperCase()
  const sizes = sizeClasses[size]

  if (!src || failed) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center font-semibold",
          sizes.box,
          className
        )}
        aria-hidden
      >
        {initial}
      </div>
    )
  }

  const px = size === "sm" ? 32 : size === "lg" ? 48 : 40

  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      className={cn("shrink-0 object-cover", sizes.img, className)}
      onError={() => setFailed(true)}
    />
  )
}

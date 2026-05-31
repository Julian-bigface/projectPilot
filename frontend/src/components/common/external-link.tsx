import { useCallback, type ComponentPropsWithoutRef, type MouseEvent } from "react"

import { isDesktopShell, openExternalUrl } from "@/lib/open-external-url"
import { cn } from "@/lib/utils"

export type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string
}

/** 外链：浏览器走 target=_blank；桌面壳拦截点击并用系统浏览器打开。 */
export function ExternalLink({
  href,
  className,
  onClick,
  target = "_blank",
  rel = "noreferrer noopener",
  children,
  ...props
}: ExternalLinkProps) {
  const handleClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || !href || !isDesktopShell()) return
      event.preventDefault()
      await openExternalUrl(href)
    },
    [href, onClick]
  )

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={cn(className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  )
}

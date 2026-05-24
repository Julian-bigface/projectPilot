import { useTheme } from "next-themes"
import { Toaster, type ToasterProps } from "sonner"

export function ThemeAwareToaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} {...props} />
}

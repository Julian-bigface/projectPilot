import type { ReactNode } from "react"

type SettingsSectionProps = {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}

export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

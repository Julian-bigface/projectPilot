import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TranslationSettingsForm } from "@/components/settings/translation-settings-form"

type TranslationSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TranslationSettingsDialog({ open, onOpenChange }: TranslationSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-md">
        <DialogHeader className="space-y-1">
          <DialogTitle>翻译偏好</DialogTitle>
          <DialogDescription>设置 README 与简介翻译的目标语言。</DialogDescription>
        </DialogHeader>
        <TranslationSettingsForm />
      </DialogContent>
    </Dialog>
  )
}

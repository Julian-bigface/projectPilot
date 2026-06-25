import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function DiscoveryUncollectConfirmDialog({
  open,
  onOpenChange,
  fullName,
  confirming = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullName: string
  confirming?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>取消收藏？</AlertDialogTitle>
          <AlertDialogDescription>
            将从资料库移除 <span className="font-mono">{fullName}</span>
            。此操作不会放入回收站，相关笔记与内容工厂草稿也会一并删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>保留收藏</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirming}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {confirming ? "处理中…" : "取消收藏"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

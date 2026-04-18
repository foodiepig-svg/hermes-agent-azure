'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDeleteModalProps {
  projectName: string
  onClose: () => void
}

export function ConfirmDeleteModal({ projectName, onClose }: ConfirmDeleteModalProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const isMatch = value === projectName

  const handleDelete = async () => {
    if (!isMatch) return
    setLoading(true)

    try {
      const res = await fetch(`/api/projects/${projectName}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to delete project')
        return
      }
      toast.success(`Project "${projectName}" deleted`)
      onClose()
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <DialogTitle>Delete Project</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This will permanently delete <strong>{projectName}</strong> and all its Azure
              resources. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="confirm">Type the project name to confirm</Label>
            <Input
              id="confirm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={projectName}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isMatch || loading}
            >
              {loading ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function CreateProjectModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [githubRepoUrl, setGithubRepoUrl] = useState('')
  const [azureRegion, setAzureRegion] = useState('southeastasia')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, telegramToken, githubRepoUrl, azureRegion }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create project')
        return
      }

      toast.success(`Project "${name}" created`)
      setOpen(false)
      setName('')
      setTelegramToken('')
      setGithubRepoUrl('')
      setAzureRegion('southeastasia')
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="my-awesome-bot"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              pattern="[a-z0-9-]+"
              required
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegramToken">Telegram Bot Token</Label>
            <Input
              id="telegramToken"
              type="password"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="githubRepoUrl">GitHub Repo URL</Label>
            <Input
              id="githubRepoUrl"
              type="url"
              placeholder="https://github.com/user/my-profile-repo"
              value={githubRepoUrl}
              onChange={(e) => setGithubRepoUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="azureRegion">Azure Region</Label>
            <Select value={azureRegion} onValueChange={(v) => setAzureRegion(v ?? 'southeastasia')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="southeastasia">Southeast Asia (Singapore)</SelectItem>
                <SelectItem value="australiaeast">Australia East (Sydney)</SelectItem>
                <SelectItem value="eastus">East US (Virginia)</SelectItem>
                <SelectItem value="westeurope">West Europe (Netherlands)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

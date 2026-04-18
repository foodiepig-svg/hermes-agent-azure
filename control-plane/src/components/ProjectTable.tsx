'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, MoreHorizontal, Trash2, Copy, Check } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  githubRepoUrl: string
  azureRegion: string
  containerAppFqdn: string | null
  status: string
  createdAt: string
}

interface ProjectTableProps {
  projects: Project[]
}

export function ProjectTable({ projects }: ProjectTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const copyUrl = (name: string, fqdn: string | null) => {
    if (!fqdn) return
    navigator.clipboard.writeText(fqdn)
    setCopied(name)
    toast.success('URL copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h3 className="text-lg font-medium text-foreground mb-1">No projects yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first Hermes project using the &quot;New Project&quot; button above.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>GitHub</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{project.name}</span>
                    {project.containerAppFqdn && (
                      <a
                        href={project.containerAppFqdn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        {project.containerAppFqdn.replace('https://', '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={project.status as 'healthy' | 'degraded' | 'unhealthy' | 'unknown'} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal text-xs">
                    {project.azureRegion}
                  </Badge>
                </TableCell>
                <TableCell>
                  <a
                    href={project.githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    View repo
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString('en-AU', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-[160px]">
                      {project.containerAppFqdn && (
                        <DropdownMenuItem onClick={() => copyUrl(project.name, project.containerAppFqdn)}>
                          {copied === project.name ? (
                            <Check className="w-4 h-4 mr-2 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          {copied === project.name ? 'Copied!' : 'Copy URL'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(project.name)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          projectName={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

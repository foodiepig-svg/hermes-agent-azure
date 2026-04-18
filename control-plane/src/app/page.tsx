'use client'

import { useEffect, useState } from 'react'
import { Bot, Activity, CheckCircle, XCircle } from 'lucide-react'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { ProjectTable } from '@/components/ProjectTable'

interface Project {
  id: string
  name: string
  githubRepoUrl: string
  azureRegion: string
  containerAppFqdn: string | null
  status: string
  createdAt: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const healthy = projects.filter((p) => p.status === 'healthy').length
  const unhealthy = projects.filter((p) => p.status === 'unhealthy').length
  const degraded = projects.filter((p) => p.status === 'degraded').length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Hermes Control Plane</h1>
          </div>
          <CreateProjectModal />
        </div>
      </header>

      {/* Summary bar */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Bot className="w-4 h-4" />
              Total Bots
            </div>
            <div className="text-2xl font-semibold text-foreground">{projects.length}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Healthy
            </div>
            <div className="text-2xl font-semibold text-foreground">{healthy}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Degraded
            </div>
            <div className="text-2xl font-semibold text-foreground">{degraded}</div>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <XCircle className="w-4 h-4" />
              Unhealthy
            </div>
            <div className="text-2xl font-semibold text-foreground">{unhealthy}</div>
          </div>
        </div>

        {/* Project list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="animate-pulse">Loading projects...</div>
          </div>
        ) : (
          <ProjectTable projects={projects} />
        )}
      </div>
    </div>
  )
}

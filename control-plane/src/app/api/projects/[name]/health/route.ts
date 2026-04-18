import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[name]/health
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    const project = await prisma.project.findUnique({ where: { name } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const fqdn = project.containerAppFqdn
    if (!fqdn || fqdn === 'https://placeholder.containers.azure.com') {
      return NextResponse.json({
        status: 'unknown',
        responseTimeMs: null,
        checkedAt: new Date().toISOString(),
        note: 'Not yet provisioned',
      })
    }

    // Try to hit the /health endpoint on the container app
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${fqdn}/health`, {
        signal: controller.signal,
        method: 'GET',
      })

      clearTimeout(timeout)
      const responseTimeMs = Date.now() - start

      if (response.ok) {
        return NextResponse.json({
          status: 'healthy',
          responseTimeMs,
          checkedAt: new Date().toISOString(),
        })
      } else {
        return NextResponse.json({
          status: 'degraded',
          responseTimeMs,
          checkedAt: new Date().toISOString(),
          statusCode: response.status,
        })
      }
    } catch {
      return NextResponse.json({
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        error: 'Connection failed or timed out',
      })
    }
  } catch (error) {
    console.error(`GET /api/projects/${name}/health error:`, error)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}

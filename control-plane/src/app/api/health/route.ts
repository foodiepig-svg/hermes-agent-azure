import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/health — control plane's own health check
export async function GET() {
  try {
    // Quick DB check
    await prisma.project.count()
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database unavailable' },
      { status: 503 }
    )
  }
}

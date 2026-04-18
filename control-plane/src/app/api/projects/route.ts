import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'

// GET /api/projects — list all
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST /api/projects — create new project (stub: no Azure provisioning yet)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, telegramToken, githubRepoUrl, azureRegion } = body

    // Basic validation
    if (!name || !telegramToken || !githubRepoUrl) {
      return NextResponse.json({ error: 'name, telegramToken, githubRepoUrl are required' }, { status: 400 })
    }

    // Validate name format (lowercase, no spaces)
    if (!/^[a-z0-9-]+$/.test(name)) {
      return NextResponse.json({ error: 'Name must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }

    // Check uniqueness
    const existing = await prisma.project.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: 'Project name already exists' }, { status: 409 })
    }

    // Encrypt token before storing
    const encryptedToken = encrypt(telegramToken)

    // Stub: containerAppFqdn is placeholder until Azure provisioning is wired up
    const project = await prisma.project.create({
      data: {
        name,
        telegramToken: encryptedToken,
        githubRepoUrl,
        azureRegion: azureRegion || 'southeastasia',
        containerAppFqdn: 'https://placeholder.containers.azure.com',
        status: 'healthy',
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

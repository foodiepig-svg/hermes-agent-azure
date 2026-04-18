import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// GET /api/projects/[name]
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
    // Decrypt token for display (only in API — UI will mask it)
    const decryptedToken = decrypt(project.telegramToken)
    return NextResponse.json({ ...project, telegramToken: decryptedToken })
  } catch (error) {
    console.error(`GET /api/projects/${name} error:`, error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// DELETE /api/projects/[name]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    const project = await prisma.project.findUnique({ where: { name } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Stub: no Azure resource deletion yet — just delete the DB record
    await prisma.project.delete({ where: { name } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`DELETE /api/projects/${name} error:`, error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectAssetType, MAX_FILE_SIZE_BYTES } from '@/lib/utils'

export const runtime  = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData()
    const file      = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'file and projectId are required' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 413 }
      )
    }

    const assetType = detectAssetType(file.type)
    if (!assetType) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 415 }
      )
    }

    const supabase  = createAdminClient()
    const ext       = file.name.split('.').pop() ?? 'bin'
    const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Stream to Supabase Storage
    const buffer  = await file.arrayBuffer()
    const { error: uploadError } = await supabase
      .storage
      .from('omnicraft-assets')
      .upload(storagePath, buffer, {
        contentType:    file.type,
        upsert:         false,
        cacheControl:   '3600',
      })

    if (uploadError) {
      console.error('[UPLOAD] storage error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    // Get signed URL (1 hour — enough for immediate analysis)
    const { data: urlData } = await supabase
      .storage
      .from('omnicraft-assets')
      .createSignedUrl(storagePath, 3600)

    const url = urlData?.signedUrl ?? storagePath

    // Persist asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        project_id: projectId,
        type:       assetType,
        url,
        filename:   file.name,
        size_bytes: file.size,
      })
      .select('id, type, url, filename, size_bytes')
      .single()

    if (assetError) {
      console.error('[UPLOAD] asset record error:', assetError)
      return NextResponse.json({ error: 'Failed to record asset' }, { status: 500 })
    }

    return NextResponse.json({
      assetId:  asset.id,
      type:     asset.type,
      url:      asset.url,
      filename: asset.filename,
    })
  } catch (error) {
    console.error('[UPLOAD ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

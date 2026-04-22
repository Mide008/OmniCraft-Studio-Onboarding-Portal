import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file     = formData.get('file')    as File   | null
    const assetId  = formData.get('assetId') as string | null

    if (!file || !assetId) {
      return NextResponse.json(
        { error: 'file and assetId are required' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured', transcription: null },
        { status: 200 }  // Soft fail
      )
    }

    // Forward audio to Groq Whisper
    const groqForm = new FormData()
    groqForm.append('file',            file)
    groqForm.append('model',           'whisper-large-v3')
    groqForm.append('response_format', 'json')
    groqForm.append('language',        'en')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body:    groqForm,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[TRANSCRIBE] Groq error:', err)
      return NextResponse.json({ error: 'Transcription failed', transcription: null }, { status: 500 })
    }

    const { text: transcription } = await res.json()

    if (!transcription) {
      return NextResponse.json({ transcription: null })
    }

    // Persist transcription
    const supabase = createAdminClient()
    await supabase
      .from('assets')
      .update({ transcription })
      .eq('id', assetId)

    return NextResponse.json({ transcription })
  } catch (error) {
    console.error('[TRANSCRIBE ERROR]', error)
    return NextResponse.json({ error: 'Internal server error', transcription: null }, { status: 500 })
  }
}

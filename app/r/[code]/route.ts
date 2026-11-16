import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function normalizeRedirectUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params
  const cleanCode = (code || '').trim()

  const searchParams = request.nextUrl.searchParams
  const rawSource = (searchParams.get('s') || '').toLowerCase()
  const source: 'qr' | 'nfc' | 'unknown' =
    rawSource === 'qr' || rawSource === 'nfc' ? rawSource : 'unknown'

  const inactiveUrl = new URL('/inactive', request.url)

  if (!cleanCode) {
    return NextResponse.redirect(inactiveUrl, 307)
  }

  try {
    const supabase = await createClient()

    const { data: product, error } = await supabase
      .from('products')
      .select(
        `
        id,
        product_code,
        status,
        business_id,
        businesses (
          id,
          business_name,
          google_review_url
        )
      `
      )
      .eq('product_code', cleanCode)
      .maybeSingle()

    if (error || !product || product.status !== 'active') {
      return NextResponse.redirect(inactiveUrl, 307)
    }

    const businessData = Array.isArray(product.businesses)
      ? product.businesses[0]
      : product.businesses

    const validTargetUrl = normalizeRedirectUrl(businessData?.google_review_url)

    if (!validTargetUrl) {
      return NextResponse.redirect(inactiveUrl, 307)
    }

    const userAgent = request.headers.get('user-agent') || null

    await supabase.from('scan_events').insert({
      product_id: product.id,
      source,
      user_agent: userAgent,
    })

    return NextResponse.redirect(validTargetUrl, 307)
  } catch {
    return NextResponse.redirect(inactiveUrl, 307)
  }
}

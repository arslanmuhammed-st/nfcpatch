'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Product } from '@/types/database'
import PrintExportModal from '@/components/PrintExportModal'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function DashboardPrintPage() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('product_code', { ascending: true })
      if (data) {
        setProducts(data as Product[])
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8 space-y-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white bg-[#18181b] border border-[#27272a] px-3.5 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard&apos;a Dön</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs">Ürün listesi yükleniyor...</span>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto">
          <PrintExportModal
            isOpen={true}
            onClose={() => {}}
            products={products}
            standalone={true}
          />
        </div>
      )}
    </div>
  )
}

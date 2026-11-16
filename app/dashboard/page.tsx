'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/utils/supabase/client'
import {
  Business,
  Product,
  NfcType,
  ProductStatus,
  getProductBusiness,
} from '@/types/database'
import PrintExportModal from '@/components/PrintExportModal'
import {
  Wifi,
  LogOut,
  PlusCircle,
  Zap,
  Printer,
  Package,
  CheckCircle2,
  Clock,
  BarChart3,
  Search,
  ExternalLink,
  Edit3,
  Power,
  Loader2,
  X,
  Building2,
  AlertCircle,
  RefreshCw,
  QrCode,
  ShieldBan,
  Copy,
  Check,
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [totalScans, setTotalScans] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Filters & search
  const [activeTab, setActiveTab] = useState<'all' | ProductStatus>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Batch Generator State
  const [batchStartNum, setBatchStartNum] = useState<number>(1)
  const [batchCount, setBatchCount] = useState<number>(100)
  const [batchNfcType, setBatchNfcType] = useState<NfcType>('standard')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  // Quick Field Activation State
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [businessMode, setBusinessMode] = useState<'new' | 'existing'>('new')
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('')
  const [newBusinessName, setNewBusinessName] = useState<string>('')
  const [newGoogleReviewUrl, setNewGoogleReviewUrl] = useState<string>('')
  const [newCity, setNewCity] = useState<string>('İzmir')
  const [newNotes, setNewNotes] = useState<string>('')
  const [activateSubmitting, setActivateSubmitting] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [activatedSuccessProduct, setActivatedSuccessProduct] =
    useState<Product | null>(null)

  // Edit Product / Business Link Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editBusinessName, setEditBusinessName] = useState<string>('')
  const [editGoogleUrl, setEditGoogleUrl] = useState<string>('')
  const [editCity, setEditCity] = useState<string>('İzmir')
  const [editNotes, setEditNotes] = useState<string>('')
  const [editNfcType, setEditNfcType] = useState<NfcType>('standard')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Action loading state per product row
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Live QR Test Modal State ("Canlı QR Testi")
  const [testingProduct, setTestingProduct] = useState<Product | null>(null)
  const [testUrlMode, setTestUrlMode] = useState<'production' | 'local'>(
    'production'
  )
  const [testQrDataUrl, setTestQrDataUrl] = useState<string>('')
  const [copiedTestUrl, setCopiedTestUrl] = useState<boolean>(false)

  const currentTestUrl = useMemo(() => {
    if (!testingProduct) return ''
    if (testUrlMode === 'local' && typeof window !== 'undefined') {
      return `${window.location.origin}/r/${testingProduct.product_code}`
    }
    return `https://nfcpatch.link/r/${testingProduct.product_code}`
  }, [testingProduct, testUrlMode])

  useEffect(() => {
    if (!currentTestUrl) {
      setTestQrDataUrl('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(currentTestUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setTestQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setTestQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [currentTestUrl])

  function openTestModal(product: Product) {
    setTestingProduct(product)
    setTestUrlMode('production')
    setCopiedTestUrl(false)
  }

  async function handleCopyTestUrl() {
    if (!currentTestUrl) return
    try {
      await navigator.clipboard.writeText(currentTestUrl)
      setCopiedTestUrl(true)
      setTimeout(() => setCopiedTestUrl(false), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  const fetchDashboardData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      try {
        const [productsRes, businessesRes, scansRes] = await Promise.all([
          supabase
            .from('products')
            .select(
              `
              id,
              product_code,
              display_code,
              nfc_type,
              status,
              business_id,
              activated_at,
              created_at,
              businesses (
                id,
                business_name,
                google_review_url,
                city,
                notes,
                created_at
              )
            `
            )
            .order('product_code', { ascending: true }),
          supabase
            .from('businesses')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('scan_events')
            .select('id', { count: 'exact', head: true }),
        ])

        if (productsRes.data) {
          setProducts(productsRes.data as unknown as Product[])
        }
        if (businessesRes.data) {
          setBusinesses(businessesRes.data as Business[])
        }
        if (typeof scansRes.count === 'number') {
          setTotalScans(scansRes.count)
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Auto-suggest next available product number
  const nextSuggestedNumber = useMemo(() => {
    if (products.length === 0) return 1
    let maxNum = 0
    for (const p of products) {
      const parsed = parseInt(p.product_code.replace(/\D/g, ''), 10)
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed
      }
    }
    return maxNum + 1
  }, [products])

  // KPI metrics
  const kpis = useMemo(() => {
    const total = products.length
    const active = products.filter((p) => p.status === 'active').length
    const unassigned = products.filter((p) => p.status === 'unassigned').length
    return {
      total,
      active,
      unassigned,
      scans: totalScans,
    }
  }, [products, totalScans])

  const unassignedProducts = useMemo(
    () => products.filter((p) => p.status === 'unassigned'),
    [products]
  )

  // Filtered products for table & mobile cards
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((p) => {
      if (activeTab !== 'all' && p.status !== activeTab) {
        return false
      }
      if (!q) return true
      const biz = getProductBusiness(p)
      const codeMatch =
        p.product_code.toLowerCase().includes(q) ||
        p.display_code.toLowerCase().includes(q)
      const bizMatch =
        biz?.business_name?.toLowerCase().includes(q) ||
        biz?.city?.toLowerCase().includes(q) ||
        biz?.google_review_url?.toLowerCase().includes(q)
      return Boolean(codeMatch || bizMatch)
    })
  }, [products, activeTab, searchQuery])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Open Batch Generator Modal with auto-suggested start number
  function openBatchModal() {
    setBatchStartNum(nextSuggestedNumber)
    setBatchCount(100)
    setBatchNfcType('standard')
    setBatchError(null)
    setIsBatchModalOpen(true)
  }

  async function handleGenerateBatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBatchError(null)

    const start = Math.max(1, Math.floor(batchStartNum))
    const count = Math.min(1000, Math.max(1, Math.floor(batchCount)))

    setBatchSubmitting(true)
    try {
      const existingCodes = new Set(products.map((p) => p.product_code))
      const rowsToInsert: {
        product_code: string
        display_code: string
        nfc_type: NfcType
        status: ProductStatus
      }[] = []

      for (let i = 0; i < count; i++) {
        const num = start + i
        const padded = String(num).padStart(4, '0')
        if (!existingCodes.has(padded)) {
          rowsToInsert.push({
            product_code: padded,
            display_code: `QR-${padded}`,
            nfc_type: batchNfcType,
            status: 'unassigned',
          })
        }
      }

      if (rowsToInsert.length === 0) {
        setBatchError(
          'Belirtilen aralıktaki tüm ürün kodları zaten envanterde mevcut.'
        )
        setBatchSubmitting(false)
        return
      }

      const { error } = await supabase.from('products').insert(rowsToInsert)
      if (error) {
        setBatchError(`Parti üretimi başarısız: ${error.message}`)
        setBatchSubmitting(false)
        return
      }

      await fetchDashboardData()
      setIsBatchModalOpen(false)
    } catch {
      setBatchError('Parti üretilirken beklenmeyen bir hata oluştu.')
    } finally {
      setBatchSubmitting(false)
    }
  }

  // Open Quick Activation Modal
  function openActivateModal(product?: Product) {
    setActivateError(null)
    setActivatedSuccessProduct(null)

    if (product) {
      setSelectedProductId(product.id)
    } else if (unassignedProducts.length > 0) {
      setSelectedProductId(unassignedProducts[0].id)
    } else {
      setSelectedProductId('')
    }

    setBusinessMode('new')
    setSelectedBusinessId(businesses[0]?.id || '')
    setNewBusinessName('')
    setNewGoogleReviewUrl('')
    setNewCity('İzmir')
    setNewNotes('')
    setIsActivateModalOpen(true)
  }

  async function handleQuickActivate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setActivateError(null)

    if (!selectedProductId) {
      setActivateError('Lütfen aktive edilecek bir ürün kodu seçin.')
      return
    }

    setActivateSubmitting(true)
    try {
      let targetBusinessId = selectedBusinessId

      if (businessMode === 'new') {
        const cleanName = newBusinessName.trim()
        const cleanUrl = newGoogleReviewUrl.trim()
        if (!cleanName || !cleanUrl) {
          setActivateError('İşletme adı ve Google Yorum linki zorunludur.')
          setActivateSubmitting(false)
          return
        }

        const normalizedUrl = /^https?:\/\//i.test(cleanUrl)
          ? cleanUrl
          : `https://${cleanUrl}`

        const { data: createdBiz, error: bizErr } = await supabase
          .from('businesses')
          .insert({
            business_name: cleanName,
            google_review_url: normalizedUrl,
            city: newCity.trim() || 'İzmir',
            notes: newNotes.trim() || null,
          })
          .select('*')
          .single()

        if (bizErr || !createdBiz) {
          setActivateError(
            `İşletme kaydedilemedi: ${bizErr?.message || 'Bilinmeyen hata'}`
          )
          setActivateSubmitting(false)
          return
        }

        targetBusinessId = createdBiz.id
      } else {
        if (!targetBusinessId) {
          setActivateError('Lütfen listeden bir işletme seçin.')
          setActivateSubmitting(false)
          return
        }
      }

      const { data: updatedProduct, error: prodErr } = await supabase
        .from('products')
        .update({
          status: 'active',
          business_id: targetBusinessId,
          activated_at: new Date().toISOString(),
        })
        .eq('id', selectedProductId)
        .select(
          `
          id,
          product_code,
          display_code,
          nfc_type,
          status,
          business_id,
          activated_at,
          created_at,
          businesses (
            id,
            business_name,
            google_review_url,
            city,
            notes,
            created_at
          )
        `
        )
        .single()

      if (prodErr || !updatedProduct) {
        setActivateError(
          `Ürün aktive edilemedi: ${prodErr?.message || 'Bilinmeyen hata'}`
        )
        setActivateSubmitting(false)
        return
      }

      setActivatedSuccessProduct(updatedProduct as unknown as Product)
      await fetchDashboardData()
    } catch {
      setActivateError('Aktivasyon sırasında beklenmeyen bir hata oluştu.')
    } finally {
      setActivateSubmitting(false)
    }
  }

  // Open Edit Link Modal
  function openEditModal(product: Product) {
    const biz = getProductBusiness(product)
    setEditingProduct(product)
    setEditBusinessName(biz?.business_name || '')
    setEditGoogleUrl(biz?.google_review_url || '')
    setEditCity(biz?.city || 'İzmir')
    setEditNotes(biz?.notes || '')
    setEditNfcType(product.nfc_type)
    setEditError(null)
    setIsEditModalOpen(true)
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingProduct) return
    setEditError(null)

    const cleanName = editBusinessName.trim()
    const cleanUrl = editGoogleUrl.trim()

    if (!cleanName || !cleanUrl) {
      setEditError('İşletme adı ve Google Yorum linki boş bırakılamaz.')
      return
    }

    const normalizedUrl = /^https?:\/\//i.test(cleanUrl)
      ? cleanUrl
      : `https://${cleanUrl}`

    setEditSubmitting(true)
    try {
      let businessId = editingProduct.business_id

      if (businessId) {
        const { error: bizUpdateErr } = await supabase
          .from('businesses')
          .update({
            business_name: cleanName,
            google_review_url: normalizedUrl,
            city: editCity.trim() || 'İzmir',
            notes: editNotes.trim() || null,
          })
          .eq('id', businessId)

        if (bizUpdateErr) {
          setEditError(`İşletme güncellenemedi: ${bizUpdateErr.message}`)
          setEditSubmitting(false)
          return
        }
      } else {
        const { data: createdBiz, error: bizCreateErr } = await supabase
          .from('businesses')
          .insert({
            business_name: cleanName,
            google_review_url: normalizedUrl,
            city: editCity.trim() || 'İzmir',
            notes: editNotes.trim() || null,
          })
          .select('*')
          .single()

        if (bizCreateErr || !createdBiz) {
          setEditError(
            `İşletme oluşturulamadı: ${bizCreateErr?.message || 'Hata'}`
          )
          setEditSubmitting(false)
          return
        }
        businessId = createdBiz.id
      }

      const { error: prodUpdateErr } = await supabase
        .from('products')
        .update({
          business_id: businessId,
          nfc_type: editNfcType,
          status:
            editingProduct.status === 'unassigned'
              ? 'active'
              : editingProduct.status,
          activated_at:
            editingProduct.activated_at || new Date().toISOString(),
        })
        .eq('id', editingProduct.id)

      if (prodUpdateErr) {
        setEditError(`Ürün güncellenemedi: ${prodUpdateErr.message}`)
        setEditSubmitting(false)
        return
      }

      await fetchDashboardData()
      setIsEditModalOpen(false)
    } catch {
      setEditError('Güncelleme sırasında bir hata oluştu.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Toggle between 'active' and 'disabled'
  async function handleToggleStatus(product: Product) {
    if (product.status === 'unassigned') {
      openActivateModal(product)
      return
    }

    const nextStatus: ProductStatus =
      product.status === 'active' ? 'disabled' : 'active'

    setTogglingId(product.id)
    try {
      await supabase
        .from('products')
        .update({ status: nextStatus })
        .eq('id', product.id)
      await fetchDashboardData()
    } finally {
      setTogglingId(null)
    }
  }

  function renderStatusBadge(status: ProductStatus) {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Aktif
        </span>
      )
    }
    if (status === 'unassigned') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Boşta
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        Pasif
      </span>
    )
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://nfcpatch.link'
  ).replace(/\/$/, '')

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  NFCPATCH
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Dinamik QR &amp; NTAG213 Saha Aktivasyon Paneli
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openActivateModal()}
              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Hızlı Aktivasyon</span>
            </button>

            <button
              type="button"
              onClick={openBatchModal}
              className="inline-flex items-center gap-1.5 bg-[#18181b] hover:bg-zinc-800 text-zinc-100 border border-[#27272a] font-medium px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Yeni Parti Üret</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-[#18181b] hover:bg-zinc-800 text-zinc-100 border border-[#27272a] font-medium px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Matbaa Baskı Çıktısı</span>
              <span className="md:hidden">Baskı</span>
            </button>

            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              title="Verileri Yenile"
              className="p-2 rounded-xl bg-[#18181b] hover:bg-zinc-800 border border-[#27272a] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Çıkış Yap"
              className="inline-flex items-center gap-1.5 bg-[#18181b] hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 text-zinc-400 border border-[#27272a] px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* 4-Column Responsive KPI Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">Toplam Stok</p>
              <p className="text-2xl sm:text-3xl font-bold text-white font-mono">
                {kpis.total}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-zinc-800/80 border border-[#27272a] flex items-center justify-center text-zinc-300">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">Aktif Kartlar</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">
                {kpis.active}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">Boşta Stok</p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono">
                {kpis.unassigned}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">
                Toplam Okutma
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-white font-mono">
                {kpis.scans}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Filter Bar & Search */}
        <section className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(
                [
                  { key: 'all', label: `Tümü (${products.length})` },
                  {
                    key: 'unassigned',
                    label: `Boşta (${kpis.unassigned})`,
                  },
                  { key: 'active', label: `Aktif (${kpis.active})` },
                  {
                    key: 'disabled',
                    label: `Pasif (${products.filter((p) => p.status === 'disabled').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : 'bg-[#09090b] text-zinc-400 hover:text-white border border-[#27272a]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Real-time Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kod (QR-0001) veya işletme ara..."
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Loading / Empty States */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Ürün envanteri yükleniyor...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-14 text-center space-y-3 border border-dashed border-[#27272a] rounded-xl bg-[#09090b]/50">
              <QrCode className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-300">
                  Gösterilecek ürün bulunamadı
                </p>
                <p className="text-xs text-zinc-500">
                  &ldquo;Yeni Parti Üret&rdquo; butonunu kullanarak ilk QR/NFC ürün partinizi oluşturabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={openBatchModal}
                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Yeni Parti Üret (0001 - 0100)</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto border border-[#27272a] rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#09090b] border-b border-[#27272a] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="py-3 px-4">Kod</th>
                      <th className="py-3 px-4">NFC Tipi</th>
                      <th className="py-3 px-4">Durum</th>
                      <th className="py-3 px-4">Atanan İşletme &amp; Hedef Link</th>
                      <th className="py-3 px-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a] text-sm">
                    {filteredProducts.map((product) => {
                      const biz = getProductBusiness(product)
                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-zinc-900/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-semibold text-white">
                            <div>{product.display_code}</div>
                            <div className="text-[11px] text-zinc-500 font-normal">
                              /r/{product.product_code}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[#09090b] border border-[#27272a] text-zinc-300">
                              {product.nfc_type === 'anti_metal'
                                ? 'Anti-Metal'
                                : 'Standart'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(product.status)}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            {biz ? (
                              <div className="space-y-0.5">
                                <div className="font-medium text-zinc-100 flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    {biz.business_name}
                                  </span>
                                  {biz.city && (
                                    <span className="text-[11px] text-zinc-500">
                                      ({biz.city})
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={biz.google_review_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-zinc-400 hover:text-emerald-400 truncate block font-mono"
                                >
                                  {biz.google_review_url}
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-500 italic">
                                Henüz işletme atanmadı
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {product.status === 'unassigned' ? (
                                <button
                                  type="button"
                                  onClick={() => openActivateModal(product)}
                                  className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>Aktive Et</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(product)}
                                    className="inline-flex items-center gap-1 bg-[#09090b] hover:bg-zinc-800 text-zinc-200 border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Linki Düzenle</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={togglingId === product.id}
                                    onClick={() => handleToggleStatus(product)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                                      product.status === 'active'
                                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/25'
                                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/25'
                                    }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    <span>
                                      {product.status === 'active'
                                        ? 'Durdur'
                                        : 'Aktifleştir'}
                                    </span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => openTestModal(product)}
                                className="inline-flex items-center gap-1 bg-[#09090b] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Test Et</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {filteredProducts.map((product) => {
                  const biz = getProductBusiness(product)
                  return (
                    <div
                      key={product.id}
                      className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-white">
                            {product.display_code}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">
                            {product.nfc_type === 'anti_metal'
                              ? 'Anti-Metal'
                              : 'Standart'}
                          </span>
                        </div>
                        {renderStatusBadge(product.status)}
                      </div>

                      {biz ? (
                        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 space-y-1">
                          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{biz.business_name}</span>
                            {biz.city && (
                              <span className="text-zinc-500 font-normal">
                                ({biz.city})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono truncate">
                            {biz.google_review_url}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">
                          Henüz bir işletmeye tanımlanmadı (`/r/{product.product_code}`)
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {product.status === 'unassigned' ? (
                          <button
                            type="button"
                            onClick={() => openActivateModal(product)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Hemen Aktive Et</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="flex-1 inline-flex items-center justify-center gap-1 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 border border-[#27272a] py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Linki Düzenle</span>
                            </button>
                            <button
                              type="button"
                              disabled={togglingId === product.id}
                              onClick={() => handleToggleStatus(product)}
                              className={`inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs border transition-colors cursor-pointer ${
                                product.status === 'active'
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>
                                {product.status === 'active'
                                  ? 'Durdur'
                                  : 'Aktifleştir'}
                              </span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => openTestModal(product)}
                          className="inline-flex items-center justify-center gap-1 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Et</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </main>

      {/* MODAL 1: Batch Product & QR Generator ("Yeni Parti Üret") */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Yeni Parti Üret (Toplu Stok)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="p-6 space-y-4">
              {batchError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{batchError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Başlangıç Numarası
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={batchStartNum}
                    onChange={(e) =>
                      setBatchStartNum(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Üretilecek Adet
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={batchCount}
                    onChange={(e) =>
                      setBatchCount(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  NFC Çip Tipi
                </label>
                <select
                  value={batchNfcType}
                  onChange={(e) => setBatchNfcType(e.target.value as NfcType)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="standard">Standart NTAG213</option>
                  <option value="anti_metal">Anti-Metal NTAG213</option>
                </select>
              </div>

              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3.5 space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Üretilecek Kod Aralığı:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    QR-{String(batchStartNum).padStart(4, '0')} → QR-
                    {String(
                      Math.max(batchStartNum, batchStartNum + batchCount - 1)
                    ).padStart(4, '0')}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>Kalıcı Yönlendirme Formatı:</span>
                  <span className="font-mono">
                    {siteUrl}/r/{String(batchStartNum).padStart(4, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[#09090b] border border-[#27272a] text-zinc-300 hover:text-white cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {batchSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Üretiliyor...</span>
                    </>
                  ) : (
                    <span>{batchCount} Adet Kart Üret</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Field Activation ("Aktive Et") */}
      {isActivateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Saha Hızlı Aktivasyon
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsActivateModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activatedSuccessProduct ? (
              <div className="p-6 space-y-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-white">
                    {activatedSuccessProduct.display_code} Başarıyla Aktive Edildi!
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Kart şu andan itibaren doğrudan işletmenin Google Değerlendirme sayfasına yönlendiriyor.
                  </p>
                </div>

                <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3.5 text-xs font-mono text-emerald-400 break-all">
                  {siteUrl}/r/{activatedSuccessProduct.product_code}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prod = activatedSuccessProduct
                      setIsActivateModalOpen(false)
                      openTestModal(prod)
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Canlı Test Et ({activatedSuccessProduct.display_code})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActivateModalOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-medium bg-[#09090b] border border-[#27272a] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuickActivate} className="p-6 space-y-4">
                {activateError && (
                  <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{activateError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Aktive Edilecek Boşta Kart Kodu
                  </label>
                  {unassignedProducts.length === 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3 text-xs">
                      Boşta (`unassigned`) ürün bulunmuyor. Önce yeni parti üretin.
                    </div>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                    >
                      {unassignedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_code} ({p.nfc_type === 'anti_metal' ? 'Anti-Metal' : 'Standart'}) — /r/{p.product_code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Mode Switcher: New Business vs Existing Business */}
                <div className="grid grid-cols-2 gap-2 bg-[#09090b] p-1 rounded-xl border border-[#27272a]">
                  <button
                    type="button"
                    onClick={() => setBusinessMode('new')}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      businessMode === 'new'
                        ? 'bg-[#18181b] text-white border border-[#27272a]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    + Yeni İşletme Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessMode('existing')}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      businessMode === 'existing'
                        ? 'bg-[#18181b] text-white border border-[#27272a]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Mevcut İşletme Seç ({businesses.length})
                  </button>
                </div>

                {businessMode === 'new' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        İşletme Adı *
                      </label>
                      <input
                        type="text"
                        required
                        value={newBusinessName}
                        onChange={(e) => setNewBusinessName(e.target.value)}
                        placeholder="Örn: Alsancak Kahve Dünyası"
                        className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Google Yorum / Değerlendirme Linki *
                      </label>
                      <input
                        type="text"
                        required
                        value={newGoogleReviewUrl}
                        onChange={(e) => setNewGoogleReviewUrl(e.target.value)}
                        placeholder="https://g.page/r/.../review"
                        className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Şehir
                        </label>
                        <input
                          type="text"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          placeholder="İzmir"
                          className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Notlar (Opsiyonel)
                        </label>
                        <input
                          type="text"
                          value={newNotes}
                          onChange={(e) => setNewNotes(e.target.value)}
                          placeholder="Masa üstü stand"
                          className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Kayıtlı İşletme Seçin
                    </label>
                    {businesses.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        Henüz kayıtlı işletme yok. &ldquo;Yeni İşletme Ekle&rdquo; sekmesini kullanın.
                      </p>
                    ) : (
                      <select
                        value={selectedBusinessId}
                        onChange={(e) => setSelectedBusinessId(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white"
                      >
                        {businesses.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.business_name} ({b.city || 'İzmir'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272a]">
                  <button
                    type="button"
                    onClick={() => setIsActivateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[#09090b] border border-[#27272a] text-zinc-300 hover:text-white cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={
                      activateSubmitting || unassignedProducts.length === 0
                    }
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {activateSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Aktive Ediliyor...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Kaydet ve Aktive Et</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Product / Business Link ("Linki Düzenle") */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Düzenle — {editingProduct.display_code}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs">
                  <ShieldBan className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  İşletme Adı
                </label>
                <input
                  type="text"
                  required
                  value={editBusinessName}
                  onChange={(e) => setEditBusinessName(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Hedef Google Yorum Linki
                </label>
                <input
                  type="text"
                  required
                  value={editGoogleUrl}
                  onChange={(e) => setEditGoogleUrl(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Şehir
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    NFC Tipi
                  </label>
                  <select
                    value={editNfcType}
                    onChange={(e) => setEditNfcType(e.target.value as NfcType)}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                  >
                    <option value="standard">Standart</option>
                    <option value="anti_metal">Anti-Metal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Notlar
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[#09090b] border border-[#27272a] text-zinc-300 hover:text-white cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <span>Değişiklikleri Kaydet</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Live QR Test ("Canlı QR Testi") */}
      {testingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Canlı QR Testi — {testingProduct.display_code}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Telefon kamerasıyla okutun veya tarayıcıda test edin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestingProduct(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Toggle: Production vs Local Test */}
              <div className="grid grid-cols-2 gap-1.5 bg-[#09090b] p-1 rounded-xl border border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setTestUrlMode('production')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    testUrlMode === 'production'
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Production (`nfcpatch.link`)
                </button>
                <button
                  type="button"
                  onClick={() => setTestUrlMode('local')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    testUrlMode === 'local'
                      ? 'bg-emerald-500 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Local Test (`localhost`)
                </button>
              </div>

              {/* Scannable QR Code Display */}
              <div className="flex flex-col items-center justify-center bg-[#09090b] border border-[#27272a] rounded-2xl p-5 space-y-3">
                {testQrDataUrl ? (
                  <div className="bg-white p-3 rounded-xl shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={testQrDataUrl}
                      alt={testingProduct.display_code}
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">
                    {testingProduct.display_code}
                  </span>
                  {renderStatusBadge(testingProduct.status)}
                </div>
              </div>

              {/* Encoded URL Box */}
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3 space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>QR İçindeki Yönlendirme Adresi:</span>
                  <span className="font-mono text-emerald-400">
                    {testUrlMode === 'production' ? 'Canlı' : 'Yerel'}
                  </span>
                </div>
                <div className="font-mono text-xs text-zinc-200 break-all select-all">
                  {currentTestUrl}
                </div>
              </div>

              {/* Action Buttons: Linki Kopyala & Aç */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyTestUrl}
                  className="inline-flex items-center justify-center gap-2 bg-[#09090b] hover:bg-zinc-800 text-zinc-100 border border-[#27272a] font-medium py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {copiedTestUrl ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-zinc-400" />
                      <span>Linki Kopyala</span>
                    </>
                  )}
                </button>

                <a
                  href={currentTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Aç</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Print-Ready PDF & CSV Exporter ("Matbaa Baskı Çıktısı") */}
      <PrintExportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
      />
    </div>
  )
}

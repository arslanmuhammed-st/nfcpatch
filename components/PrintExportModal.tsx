'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { Product } from '@/types/database'
import {
  X,
  Printer,
  FileDown,
  FileSpreadsheet,
  Sliders,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface PrintExportModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  standalone?: boolean
}

const CARD_SIZE_MM = 96
const CARD_SIZE_PT = 272.13
const PT_PER_MM = CARD_SIZE_PT / CARD_SIZE_MM
const CANVAS_PX = 640

// Pre-calibrated defaults matching template-card.png center QR box
const DEFAULT_CALIBRATION = {
  xOffsetMm: 36.6,
  yOffsetMm: 38.0,
  qrBoxSizeMm: 22.8,
}

export default function PrintExportModal({
  isOpen,
  onClose,
  products,
  standalone = false,
}: PrintExportModalProps) {
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      a.product_code.localeCompare(b.product_code, undefined, { numeric: true })
    )
  }, [products])

  const [startCode, setStartCode] = useState<string>('0001')
  const [endCode, setEndCode] = useState<string>('0100')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'unassigned' | 'active' | 'disabled'
  >('all')
  const [nfcTypeFilter, setNfcTypeFilter] = useState<
    'all' | 'standard' | 'anti_metal'
  >('all')

  const [xOffsetMm, setXOffsetMm] = useState<number>(
    DEFAULT_CALIBRATION.xOffsetMm
  )
  const [yOffsetMm, setYOffsetMm] = useState<number>(
    DEFAULT_CALIBRATION.yOffsetMm
  )
  const [qrBoxSizeMm, setQrBoxSizeMm] = useState<number>(
    DEFAULT_CALIBRATION.qrBoxSizeMm
  )
  const [previewIndex, setPreviewIndex] = useState<number>(0)

  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const templateImgRef = useRef<HTMLImageElement | null>(null)
  const [templateLoaded, setTemplateLoaded] = useState(false)

  useEffect(() => {
    if (sortedProducts.length > 0) {
      setStartCode(sortedProducts[0].product_code)
      setEndCode(sortedProducts[sortedProducts.length - 1].product_code)
    }
  }, [sortedProducts])

  const filteredProducts = useMemo(() => {
    const startNum = parseInt(startCode.replace(/\D/g, ''), 10)
    const endNum = parseInt(endCode.replace(/\D/g, ''), 10)

    return sortedProducts.filter((p) => {
      const codeNum = parseInt(p.product_code.replace(/\D/g, ''), 10)
      if (!isNaN(startNum) && !isNaN( codeNum) && codeNum < startNum) {
        return false
      }
      if (!isNaN(endNum) && !isNaN(codeNum) && codeNum > endNum) {
        return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false
      }
      if (nfcTypeFilter !== 'all' && p.nfc_type !== nfcTypeFilter) {
        return false
      }
      return true
    })
  }, [sortedProducts, startCode, endCode, statusFilter, nfcTypeFilter])

  useEffect(() => {
    setPreviewIndex(0)
  }, [filteredProducts.length])

  // Load template-card.png once for canvas preview
  useEffect(() => {
    if (!isOpen && !standalone) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      templateImgRef.current = img
      setTemplateLoaded(true)
    }
    img.src = '/template-card.png'
  }, [isOpen, standalone])

  const previewProduct = filteredProducts[previewIndex] || {
    product_code: startCode || '0001',
    display_code: `QR-${startCode || '0001'}`,
  }

  // Draw live preview on HTML5 Canvas whenever calibration or preview product changes
  useEffect(() => {
    if ((!isOpen && !standalone) || !templateLoaded) return
    const canvas = canvasRef.current
    const templateImg = templateImgRef.current
    if (!canvas || !templateImg) return

    let cancelled = false

    async function renderPreview() {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const pxPerMm = CANVAS_PX / CARD_SIZE_MM
      ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX)

      // 1. Draw template-card.png full-bleed
      ctx.drawImage(templateImg!, 0, 0, CANVAS_PX, CANVAS_PX)

      // 2. Draw white cover rectangle over placeholder QR area
      const boxX = xOffsetMm * pxPerMm
      const boxY = yOffsetMm * pxPerMm
      const boxSize = qrBoxSizeMm * pxPerMm

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxSize, boxSize)

      // 3. Generate and draw high-res QR code centered inside white box
      const redirectUrl = `https://nfcpatch.link/r/${previewProduct.product_code}`

      try {
        const qrDataUrl = await QRCode.toDataURL(redirectUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 512,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })

        if (cancelled) return

        const qrImg = new Image()
        qrImg.onload = () => {
          if (cancelled) return
          ctx.drawImage(qrImg, boxX, boxY, boxSize, boxSize)

          // Optional subtle alignment guide border in preview
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.strokeRect(boxX, boxY, boxSize, boxSize)
          ctx.setLineDash([])

          // 4. Draw serial number at bottom-right matching PDF (x: 235pt, y: 10pt from bottom)
          const pxPerPt = CANVAS_PX / CARD_SIZE_PT
          const serialX = 235 * pxPerPt
          const serialY = (CARD_SIZE_PT - 10) * pxPerPt
          const fontSizePx = Math.max(10, Math.round(6 * pxPerPt))

          ctx.font = `${fontSizePx}px Helvetica, Arial, sans-serif`
          ctx.fillStyle = '#27272a'
          ctx.fillText(previewProduct.display_code, serialX, serialY)
        }
        qrImg.src = qrDataUrl
      } catch {
        // ignore preview QR error
      }
    }

    renderPreview()

    return () => {
      cancelled = true
    }
  }, [
    isOpen,
    standalone,
    templateLoaded,
    xOffsetMm,
    yOffsetMm,
    qrBoxSizeMm,
    previewProduct.product_code,
    previewProduct.display_code,
  ])

  function handleResetCalibration() {
    setXOffsetMm(DEFAULT_CALIBRATION.xOffsetMm)
    setYOffsetMm(DEFAULT_CALIBRATION.yOffsetMm)
    setQrBoxSizeMm(DEFAULT_CALIBRATION.qrBoxSizeMm)
  }

  function handlePreset32mm() {
    setXOffsetMm(32.0)
    setYOffsetMm(34.0)
    setQrBoxSizeMm(32.0)
  }

  function getFileRangeSuffix(): string {
    if (filteredProducts.length > 0) {
      const first = filteredProducts[0].product_code
      const last = filteredProducts[filteredProducts.length - 1].product_code
      return `${first}-${last}`
    }
    return `${startCode || '0001'}-${endCode || '0100'}`
  }

  async function handleExportPdf() {
    if (filteredProducts.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Seçilen aralıkta dışa aktarılacak ürün bulunamadı.',
      })
      return
    }

    setGeneratingPdf(true)
    setFeedback(null)
    setPdfProgress('Kart şablonu yükleniyor...')

    try {
      const templateRes = await fetch('/template-card.png')
      if (!templateRes.ok) {
        throw new Error('Şablon görseli (/template-card.png) yüklenemedi.')
      }
      const templateBytes = await templateRes.arrayBuffer()

      const pdfDoc = await PDFDocument.create()
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

      // Embed template image (PNG or fallback to JPG if bytes are JPEG)
      let embeddedTemplate
      const header = new Uint8Array(templateBytes.slice(0, 4))
      const isPng =
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      if (isPng) {
        embeddedTemplate = await pdfDoc.embedPng(templateBytes)
      } else {
        embeddedTemplate = await pdfDoc.embedJpg(templateBytes)
      }

      const siteUrl = 'https://nfcpatch.link'

      const boxWidthPt = qrBoxSizeMm * PT_PER_MM
      const boxHeightPt = qrBoxSizeMm * PT_PER_MM
      const boxXPt = xOffsetMm * PT_PER_MM
      // PDF Y origin is bottom-left
      const boxYPt = CARD_SIZE_PT - (yOffsetMm + qrBoxSizeMm) * PT_PER_MM

      for (let i = 0; i < filteredProducts.length; i++) {
        const prod = filteredProducts[i]
        setPdfProgress(
          `PDF hazırlanıyor: ${prod.display_code} (${i + 1} / ${filteredProducts.length})`
        )

        const page = pdfDoc.addPage([CARD_SIZE_PT, CARD_SIZE_PT])

        // 1. Full-bleed template card (0, 0, 272.13, 272.13)
        page.drawImage(embeddedTemplate, {
          x: 0,
          y: 0,
          width: CARD_SIZE_PT,
          height: CARD_SIZE_PT,
        })

        // 2. White cover rectangle over placeholder QR area
        page.drawRectangle({
          x: boxXPt,
          y: boxYPt,
          width: boxWidthPt,
          height: boxHeightPt,
          color: rgb(1, 1, 1),
        })

        // 3. High-resolution PNG QR code (errorCorrectionLevel: 'H', margin: 1)
        const targetUrl = `${siteUrl}/r/${prod.product_code}`
        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 1024,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })

        const qrBase64 = qrDataUrl.split(',')[1]
        const qrBinary = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0))
        const embeddedQr = await pdfDoc.embedPng(qrBinary)

        page.drawImage(embeddedQr, {
          x: boxXPt,
          y: boxYPt,
          width: boxWidthPt,
          height: boxHeightPt,
        })

        // 4. Serial number (QR-0001) in 6pt Helvetica at bottom-right corner (x: 235pt, y: 10pt)
        page.drawText(prod.display_code, {
          x: 235,
          y: 10,
          size: 6,
          font: helveticaFont,
          color: rgb(0.15, 0.15, 0.16),
        })
      }

      setPdfProgress('PDF dosyası kaydediliyor...')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)

      const suffix = getFileRangeSuffix()
      const filename = `nfcpatch-print-${suffix}.pdf`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setFeedback({
        type: 'success',
        message: `${filteredProducts.length} kartlık baskı PDF dosyası (${filename}) indirildi.`,
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'PDF oluşturulurken hata oluştu.'
      setFeedback({
        type: 'error',
        message: msg,
      })
    } finally {
      setGeneratingPdf(false)
      setPdfProgress(null)
    }
  }

  function handleExportCsv() {
    if (filteredProducts.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Seçilen aralıkta dışa aktarılacak ürün bulunamadı.',
      })
      return
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://nfcpatch.link'
    ).replace(/\/$/, '')

    const header = 'product_code,display_code,redirect_url,nfc_type,status'
    const rows = filteredProducts.map((p) => {
      const redirectUrl = `${siteUrl}/r/${p.product_code}`
      return `${p.product_code},${p.display_code},${redirectUrl},${p.nfc_type},${p.status}`
    })

    const csvContent = [header, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const suffix = getFileRangeSuffix()
    const filename = `nfcpatch-inventory-${suffix}.csv`

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setFeedback({
      type: 'success',
      message: `${filteredProducts.length} kayıtlık CSV envanter dosyası (${filename}) indirildi.`,
    })
  }

  if (!isOpen && !standalone) return null

  const content = (
    <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Matbaa Baskı Çıktısı (PDF &amp; CSV)
            </h2>
            <p className="text-xs text-zinc-400">
              96mm × 96mm (`272.13pt × 272.13pt`) çok sayfalı vektörel/yüksek çözünürlüklü baskı motoru
            </p>
          </div>
        </div>
        {!standalone && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Range Selector & Calibration Sliders */}
        <div className="lg:col-span-6 space-y-5">
          {/* 1. Product Range Selector */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                1. Ürün Aralığı ve Filtre
              </h3>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {filteredProducts.length} Kart Seçili
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Başlangıç Kodu (Örn: 0001)
                </label>
                <input
                  type="text"
                  value={startCode}
                  onChange={(e) => setStartCode(e.target.value)}
                  placeholder="0001"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Bitiş Kodu (Örn: 0100)
                </label>
                <input
                  type="text"
                  value={endCode}
                  onChange={(e) => setEndCode(e.target.value)}
                  placeholder="0100"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Durum Filtresi
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as
                        | 'all'
                        | 'unassigned'
                        | 'active'
                        | 'disabled'
                    )
                  }
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Tümü (All)</option>
                  <option value="unassigned">Boşta (Unassigned)</option>
                  <option value="active">Aktif (Active)</option>
                  <option value="disabled">Pasif (Disabled)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  NFC Çip Tipi
                </label>
                <select
                  value={nfcTypeFilter}
                  onChange={(e) =>
                    setNfcTypeFilter(
                      e.target.value as 'all' | 'standard' | 'anti_metal'
                    )
                  }
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Tümü</option>
                  <option value="standard">Standart NTAG213</option>
                  <option value="anti_metal">Anti-Metal NTAG213</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Alignment Calibration Controls */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  2. QR &amp; Beyaz Kutu Kalibrasyonu (96mm × 96mm)
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetCalibration}
                  className="inline-flex items-center gap-1 text-[11px] bg-[#18181b] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Tam Hiza (22.8mm)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePreset32mm}
                  className="inline-flex items-center gap-1 text-[11px] bg-[#18181b] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span>32mm × 32mm</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Yatay Konum — X Offset</span>
                  <span className="font-mono text-emerald-400">
                    {xOffsetMm.toFixed(1)} mm ({(xOffsetMm * PT_PER_MM).toFixed(1)} pt)
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={55}
                  step={0.1}
                  value={xOffsetMm}
                  onChange={(e) => setXOffsetMm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Dikey Konum — Y Offset (Üstten)</span>
                  <span className="font-mono text-emerald-400">
                    {yOffsetMm.toFixed(1)} mm ({(yOffsetMm * PT_PER_MM).toFixed(1)} pt)
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={55}
                  step={0.1}
                  value={yOffsetMm}
                  onChange={(e) => setYOffsetMm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">QR &amp; Beyaz Kutu Boyutu</span>
                  <span className="font-mono text-emerald-400">
                    {qrBoxSizeMm.toFixed(1)} mm × {qrBoxSizeMm.toFixed(1)} mm (
                    {(qrBoxSizeMm * PT_PER_MM).toFixed(1)} pt)
                  </span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={45}
                  step={0.1}
                  value={qrBoxSizeMm}
                  onChange={(e) => setQrBoxSizeMm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 leading-relaxed bg-[#18181b] border border-[#27272a] rounded-lg p-2.5">
              Şablondaki örnek QR kodun üzerine tam beyaz örtü kutusu çizilir ve yeni üretilen yüksek hata toleranslı (`Level H`) QR kod bu beyaz alanın ortasına yerleştirilir. Sağ alt köşeye (`x: 235pt, y: 10pt`) `6pt Helvetica` seri numarası (`{previewProduct.display_code}`) basılır.
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-xs border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Export Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={generatingPdf || filteredProducts.length === 0}
              onClick={handleExportPdf}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold py-3 px-4 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="truncate">{pdfProgress || 'Üretiliyor...'}</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Baskı PDF İndir ({filteredProducts.length})</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={generatingPdf || filteredProducts.length === 0}
              onClick={handleExportCsv}
              className="flex items-center justify-center gap-2 bg-[#09090b] hover:bg-zinc-800 disabled:opacity-50 text-zinc-100 border border-[#27272a] font-medium py-3 px-4 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Envanter CSV İndir</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live HTML5 Canvas Preview */}
        <div className="lg:col-span-6 flex flex-col items-center justify-between bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-3">
          <div className="w-full flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">
              Canlı Kalibrasyon Önizlemesi ({previewProduct.display_code})
            </span>
            {filteredProducts.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={previewIndex <= 0}
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  className="px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-300 disabled:opacity-40 cursor-pointer"
                >
                  ‹ Önceki
                </button>
                <span className="text-zinc-500 font-mono">
                  {previewIndex + 1}/{filteredProducts.length}
                </span>
                <button
                  type="button"
                  disabled={previewIndex >= filteredProducts.length - 1}
                  onClick={() =>
                    setPreviewIndex((i) =>
                      Math.min(filteredProducts.length - 1, i + 1)
                    )
                  }
                  className="px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-300 disabled:opacity-40 cursor-pointer"
                >
                  Sonraki ›
                </button>
              </div>
            )}
          </div>

          <div className="relative w-full max-w-[380px] aspect-square rounded-xl overflow-hidden border border-[#27272a] bg-zinc-950 shadow-inner flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={CANVAS_PX}
              height={CANVAS_PX}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="w-full bg-[#18181b] border border-emerald-500/25 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">
                QR Kod İçeriği (Kalıcı Baskı URL):
              </span>
              <span className="text-emerald-400 font-semibold">
                96mm × 96mm (1:1)
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-300 break-all">
              https://nfcpatch.link/r/{previewProduct.product_code}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (standalone) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8 flex flex-col items-center justify-center">
        {content}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      {content}
    </div>
  )
}

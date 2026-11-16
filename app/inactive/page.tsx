import Link from 'next/link'
import { Wifi, QrCode, ShieldAlert } from 'lucide-react'

export default function InactivePage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-[#27272a] px-3 py-1 rounded-full">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>NFCPATCH</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-2">
            NFCPATCH — Bu ürün henüz aktive edilmedi.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Okuttuğunuz NFC / QR kartı sistemde kayıtlıdır ancak henüz bir işletmeye tanımlanmamıştır veya geçici olarak durdurulmuştur. İşletme sahibi tarafından aktivasyon tamamlandığında bu kart otomatik olarak ilgili değerlendirme sayfasına yönlendirecektir.
          </p>
        </div>

        <div className="pt-4 border-t border-[#27272a] flex items-center justify-between text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-zinc-400" />
            Akıllı Yönlendirme Altyapısı
          </span>
          <Link
            href="/login"
            className="text-zinc-400 hover:text-white transition-colors font-medium"
          >
            Yönetici Girişi →
          </Link>
        </div>
      </div>
    </main>
  )
}

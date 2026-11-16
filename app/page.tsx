import Link from 'next/link'
import { Wifi, QrCode, ShieldCheck, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between px-4 py-8 sm:px-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wifi className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            NFCPATCH
          </span>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#18181b] hover:bg-zinc-800 text-zinc-100 border border-[#27272a] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <span>Admin Girişi</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      <section className="max-w-2xl w-full mx-auto text-center space-y-6 my-auto py-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18181b] border border-[#27272a] text-xs font-medium text-zinc-400">
          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dinamik QR &amp; NTAG213 NFC Yönetim Sistemi</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          İşletmeler İçin Akıllı Google Yorum &amp; NFC Çözümü
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          NFCPATCH kartları saniyeler içinde işletmenizin Google Değerlendirme sayfasına bağlanır. Müşterileriniz telefonlarını yaklaştırarak veya QR kodu okutarak doğrudan yorum bırakabilir.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-500/10"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Girişi</span>
          </Link>
        </div>
      </section>

      <footer className="max-w-5xl w-full mx-auto border-t border-[#27272a] pt-6 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} NFCPATCH (`nfcpatch.link`)</span>
        <span>Dinamik QR &amp; NFC Yönlendirme Platformu</span>
      </footer>
    </main>
  )
}

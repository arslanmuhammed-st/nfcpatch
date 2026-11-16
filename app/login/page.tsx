'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Wifi, Lock, Mail, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid')
        ) {
          setErrorMsg('E-posta adresi veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.')
        } else {
          setErrorMsg(`Giriş yapılamadı: ${error.message}`)
        }
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setErrorMsg('Beklenmeyen bir bağlantı hatası oluştu. Lütfen tekrar deneyin.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ana Sayfa</span>
          </Link>
          <span className="text-xs text-zinc-500 font-mono">nfcpatch.link</span>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Wifi className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white pt-1">
              NFCPATCH Admin Panel
            </h1>
            <p className="text-xs text-zinc-400">
              Ürün envanteri ve saha aktivasyonu için yönetici hesabınızla giriş yapın.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3.5 py-3 rounded-xl text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-zinc-300"
              >
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nfcpatch.link"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-zinc-300"
              >
                Şifre
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 focus:outline-none rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <span>Giriş Yap</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

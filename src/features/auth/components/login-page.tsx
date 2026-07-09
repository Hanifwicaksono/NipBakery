import React, { useState } from 'react'
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAsGuest 
} from '@/firebase/config'
import { updateProfile } from 'firebase/auth'
import { 
  ChefHat, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Loader2, 
  AlertTriangle, 
  Globe 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  
  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  
  // UI states
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Clear errors when swapping tabs
  const handleTabSwap = (tab: 'login' | 'register') => {
    setActiveTab(tab)
    setErrorMsg(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
  }

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain tidak diotorisasi. Silakan hubungi admin atau daftarkan domain di Firebase Console.')
      } else {
        setErrorMsg('Gagal masuk dengan Google. Silakan coba lagi.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Email Sign-In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Email dan Password wajib diisi.')
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Email atau password salah.')
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Format email tidak valid.')
      } else {
        setErrorMsg('Gagal masuk. Silakan coba lagi nanti.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Email Sign-Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !displayName) {
      setErrorMsg('Semua kolom wajib diisi.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('Password minimal terdiri dari 6 karakter.')
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName })
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Email sudah terdaftar. Silakan gunakan email lain atau masuk.')
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Format email tidak valid.')
      } else {
        setErrorMsg('Gagal mendaftar akun. Silakan coba lagi.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Guest mode (Anonymous Sign-In)
  const handleGuestSignIn = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      await signInAsGuest()
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Gagal masuk sebagai tamu. Silakan coba metode lain.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center font-sans px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center items-center bg-[#111827] text-white p-3.5 rounded-2xl shadow-sm mb-2">
            <ChefHat className="h-9 w-9 animate-pulse" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Hanip Bakery</h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Cost Calculator & Sync</p>
        </div>

        {/* Auth Card */}
        <Card className="border-[#E5E7EB] bg-white rounded-2xl shadow-md overflow-hidden">
          <CardHeader className="border-b border-[#E5E7EB] bg-gray-50/50 px-6 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                {activeTab === 'login' ? 'Masuk ke Aplikasi' : 'Buat Akun Baru'}
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                {activeTab === 'login' 
                  ? 'Gunakan akun Anda untuk mensinkronisasi data resep.' 
                  : 'Daftarkan email Anda untuk mulai menyimpan resep di cloud.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            
            {/* Error Message */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs animate-fade-in">
                <AlertTriangle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full h-10 border-[#E5E7EB] hover:border-gray-900 rounded-xl font-bold flex items-center justify-center gap-2.5 text-gray-700 bg-white transition-all cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.355 0 3.34 2.655 1.34 6.536l3.926 3.23Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.275c0-.825-.075-1.62-.21-2.385H12v4.51h6.44c-.28 1.455-1.1 2.69-2.33 3.515l3.635 2.815c2.13-1.965 3.745-4.86 3.745-8.455Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.266 14.235 1.34 17.464c2-3.88 6.015-6.535 10.66-6.535 3.055 0 5.782 1.145 7.91 3L16.418 17.5A7.086 7.086 0 0 1 5.266 14.235Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.245 0 5.97-1.075 7.96-2.925l-3.635-2.815c-1.025.685-2.335 1.1-3.955 1.1-4.645 0-8.66-2.655-10.66-6.536L1.34 17.465C3.34 21.345 7.355 24 12 24Z"
                  />
                </svg>
              )}
              <span>Masuk dengan Google</span>
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <hr className="flex-1 border-[#E5E7EB]" />
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">atau email</span>
              <hr className="flex-1 border-[#E5E7EB]" />
            </div>

            {/* Form */}
            <form onSubmit={activeTab === 'login' ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
              
              {activeTab === 'register' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Nama Pengguna *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Contoh: Hanif Wicaksono"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-9 h-9 border-[#E5E7EB] rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-9 border-[#E5E7EB] rounded-lg"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-9 border-[#E5E7EB] rounded-lg"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {activeTab === 'register' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Konfirmasi Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 h-9 border-[#E5E7EB] rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-[#111827] text-white hover:bg-gray-800 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>{activeTab === 'login' ? 'Masuk Sekarang' : 'Daftar Akun'}</span>
                )}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

          </CardContent>

          {/* Switch tab Footer */}
          <CardFooter className="border-t border-[#E5E7EB] bg-gray-50/50 p-4 flex items-center justify-center text-xs text-gray-500 gap-1.5">
            {activeTab === 'login' ? (
              <>
                <span>Belum punya akun?</span>
                <button
                  type="button"
                  onClick={() => handleTabSwap('register')}
                  className="font-bold text-[#111827] hover:underline cursor-pointer"
                >
                  Daftar
                </button>
              </>
            ) : (
              <>
                <span>Sudah punya akun?</span>
                <button
                  type="button"
                  onClick={() => handleTabSwap('login')}
                  className="font-bold text-[#111827] hover:underline cursor-pointer"
                >
                  Masuk
                </button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Info Migrasi & Mode Tamu Box */}
        <div className="space-y-4">
          
          {/* Mode Tamu Card */}
          <Card className="border-[#E5E7EB] bg-white rounded-2xl shadow-sm overflow-hidden text-center p-4">
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Hanya ingin mencoba? Mulai tanpa akun (data disimpan di browser ini saja).
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleGuestSignIn}
              className="w-full h-9 border-[#E5E7EB] hover:border-gray-500 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-gray-600 bg-white transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Gunakan Mode Tamu (Tanpa Akun)</span>
            </Button>
          </Card>

          {/* Alert Warning migration */}
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex gap-3 text-xs">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              <h4 className="font-bold text-amber-950">💡 Tips untuk Pengguna Lama</h4>
              <p>
                Jika sebelumnya Anda sudah memiliki resep di perangkat ini:
              </p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>
                  Masuk via <strong>Mode Tamu</strong> dulu.
                </li>
                <li>
                  Buka menu <strong>Pengaturan & Backup</strong>, lalu klik <strong>Ekspor Berkas Backup</strong>.
                </li>
                <li>
                  Logout, lalu masuk kembali dengan akun Google/Email Anda.
                </li>
                <li>
                  Masuk menu Pengaturan lagi, dan <strong>Unggah Berkas Backup</strong> tersebut sekali saja.
                </li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
export default LoginPage

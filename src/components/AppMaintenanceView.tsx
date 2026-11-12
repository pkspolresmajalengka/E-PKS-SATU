import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  Lock,
  Clock,
  Phone,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { AppStatusConfig } from '../lib/firebase';
import { AppUser } from '../App';

interface AppMaintenanceViewProps {
  appStatus: AppStatusConfig;
  appLogo: string | null;
  usersList: AppUser[];
  onAdminLoginSuccess: (adminUser: AppUser) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AppMaintenanceView: React.FC<AppMaintenanceViewProps> = ({
  appStatus,
  appLogo,
  usersList,
  onAdminLoginSuccess,
  showToast
}) => {
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAdminLoggingIn(true);

    const uname = adminUsername.trim().toLowerCase();
    const pwd = adminPassword.trim();

    setTimeout(() => {
      const userFound = usersList.find(
        u => u.username.toLowerCase() === uname && u.password === pwd
      );

      if (!userFound) {
        setIsAdminLoggingIn(false);
        setLoginError('Username atau password tidak cocok!');
        return;
      }

      const isSuperAdmin =
        userFound.role === 'superadmin' ||
        (userFound.role === 'admin' &&
          (userFound.username.toLowerCase() === 'admin' ||
            userFound.username.toLowerCase() === 'administrator'));

      if (!isSuperAdmin) {
        setIsAdminLoggingIn(false);
        setLoginError('Akses ditolak: Akun Anda memiliki hak akses terbatas. Saat aplikasi dinonaktifkan, hanya Administrator Utama yang memiliki wewenang membuka sistem.');
        return;
      }

      showToast(`Login Administrator Utama "${userFound.name}" berhasil! Membuka akses kontrol.`, 'success');
      setIsAdminLoggingIn(false);
      onAdminLoginSuccess(userFound);
      setShowAdminLoginModal(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar Header */}
      <header className="flex items-center justify-between z-10 max-w-5xl mx-auto w-full pt-2">
        <div className="flex items-center gap-3">
          {appLogo ? (
            <img
              src={appLogo}
              alt="Logo Resmi"
              className="w-10 h-10 object-contain rounded-xl p-0.5 bg-white shadow-lg shrink-0"
            />
          ) : (
            <div className="bg-rose-600 p-2.5 rounded-xl text-white shadow-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-black text-sm sm:text-base tracking-tight leading-none text-white">
              E-REKAP LOMBA PBB & PKS 2026
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold tracking-wider mt-0.5">
              KORPS PATROLI KEAMANAN SEKOLAH
            </p>
          </div>
        </div>

        {/* Admin Login Button */}
        <button
          type="button"
          onClick={() => {
            setLoginError('');
            setShowAdminLoginModal(true);
          }}
          className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-xs cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Login Administrator</span>
        </button>
      </header>

      {/* Center Hero Card */}
      <main className="z-10 max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Top Rose Strip Accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold tracking-wide shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>STATUS OPERASIONAL: DINONAKTIFKAN SEMENTARA</span>
            </div>
          </div>

          {/* Icon Hero */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/10 border border-rose-500/25 rounded-3xl mx-auto flex items-center justify-center mb-5 text-rose-400 shadow-inner">
            <ShieldAlert className="w-9 h-9 sm:w-11 sm:h-11" />
          </div>

          {/* Custom Title */}
          <h2 className="text-xl sm:text-2xl font-black text-center text-white leading-snug">
            {appStatus.title || 'Aplikasi Sedang Dinonaktifkan Sementara'}
          </h2>

          {/* Custom Message Body */}
          <div className="mt-4 text-xs sm:text-sm text-slate-300 text-center leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80">
            {appStatus.message ||
              'Sistem E-Rekapitulasi Lomba PBB & PKS sedang ditutup sementara oleh Panitia Pelaksana. Harap hubungi administrator untuk informasi lebih lanjut.'}
          </div>

          {/* Extra Details: Estimasi & Kontak */}
          {(appStatus.estimateTime || appStatus.contactInfo) && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {appStatus.estimateTime && (
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Estimasi Dibuka Kembali
                    </span>
                    <span className="text-slate-200 font-semibold text-xs mt-0.5 block">
                      {appStatus.estimateTime}
                    </span>
                  </div>
                </div>
              )}

              {appStatus.contactInfo && (
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Narahubung Panitia
                    </span>
                    <span className="text-slate-200 font-semibold text-xs mt-0.5 block">
                      {appStatus.contactInfo}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Auto-Sync Notice */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>Halaman ini akan otomatis beralih saat aplikasi diaktifkan kembali.</span>
          </div>

          {/* Quick Admin Access Button */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                setLoginError('');
                setShowAdminLoginModal(true);
              }}
              className="text-xs text-slate-400 hover:text-white transition inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Apakah Anda Administrator? Masuk untuk mengaktifkan aplikasi</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 text-center text-xs text-slate-400 py-3">
        <p>© 2026 E-Rekapitulasi Perlombaan Patroli Keamanan Sekolah & Polisi Pelajar</p>
      </footer>

      {/* MODAL: KHUSUS LOGIN ADMINISTRATOR */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-950 px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Login Khusus Administrator</h3>
                  <p className="text-[11px] text-slate-400">Akses kontrol pemeliharaan dan aktivasi aplikasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleAdminLogin} className="p-5 space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Username Administrator
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    autoFocus
                    disabled={isAdminLoggingIn}
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    placeholder="Username admin..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isAdminLoggingIn}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Password admin..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={isAdminLoggingIn}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white disabled:opacity-60"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isAdminLoggingIn}
                  onClick={() => setShowAdminLoginModal(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdminLoggingIn}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-75 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  {isAdminLoggingIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Masuk Administrator</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

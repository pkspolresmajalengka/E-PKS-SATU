import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Laptop,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  X,
  Share,
  MoreVertical,
  ExternalLink,
  HardDriveDownload,
  CloudUpload
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isEmbeddedFrame: boolean;
  offlineReady: boolean;
  onTriggerNativeInstall: () => Promise<void>;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isIOS,
  isAndroid,
  isEmbeddedFrame,
  offlineReady,
  onTriggerNativeInstall
}) => {
  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-slate-800">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Ikon E-PKS SATU"
              className="w-11 h-11 rounded-xl border border-blue-400/40 shadow shrink-0 bg-slate-800 object-cover"
            />
            <div className="min-w-0">
              <h3 id="pwa-install-modal-title" className="font-black text-sm sm:text-base text-white truncate">
                Download Aplikasi E-PKS SATU
              </h3>
              <p className="text-[11px] text-blue-300 font-medium truncate">
                Akses Cepat Online & Offline · Polres Majalengka
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan download"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status Kesiapan Offline */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              offlineReady
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            {offlineReady ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <HardDriveDownload className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                {offlineReady
                  ? 'Paket Aset Offline Telah Tersimpan di Perangkat'
                  : 'Menyiapkan Penyimpanan Cache Offline...'}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                Setelah terpasang, aplikasi dapat dibuka tanpa kuota internet. Input nilai & data lokal otomatis tersinkron ke Cloud saat internet kembali aktif.
              </p>
            </div>
          </div>

          {isInstallable ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Perangkat Anda mendukung pemasangan aplikasi langsung. Klik tombol di bawah untuk mengunduh pintasan E-PKS SATU ke layar utama / desktop:
              </p>
              <button
                type="button"
                onClick={onTriggerNativeInstall}
                className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download & Pasang Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {isEmbeddedFrame && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-2">
                  <div className="font-bold">Terbuka di Jendela Pratinjau</div>
                  <p className="text-[11px] leading-relaxed">
                    Browser hanya memunculkan tombol pasang otomatis saat tautan dibuka langsung di tab utama browser.
                  </p>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka di Tab Browser Baru</span>
                  </a>
                </div>
              )}

              {isIOS ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Cara Pasang di iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 list-decimal list-inside text-[11px] leading-relaxed">
                    <li>
                      Ketuk tombol <strong className="inline-flex items-center gap-1">Bagikan <Share className="w-3 h-3 inline text-blue-600" /></strong> di bilah bawah/atas Safari.
                    </li>
                    <li>
                      Gulir daftar menu ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      Konfirmasi nama <strong>E-PKS SATU</strong> lalu ketuk <strong>Tambah</strong>.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Cara Pasang di HP Android (Chrome / Edge)</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 list-decimal list-inside text-[11px] leading-relaxed">
                    <li>
                      Ketuk ikon menu <strong className="inline-flex items-center gap-0.5">titik tiga <MoreVertical className="w-3 h-3 inline text-slate-700" /></strong> di pojok kanan atas Chrome.
                    </li>
                    <li>
                      Pilih <strong>Instal aplikasi (Install app)</strong> atau <strong>Tambahkan ke layar utama</strong>.
                    </li>
                    <li>
                      Ketuk <strong>Instal</strong> dan aplikasi akan muncul di layar utama HP Anda.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Cara Pasang di Laptop / Desktop (Chrome / Edge)</span>
                  </div>
                  <ol className="space-y-1.5 text-slate-700 list-decimal list-inside text-[11px] leading-relaxed">
                    <li>
                      Klik ikon <strong>Install / Layar dengan tanda panah</strong> di ujung kanan bilah alamat URL browser, atau buka menu browser (⋮).
                    </li>
                    <li>
                      Pilih <strong>Install E-PKS SATU Polres Majalengka</strong>.
                    </li>
                    <li>
                      Aplikasi akan terpasang sebagai jendela mandiri yang dapat dibuka kapan saja (online/offline).
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  variant: 'login' | 'header' | 'sidebar';
  sidebarCollapsed?: boolean;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant,
  sidebarCollapsed = false,
  onNotify
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isEmbeddedFrame,
    offlineReady,
    install
  } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  // Sembunyikan otomatis bila aplikasi sudah berjalan dalam mode terpasang (standalone)
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        onNotify?.('Aplikasi E-PKS SATU berhasil dipasang di perangkat Anda!', 'success');
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }
    }
    setGuideOpen(true);
  };

  const handleNativeInstallFromModal = async () => {
    const outcome = await install();
    if (outcome === 'accepted') {
      setGuideOpen(false);
      onNotify?.('Aplikasi E-PKS SATU berhasil dipasang di perangkat Anda!', 'success');
    }
  };

  return (
    <>
      {variant === 'login' && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Download Aplikasi (Akses Offline & Online)</span>
        </button>
      )}

      {variant === 'header' && (
        <button
          type="button"
          onClick={handleClick}
          title="Download & Pasang Aplikasi untuk Akses Offline / Online"
          className="min-h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">Download App</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleClick}
          title="Download Aplikasi (Akses Offline & Online)"
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-bold bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-200 hover:text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 text-blue-400 shrink-0" />
            {!sidebarCollapsed && (
              <div className="text-left min-w-0 truncate">
                <span className="block font-bold text-white text-xs truncate">Download Aplikasi</span>
                <span className="block text-[10px] text-blue-300 font-normal truncate">
                  Pasang untuk Offline / Online
                </span>
              </div>
            )}
          </div>
        </button>
      )}

      <PWAInstallGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isEmbeddedFrame={isEmbeddedFrame}
        offlineReady={offlineReady}
        onTriggerNativeInstall={handleNativeInstallFromModal}
      />
    </>
  );
};

interface OfflineConnectivityBarProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export const OfflineConnectivityBar: React.FC<OfflineConnectivityBarProps> = ({
  isOnline,
  pendingCount,
  isSyncing,
  onSyncNow
}) => {
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 no-print rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
        !isOnline
          ? 'bg-amber-50 border-amber-300 text-amber-950'
          : 'bg-blue-50 border-blue-300 text-blue-950'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {!isOnline ? (
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="w-4 h-4 text-blue-700 animate-spin shrink-0" />
        ) : (
          <CloudUpload className="w-4 h-4 text-blue-700 shrink-0" />
        )}
        <div className="min-w-0">
          <span className="font-bold">
            {!isOnline
              ? 'Mode Offline Aktif'
              : isSyncing
              ? 'Menyinkronkan Perubahan Lokal ke Cloud...'
              : 'Menunggu Sinkronisasi ke Cloud'}
          </span>
          <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
          <span className="opacity-90">
            {!isOnline
              ? pendingCount > 0
                ? `${pendingCount} perubahan tersimpan aman di perangkat dan akan otomatis dikirim saat online.`
                : 'Anda tetap dapat melihat data tersimpan dan menginput nilai secara lokal.'
              : `${pendingCount} perubahan lokal siap disinkronkan ke server Cloud.`}
          </span>
        </div>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={onSyncNow}
          disabled={isSyncing}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
        </button>
      )}
    </div>
  );
};

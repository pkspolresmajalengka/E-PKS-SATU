import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Smartphone,
  Laptop,
  HardDrive,
  Server,
  DownloadCloud
} from 'lucide-react';
import { formatCountdownMs } from '../lib/autoBackupManager';
import {
  CloudConnectionStatus,
  FIREBASE_PRICING_URL,
  FIRESTORE_UPGRADE_CONSOLE_URL
} from '../lib/firebase';
import type { ServerBackupStatus } from '../lib/serverBackupClient';

export interface DeltaSyncActionResult {
  status: 'synced' | 'already_clean' | 'quota_paused' | 'offline' | 'error';
  flushedCount: number;
  remainingCount: number;
  serverBackedUpCount: number;
  message: string;
}

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudStatus: CloudConnectionStatus;
  cloudQuotaExceeded?: boolean;
  pendingOfflineCount?: number;
  serverBackedUpQueueCount?: number;
  serverBackupStatus?: ServerBackupStatus;
  lastSynced: Date | null;
  pesertaCount: number;
  usersCount: number;
  autoSaveEnabled?: boolean;
  autoBackupEnabled?: boolean;
  nextBackupAt?: number | null;
  onOpenAutoBackup?: () => void;
  onForceSyncAll: () => Promise<DeltaSyncActionResult>;
  onPullFromServerBackup?: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  cloudStatus,
  cloudQuotaExceeded = false,
  pendingOfflineCount = 0,
  serverBackedUpQueueCount = 0,
  serverBackupStatus,
  lastSynced,
  pesertaCount,
  usersCount,
  autoSaveEnabled = true,
  autoBackupEnabled = true,
  nextBackupAt = null,
  onOpenAutoBackup,
  onForceSyncAll,
  onPullFromServerBackup,
  showToast
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPullingServer, setIsPullingServer] = useState(false);

  if (!isOpen) return null;

  const isQuotaPaused = cloudQuotaExceeded || cloudStatus === 'quota_paused';

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await onForceSyncAll();
      if (result.status === 'synced') {
        showToast(result.message, 'success');
      } else if (result.status === 'already_clean' || result.status === 'quota_paused' || result.status === 'offline') {
        showToast(result.message, 'info');
      } else {
        showToast(result.message, 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Sinkronisasi delta tertunda. Perubahan tetap aman di lokal & server.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullServerBackup = async () => {
    if (!onPullFromServerBackup) return;
    setIsPullingServer(true);
    try {
      await onPullFromServerBackup();
    } finally {
      setIsPullingServer(false);
    }
  };

  const formatServerTime = (iso: string | null | undefined) => {
    if (!iso) return 'Belum ada delta';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return 'Aktif';
    return dt.toLocaleString('id-ID');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shadow-xs shrink-0 ${
                isQuotaPaused
                  ? 'bg-amber-600'
                  : cloudStatus === 'connected'
                  ? 'bg-emerald-600'
                  : cloudStatus === 'connecting'
                  ? 'bg-amber-600'
                  : cloudStatus === 'offline'
                  ? 'bg-slate-600'
                  : 'bg-rose-600'
              }`}
            >
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2 truncate">
                <span>Penyimpanan Cloud & Cadangan Server</span>
              </h3>
              <p className="text-xs text-blue-300 truncate">
                Delta Sync Hemat Kuota · Firebase Firestore + Server Express
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup status penyimpanan Cloud"
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Connection Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isQuotaPaused
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : cloudStatus === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : cloudStatus === 'connecting'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : cloudStatus === 'offline'
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {isQuotaPaused ? (
              <Server className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            ) : cloudStatus === 'connected' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : cloudStatus === 'connecting' ? (
              <RefreshCw className="w-6 h-6 text-amber-600 animate-spin shrink-0 mt-0.5" />
            ) : cloudStatus === 'offline' ? (
              <AlertCircle className="w-6 h-6 text-slate-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <h4 className="font-bold text-sm">
                {isQuotaPaused
                  ? 'Mode Hemat Kuota · Cadangan Server Aktif'
                  : cloudStatus === 'connected'
                  ? 'Cloud Database Aktif & Terhubung'
                  : cloudStatus === 'connecting'
                  ? 'Memeriksa Koneksi Cloud...'
                  : cloudStatus === 'offline'
                  ? 'Mode Offline · Tersimpan Lokal'
                  : 'Sinkronisasi Cloud Perlu Perhatian'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                {isQuotaPaused
                  ? serverBackupStatus?.available
                    ? 'Kuota tulis harian Cloud Firestore telah penuh dan akan direset otomatis besok. Seluruh perubahan tetap diamankan di Cadangan Server & penyimpanan lokal.'
                    : 'Kuota tulis harian Cloud Firestore telah penuh dan akan direset otomatis besok. Perubahan tetap aman disimpan secara lokal di perangkat ini.'
                  : cloudStatus === 'connected'
                  ? 'Mode Delta Sync aktif: hanya data yang berubah saja yang dikirim ke Cloud Firestore sekaligus dicadangkan ke server.'
                  : cloudStatus === 'offline'
                  ? 'Tidak ada koneksi internet. Perubahan tetap disimpan lokal di perangkat dan otomatis disinkronkan saat online.'
                  : 'Sebagian permintaan Cloud ditolak atau melebihi batas dokumen 1 MB. Perubahan tetap dicadangkan secara lokal dan di server.'}
              </p>
              {isQuotaPaused && (
                <div className="text-[11px] mt-1.5 font-semibold text-amber-900 space-y-1">
                  <div>
                    Info kuota (kolom Spark / Enterprise edition):{' '}
                    <a
                      href={FIREBASE_PRICING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-700"
                    >
                      {FIREBASE_PRICING_URL}
                    </a>
                  </div>
                  <div>
                    Kelola / upgrade database Firestore:{' '}
                    <a
                      href={FIRESTORE_UPGRADE_CONSOLE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-700"
                    >
                      Buka Firebase Console
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cloud & Server Backup Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Data Peserta & Nilai
              </span>
              <span className="text-base font-black text-slate-800 tabular-nums">
                {pesertaCount} Kontingen
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                {usersCount} Akun Pengguna
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Cadangan Server Express
              </span>
              <span
                className={`text-base font-black tabular-nums ${
                  serverBackupStatus?.available ? 'text-emerald-700' : 'text-slate-700'
                }`}
              >
                {serverBackupStatus?.available ? 'Aktif & Siap' : 'Lokal Saja'}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                {serverBackupStatus?.available
                  ? `${serverBackupStatus.counts.participants} kontingen · ${serverBackupStatus.totalDeltaApplied} delta`
                  : 'Menunggu koneksi server'}
              </p>
            </div>
          </div>

          {/* Delta Sync Highlight */}
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <div className="flex -space-x-1">
                <Laptop className="w-4 h-4 text-blue-700" />
                <Smartphone className="w-4 h-4 text-indigo-700" />
              </div>
              <span>Delta Sync Hemat Kuota & Multi-Perangkat</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Aplikasi tidak melakukan penulisan ulang otomatis saat dibuka. Tombol <strong>Sinkronkan Ulang Sekarang</strong> hanya mengirimkan perubahan yang benar-benar tertunda agar kuota harian tetap aman.
            </p>
          </div>

          {/* Sync Time, Auto-Save, Server Backup & Delta Queue Details */}
          <div className="space-y-1.5 px-1 border-t border-slate-100 pt-3">
            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>Antrean Delta ke Cloud:</span>
              <span
                className={`font-bold tabular-nums text-right ${
                  pendingOfflineCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {pendingOfflineCount > 0
                  ? `${pendingOfflineCount} perubahan tertunda${
                      serverBackedUpQueueCount > 0
                        ? ` (${serverBackedUpQueueCount} aman di server)`
                        : ''
                    }`
                  : '0 tertunda · Semua tersinkron'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>Cadangan Server Terakhir:</span>
              <span className="font-semibold text-slate-700 tabular-nums text-right">
                {serverBackupStatus?.available
                  ? formatServerTime(serverBackupStatus.updatedAt)
                  : 'Tidak terjangkau'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>Auto-Save & Cadangan 1 Jam:</span>
              <span className="font-bold tabular-nums text-slate-700 text-right">
                {autoSaveEnabled ? 'Auto-Save Aktif' : 'Auto-Save Nonaktif'}
                {' · '}
                {autoBackupEnabled
                  ? nextBackupAt
                    ? `Berikutnya ${formatCountdownMs(Math.max(0, nextBackupAt - Date.now()))}`
                    : 'Jadwal 1 Jam Aktif'
                  : 'Cadangan Dijeda'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>Sinkron Cloud Terakhir:</span>
              <span className="font-semibold text-slate-700 tabular-nums text-right">
                {lastSynced ? lastSynced.toLocaleString('id-ID') : 'Mode Baca / Cache'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncing || isPullingServer}
              onClick={handleManualSync}
              className="min-h-[40px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Menyinkronkan Delta...'
                  : pendingOfflineCount > 0
                  ? `Sinkronkan Ulang Sekarang (${pendingOfflineCount} Delta)`
                  : 'Sinkronkan Ulang Sekarang'}
              </span>
            </button>

            {onPullFromServerBackup && serverBackupStatus?.available && (
              <button
                type="button"
                disabled={isSyncing || isPullingServer}
                onClick={() => void handlePullServerBackup()}
                title="Ambil data cadangan terbaru dari Server Express ke perangkat ini"
                className="min-h-[40px] px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <DownloadCloud className={`w-3.5 h-3.5 text-blue-600 ${isPullingServer ? 'animate-pulse' : ''}`} />
                <span>{isPullingServer ? 'Memuat...' : 'Muat Cadangan Server'}</span>
              </button>
            )}

            {onOpenAutoBackup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAutoBackup();
                }}
                className="min-h-[40px] px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Cadangan 1 Jam</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

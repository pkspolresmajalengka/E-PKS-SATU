import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Database,
  Smartphone,
  Laptop,
  Users,
  ShieldCheck,
  Check
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudStatus: 'connecting' | 'connected' | 'offline' | 'error';
  lastSynced: Date | null;
  pesertaCount: number;
  usersCount: number;
  onForceSyncAll: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  cloudStatus,
  lastSynced,
  pesertaCount,
  usersCount,
  onForceSyncAll,
  showToast
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onForceSyncAll();
      showToast('Seluruh data berhasil disinkronkan ke Cloud Firestore!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Gagal melakukan sinkronisasi cloud.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-xs ${
              cloudStatus === 'connected' ? 'bg-emerald-600' : cloudStatus === 'connecting' ? 'bg-amber-600' : 'bg-rose-600'
            }`}>
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>Penyimpanan Cloud & Multi-Perangkat</span>
              </h3>
              <p className="text-xs text-blue-300">
                Firebase Firestore Real-Time Cloud Database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Connection Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            cloudStatus === 'connected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : cloudStatus === 'connecting'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {cloudStatus === 'connected' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : cloudStatus === 'connecting' ? (
              <RefreshCw className="w-6 h-6 text-amber-600 animate-spin shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            )}
            <div>
              <h4 className="font-bold text-sm">
                {cloudStatus === 'connected'
                  ? 'Cloud Database Aktif & Terhubung'
                  : cloudStatus === 'connecting'
                  ? 'Sedang Menghubungkan ke Cloud...'
                  : 'Mode Offline / Terputus'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90">
                {cloudStatus === 'connected'
                  ? 'Semua perubahan data tersimpan ke Google Cloud secara otomatis dan tersinkronisasi seketika.'
                  : 'Sistem tetap menyimpan data secara lokal dan akan menyinkronkannya saat online.'}
              </p>
            </div>
          </div>

          {/* Cloud Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Data Peserta & Nilai
              </span>
              <span className="text-base font-black text-slate-800">
                {pesertaCount} Kontingen
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">Tersinkron di Cloud</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Akun Pengguna
              </span>
              <span className="text-base font-black text-slate-800">
                {usersCount} Akun
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">Admin, Juri & Sekolah</p>
            </div>
          </div>

          {/* Multi-Device Feature Highlight */}
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <div className="flex -space-x-1">
                <Laptop className="w-4 h-4 text-blue-700" />
                <Smartphone className="w-4 h-4 text-indigo-700" />
              </div>
              <span>Akses Multi-Perangkat di Mana Saja</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Anda dan seluruh panitia, dewan juri, serta sekolah dapat membuka tautan aplikasi ini di laptop, tablet, atau smartphone masing-masing secara bersamaan:
            </p>
            <ul className="text-[11px] text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Juri Lapangan</strong>: Dapat menginput nilai langsung dari HP/Tablet di lapangan lomba.</li>
              <li><strong>Operator Rekapitulasi</strong>: Melihat perubahan nilai secara live tanpa perlu reload halaman.</li>
              <li><strong>Perwakilan Sekolah</strong>: Dapat mendaftar dan melihat data peserta mereka secara mandiri.</li>
            </ul>
          </div>

          {/* Sync Time Details */}
          <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
            <span>Waktu Sinkronisasi Terakhir:</span>
            <span className="font-semibold text-slate-700">
              {lastSynced ? lastSynced.toLocaleString('id-ID') : 'Baru saja'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Ulang Sekarang'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

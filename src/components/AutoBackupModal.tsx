import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Clock,
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  Database
} from 'lucide-react';
import {
  AutoBackupSettings,
  AutoBackupSnapshot,
  formatBytesCompact,
  formatCountdownMs,
  downloadBackupPayloadAsJson
} from '../lib/autoBackupManager';

interface AutoBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AutoBackupSettings;
  snapshots: AutoBackupSnapshot[];
  isSuperAdmin: boolean;
  isCreatingBackup: boolean;
  isRestoringBackup: boolean;
  onToggleAutoSave: (enabled: boolean) => void;
  onToggleAutoBackup: (enabled: boolean) => void;
  onTriggerManualBackup: () => Promise<void>;
  onDownloadCurrentBackup: () => void;
  onRestoreSnapshot: (snapshot: AutoBackupSnapshot) => void;
  onDeleteSnapshot: (id: string) => Promise<void>;
  onClearAllSnapshots: () => void;
}

export const AutoBackupModal: React.FC<AutoBackupModalProps> = ({
  isOpen,
  onClose,
  settings,
  snapshots,
  isSuperAdmin,
  isCreatingBackup,
  isRestoringBackup,
  onToggleAutoSave,
  onToggleAutoBackup,
  onTriggerManualBackup,
  onDownloadCurrentBackup,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClearAllSnapshots
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const remainingMs =
    settings.autoBackupEnabled && settings.nextBackupAt
      ? Math.max(0, settings.nextBackupAt - nowMs)
      : 0;

  const formatTimestamp = (ms: number | null) => {
    if (!ms) return 'Belum pernah';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(ms));
  };

  const handleDeleteRow = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteSnapshot(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-backup-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] text-slate-800">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="auto-backup-modal-title" className="font-black text-sm sm:text-base text-white truncate">
                Auto-Save & Cadangan Otomatis (Setiap 1 Jam)
              </h3>
              <p className="text-xs text-blue-300 truncate">
                Penyimpanan otomatis perubahan real-time & arsip snapshot berkala 60 menit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela auto-save dan cadangan"
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Status & Controls Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-Save Status */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Save className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Auto-Save Lokal & Draft</div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Menyimpan nilai juri, peserta, dan draft formulir otomatis saat mengetik maupun sebelum tab ditutup.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.autoSaveEnabled}
                  onClick={() => onToggleAutoSave(!settings.autoSaveEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    settings.autoSaveEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      settings.autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Terakhir tersimpan:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {formatTimestamp(settings.lastAutoSaveAt)}
                </span>
              </div>
            </div>

            {/* Hourly Auto-Backup Status */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Cadangan Setiap 1 Jam</div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Membuat snapshot seluruh basis data tiap 60 menit ke penyimpanan perangkat (hingga 48 riwayat).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.autoBackupEnabled}
                  onClick={() => onToggleAutoBackup(!settings.autoBackupEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    settings.autoBackupEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      settings.autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2.5 border-t border-slate-200 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cadangan berikutnya:</span>
                  <span className="font-mono tabular-nums font-bold text-blue-700">
                    {settings.autoBackupEnabled
                      ? settings.nextBackupAt
                        ? formatCountdownMs(remainingMs)
                        : 'Menunggu...'
                      : 'Dijeda'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cadangan terakhir:</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {formatTimestamp(settings.lastBackupAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cadangan otomatis aman di penyimpanan lokal tanpa membebani kuota tulis harian Cloud.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isCreatingBackup || isRestoringBackup}
                onClick={() => void onTriggerManualBackup()}
                className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              >
                {isCreatingBackup ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>{isCreatingBackup ? 'Mencadangkan...' : 'Cadangkan Sekarang'}</span>
              </button>
              <button
                type="button"
                onClick={onDownloadCurrentBackup}
                className="min-h-[40px] px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Unduh JSON Saat Ini</span>
              </button>
            </div>
          </div>

          {/* Snapshot History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Riwayat Snapshot Cadangan
                </h4>
                <p className="text-xs text-slate-500">
                  <span className="tabular-nums font-semibold text-slate-700">{snapshots.length}</span> tersimpan · Maksimal 48 snapshot terbaru
                </p>
              </div>
              {snapshots.length > 0 && isSuperAdmin && (
                <button
                  type="button"
                  disabled={isRestoringBackup}
                  onClick={onClearAllSnapshots}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  Hapus Semua Riwayat
                </button>
              )}
            </div>

            {snapshots.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3 bg-slate-50/50">
                <HardDrive className="w-8 h-8 text-slate-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Belum Ada Riwayat Snapshot</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Sistem akan otomatis membuat cadangan pertama dan mengulanginya setiap 1 jam, atau Anda dapat menekan tombol di bawah sekarang.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCreatingBackup}
                  onClick={() => void onTriggerManualBackup()}
                  className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Database className="w-4 h-4" />
                  <span>Buat Cadangan Pertama</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden bg-white">
                {snapshots.map(snap => (
                  <div
                    key={snap.id}
                    className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {formatTimestamp(snap.createdAtMs)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span
                          className={`font-semibold ${
                            snap.trigger === 'hourly' ? 'text-blue-700' : 'text-emerald-700'
                          }`}
                        >
                          {snap.trigger === 'hourly' ? 'Otomatis 1 Jam' : 'Manual'}
                        </span>
                        {snap.createdBy && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-500 truncate max-w-[160px]">{snap.createdBy}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                        <span>{snap.summary.pesertaCount} Peserta</span>
                        <span aria-hidden="true">·</span>
                        <span>{snap.summary.registrationsCount} Pendaftaran</span>
                        <span aria-hidden="true">·</span>
                        <span>{snap.summary.usersCount} Akun</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{formatBytesCompact(snap.sizeBytes)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          downloadBackupPayloadAsJson(
                            snap.payload,
                            snap.trigger === 'hourly'
                              ? 'Cadangan_Otomatis_1Jam_PKS'
                              : 'Cadangan_Manual_PKS'
                          )
                        }
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Unduh</span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={isRestoringBackup}
                          onClick={() => onRestoreSnapshot(snap)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {isRestoringBackup ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Pulihkan</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={deletingId === snap.id || isRestoringBackup}
                        onClick={() => void handleDeleteRow(snap.id)}
                        title="Hapus snapshot ini"
                        aria-label="Hapus snapshot ini"
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer shrink-0"
                      >
                        {deletingId === snap.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSuperAdmin && snapshots.length > 0 && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Pemulihan massal snapshot ke sistem & Cloud hanya dapat dijalankan oleh Administrator Utama.</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

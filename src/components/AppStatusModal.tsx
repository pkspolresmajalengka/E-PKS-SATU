import React, { useState, useEffect } from 'react';
import {
  Power,
  AlertTriangle,
  X,
  Check,
  Clock,
  Phone,
  FileText,
  Sparkles,
  Eye,
  ShieldAlert,
  Info
} from 'lucide-react';
import { AppStatusConfig } from '../lib/firebase';

interface AppStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: AppStatusConfig;
  onSaveStatus: (newStatus: AppStatusConfig) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  appLogo: string | null;
}

const PRESET_TEMPLATES = [
  {
    label: 'Penutupan Sementara Pasca Lomba',
    title: 'Rekapitulasi Selesai - Akses Aplikasi Ditutup Sementara',
    message:
      'Seluruh rangkaian penilaian lomba PBB dan PKS telah selesai direkapitulasi oleh Dewan Juri. Akses penilaian dan pendaftaran saat ini ditutup sementara untuk proses verifikasi akhir berkas dan penandatanganan berita acara kejuaraan.',
    estimateTime: 'Akan dibuka kembali setelah pengumuman resmi kejuaraan',
    contactInfo: 'Sekretariat Panitia Pelaksana / WA: 0812-3456-7890'
  },
  {
    label: 'Pemeliharaan Sistem (Maintenance)',
    title: 'Aplikasi Sedang Dalam Pemeliharaan Sistem',
    message:
      'Sistem E-Rekapitulasi Lomba PBB & PKS sedang menjalani pemeliharaan berkala dan optimalisasi sinkronisasi cloud data. Mohon menunggu beberapa saat hingga proses selesai.',
    estimateTime: 'Estimasi pengerjaan: 30 - 60 menit',
    contactInfo: 'Pusat Bantuan Panitia Teknis IT'
  },
  {
    label: 'Jeda Istirahat / Penundaan Sesi',
    title: 'Sesi Penilaian Sedang Dijeda Sementara',
    message:
      'Penilaian lapangan sedang dijeda untuk waktu istirahat, ishoma, atau penyesuaian jadwal cuaca lapangan. Seluruh data nilai yang telah masuk sebelumnya tersimpan aman di cloud.',
    estimateTime: 'Sesi berikutnya akan dilanjutkan sesuai arahan MC lapangan',
    contactInfo: 'Pusat Informasi Dewan Juri & Panitia'
  },
  {
    label: 'Pendaftaran Kontingen Belum Dibuka',
    title: 'Portal Pendaftaran & Rekapitulasi Belum Dimulai',
    message:
      'Portal aplikasi E-Rekap PKS ini disiapkan untuk pelaksanaan lomba resmi. Pembina dan official sekolah dapat memantau jadwal pembukaan pendaftaran melalui edaran juklak panitia.',
    estimateTime: 'Akan dibuka sesuai jadwal edaran resmi panitia',
    contactInfo: 'Bagian Pendaftaran Panitia Lomba PBB PKS'
  }
];

export const AppStatusModal: React.FC<AppStatusModalProps> = ({
  isOpen,
  onClose,
  currentStatus,
  onSaveStatus,
  showToast,
  appLogo
}) => {
  const [isActive, setIsActive] = useState<boolean>(currentStatus.isActive);
  const [title, setTitle] = useState<string>(currentStatus.title);
  const [message, setMessage] = useState<string>(currentStatus.message);
  const [estimateTime, setEstimateTime] = useState<string>(currentStatus.estimateTime || '');
  const [contactInfo, setContactInfo] = useState<string>(currentStatus.contactInfo || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsActive(currentStatus.isActive);
      setTitle(currentStatus.title);
      setMessage(currentStatus.message);
      setEstimateTime(currentStatus.estimateTime || '');
      setContactInfo(currentStatus.contactInfo || '');
      setShowPreview(false);
    }
  }, [isOpen, currentStatus]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setTitle(preset.title);
    setMessage(preset.message);
    setEstimateTime(preset.estimateTime);
    setContactInfo(preset.contactInfo);
    showToast(`Template "${preset.label}" diterapkan ke formulir.`, 'info');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('Judul dan pesan penonaktifan wajib diisi!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated: AppStatusConfig = {
        id: 'app_status',
        isActive,
        title: title.trim(),
        message: message.trim(),
        estimateTime: estimateTime.trim(),
        contactInfo: contactInfo.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin'
      };
      await onSaveStatus(updated);
      showToast(
        isActive
          ? 'Aplikasi telah diaktifkan kembali untuk seluruh pengguna!'
          : 'Aplikasi berhasil dinonaktifkan. Pengguna non-admin akan melihat pesan penonaktifan.',
        isActive ? 'success' : 'info'
      );
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui status aplikasi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-700 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white shadow-xs ${
              isActive ? 'bg-emerald-600' : 'bg-rose-600 animate-pulse'
            }`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>Kontrol Status Aplikasi (Aktivasi / Nonaktif)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                }`}>
                  {isActive ? 'STATUS: AKTIF' : 'STATUS: DINONAKTIFKAN'}
                </span>
              </h3>
              <p className="text-xs text-blue-300">
                Fitur eksklusif Administrator untuk mengunci atau membuka akses aplikasi di semua perangkat
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

        {/* Content Form */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Main Toggle Switch Card */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isActive
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                  Saklar Operasional Aplikasi
                </span>
                <h4 className="font-black text-base flex items-center gap-2 mt-0.5">
                  <span>{isActive ? 'Aplikasi Sedang AKTIF' : 'Aplikasi Sedang DINONAKTIFKAN'}</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  {isActive
                    ? 'Seluruh juri, perwakilan sekolah, dan tamu dapat mengakses aplikasi secara normal di semua perangkat.'
                    : 'Aplikasi dikunci untuk umum, juri, dan sekolah. Hanya Administrator yang dapat login dan melihat dashboard.'}
                </p>
              </div>

              {/* Big Interactive Toggle Button */}
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{isActive ? 'Nonaktifkan Sekarang' : 'Aktifkan Kembali Aplikasi'}</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gunakan Contoh Pesan Siap Pakai (Preset):</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(tmpl)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/80 hover:border-blue-300 transition text-xs cursor-pointer group"
                >
                  <span className="font-bold text-slate-800 group-hover:text-blue-700 block text-[11px]">
                    {tmpl.label}
                  </span>
                  <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {tmpl.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Text Configuration */}
          <div className="space-y-3.5 pt-1">
            {/* Judul Pengumuman */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Judul Pengumuman Penonaktifan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Contoh: Aplikasi Sedang Dinonaktifkan Sementara"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Isi Pesan Kustom */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Pesan Lengkap untuk Pengguna / Layar Nonaktif <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tuliskan keterangan detail mengapa aplikasi dinonaktifkan..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
              />
            </div>

            {/* Grid 2 Columns: Estimasi Waktu & Kontak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Estimasi Dibuka Kembali (Opsional)</span>
                </label>
                <input
                  type="text"
                  value={estimateTime}
                  onChange={e => setEstimateTime(e.target.value)}
                  placeholder="Contoh: 20 Maret 2026 pukul 13:00 WIB"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Narahubung / Kontak Panitia (Opsional)</span>
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder="Contoh: Sekretariat Panitia / WA: 081234567890"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Toggle Live Preview */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Sembunyikan Pratinjau Tampilan' : 'Lihat Pratinjau Tampilan Layar Nonaktif'}</span>
            </button>

            {showPreview && (
              <div className="mt-2.5 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-inner">
                <div className="text-center max-w-md mx-auto space-y-2">
                  <div className="inline-flex p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase">
                    Status: Dinonaktifkan Oleh Administrator
                  </div>
                  <h4 className="font-black text-sm text-white">{title || 'Judul Pengumuman'}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{message || 'Isi pesan pengumuman...'}</p>
                  {(estimateTime || contactInfo) && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-0.5">
                      {estimateTime && <p>⏱️ {estimateTime}</p>}
                      {contactInfo && <p>📞 {contactInfo}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info notice */}
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Catatan Hak Akses:</strong> Saat aplikasi dinonaktifkan, akun Admin tetap dapat login dan mengakses seluruh dashboard aplikasi melalui tombol "Login Administrator" di layar nonaktif.
            </p>
          </div>

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition ${
                isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan ke Cloud...' : 'Simpan & Terapkan Status'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

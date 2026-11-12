import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Link,
  Shield,
  AlertCircle
} from 'lucide-react';

interface LogoSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogo: string | null;
  onSaveLogo: (logoDataUrl: string) => void;
  onResetLogo: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const LogoSettingModal: React.FC<LogoSettingModalProps> = ({
  isOpen,
  onClose,
  currentLogo,
  onSaveLogo,
  onResetLogo,
  showToast
}) => {
  const [previewLogo, setPreviewLogo] = useState<string | null>(currentLogo);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Berkas yang dipilih harus berupa gambar (PNG, JPG, SVG, WEBP)!');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Ukuran berkas logo maksimal 2 MB agar tidak memperlambat aplikasi.');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const result = event.target?.result as string;
      setPreviewLogo(result);
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca berkas logo.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    setErrorMsg('');
    if (!logoUrlInput.trim()) {
      setErrorMsg('Masukkan alamat URL gambar logo terlebih dahulu!');
      return;
    }
    setPreviewLogo(logoUrlInput.trim());
  };

  const handleSave = () => {
    if (!previewLogo) {
      onResetLogo();
    } else {
      onSaveLogo(previewLogo);
    }
    onClose();
  };

  const handleReset = () => {
    setPreviewLogo(null);
    setLogoUrlInput('');
    onResetLogo();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <ImageIcon className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">Pengaturan Logo Aplikasi</h3>
              <p className="text-xs text-blue-300">
                Ganti lambang resmi pada navbar, kop surat, dan formulir pendaftaran
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pratinjau Logo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Pratinjau Logo Saat Ini
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Light Mode Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase mb-2">
                  Latar Terang (Kop Surat & Cetak)
                </span>
                <div className="w-20 h-20 flex items-center justify-center bg-white rounded-xl shadow-xs border border-slate-200 p-2">
                  {previewLogo ? (
                    <img
                      src={previewLogo}
                      alt="Pratinjau Terang"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Shield className="w-10 h-10 text-blue-600" />
                  )}
                </div>
              </div>

              {/* Dark Mode Preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-blue-300 font-bold uppercase mb-2">
                  Latar Gelap (Navbar Aplikasi)
                </span>
                <div className="w-20 h-20 flex items-center justify-center bg-slate-800 rounded-xl shadow-xs border border-slate-700 p-2">
                  {previewLogo ? (
                    <img
                      src={previewLogo}
                      alt="Pratinjau Gelap"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Shield className="w-10 h-10 text-amber-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Opsi 1: Upload File Gambar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Opsi 1: Unggah Berkas Gambar Logo
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50 hover:bg-blue-50/50"
            >
              <Upload className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-slate-700">
                Pilih Berkas Logo dari Komputer / HP
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mendukung PNG, JPG, SVG, WebP transparan (Maks. 2 MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Opsi 2: URL Gambar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Opsi 2: Masukkan Tautan / URL Gambar Logo
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={logoUrlInput}
                  onChange={e => setLogoUrlInput(e.target.value)}
                  placeholder="https://contoh.com/logo-sekolah.png"
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyUrl}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition shrink-0"
              >
                Gunakan URL
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="bg-slate-100 px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-rose-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Lambang Default PKS</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Terapkan Logo Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

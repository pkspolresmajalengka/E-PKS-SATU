import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Building2,
  DollarSign,
  CheckCircle2,
  Settings,
  Shield,
  HelpCircle,
  Upload,
  RefreshCw,
  Loader2,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import {
  PaymentConfig,
  DEFAULT_PAYMENT_CONFIG,
  generateNomorIndukPoljar,
  normalizeAngkatanCode
} from '../lib/firebase';
import { compressImageFile } from '../lib/imageUtils';
import { NetworkErrorBanner, NetworkErrorState } from './NetworkErrorBanner';

interface PaymentGatewaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentConfig: PaymentConfig;
  onSave: (config: PaymentConfig) => Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PaymentGatewaySettingsModal: React.FC<PaymentGatewaySettingsModalProps> = ({
  isOpen,
  onClose,
  paymentConfig,
  onSave,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'fees' | 'midtrans' | 'ratapay' | 'qris' | 'bank'>('fees');
  const [config, setConfig] = useState<PaymentConfig>(paymentConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [networkError, setNetworkError] = useState<NetworkErrorState | null>(null);
  const [showServerKey, setShowServerKey] = useState(false);
  const [showRatapayKey, setShowRatapayKey] = useState(false);

  const poljarSettings = {
    ...DEFAULT_PAYMENT_CONFIG.poljarSettings!,
    ...(config.poljarSettings || {})
  };

  useEffect(() => {
    if (isOpen) {
      setConfig({
        ...paymentConfig,
        poljarSettings: {
          ...DEFAULT_PAYMENT_CONFIG.poljarSettings!,
          ...(paymentConfig.poljarSettings || {})
        },
        formFees: {
          polisi_pelajar: {
            ...DEFAULT_PAYMENT_CONFIG.formFees.polisi_pelajar,
            ...(paymentConfig.formFees?.polisi_pelajar || {})
          },
          calon_pks: {
            ...DEFAULT_PAYMENT_CONFIG.formFees.calon_pks,
            ...(paymentConfig.formFees?.calon_pks || {})
          },
          kemah_balok1: {
            ...DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1,
            ...(paymentConfig.formFees?.kemah_balok1 || {})
          },
          pks_balok2: {
            ...DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2,
            ...(paymentConfig.formFees?.pks_balok2 || {})
          }
        }
      });
      setNetworkError(null);
      setConfirmReset(false);
    }
  }, [isOpen, paymentConfig]);

  if (!isOpen) return null;

  const handlePoljarSettingChange = (
    field: 'tahunAngkatan' | 'angkatan' | 'allowInstallment' | 'minDpPercent',
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      poljarSettings: {
        ...DEFAULT_PAYMENT_CONFIG.poljarSettings!,
        ...(prev.poljarSettings || {}),
        [field]: value
      }
    }));
  };

  const handleFeeChange = (
    formKey: keyof PaymentConfig['formFees'],
    field: 'fee' | 'mealFee' | 'schoolFee' | 'isFree' | 'description',
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      formFees: {
        ...prev.formFees,
        [formKey]: {
          ...prev.formFees[formKey],
          [field]: value
        }
      }
    }));
  };

  const handleQrisImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih berkas gambar QRIS (PNG / JPG / WEBP)!', 'error');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 6 MB!', 'error');
      return;
    }

    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 900,
        maxDataUrlBytes: 520 * 1024,
        preferPng: true
      });
      setConfig(prev => ({
        ...prev,
        qris: {
          ...prev.qris,
          qrisImageUrl: compressed
        }
      }));
      showToast('Gambar QRIS berhasil dimuat & dioptimalkan untuk Cloud!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses gambar QRIS.', 'error');
    }
  };

  const executeSaveSubmit = async () => {
    setIsSaving(true);
    setNetworkError(null);
    try {
      const success = await onSave(config);
      if (success) {
        onClose();
      } else {
        setNetworkError({
          title: 'Gagal Menyimpan Pengaturan Pembayaran ke Cloud',
          message: 'Koneksi ke server Cloud terganggu atau penyimpanan ditolak. Periksa jaringan lalu klik Coba Lagi.',
          isNetworkError: typeof navigator !== 'undefined' ? !navigator.onLine : true,
          onRetry: executeSaveSubmit
        });
      }
    } catch (err: any) {
      setNetworkError({
        title: 'Gagal Menyimpan Pengaturan Pembayaran',
        message: err?.message || 'Terjadi gangguan jaringan saat menyimpan konfigurasi.',
        isNetworkError: true,
        onRetry: executeSaveSubmit
      });
      showToast(`Gagal menyimpan pengaturan: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSaveSubmit();
  };

  const handleResetToDefault = () => {
    setConfig(DEFAULT_PAYMENT_CONFIG);
    setConfirmReset(false);
    showToast('Pengaturan direset ke setelan awal demo (klik Simpan untuk mengirim ke Cloud).', 'info');
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                <span>Pengaturan Pembayaran & Tarif Formulir</span>
                <span className="text-[10px] bg-blue-900/80 text-blue-300 border border-blue-700/60 font-semibold px-2 py-0.5 rounded-full">
                  Admin Panel
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasi tarif registrasi mandiri sekolah dan gateway (Midtrans, Ratapay, QRIS, Bank)
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="text-slate-400 hover:text-white disabled:opacity-50 p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100/80 px-4 sm:px-6 py-2 border-b border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'fees'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>1. Tarif 4 Formulir</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('midtrans')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'midtrans'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
            <span>2. Midtrans Snap</span>
            {config.midtrans.enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ratapay')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'ratapay'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>3. Ratapay</span>
            {config.ratapay.enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qris')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'qris'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-rose-500" />
            <span>4. QRIS Statis</span>
            {config.qris.enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'bank'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>5. Transfer Bank Manual</span>
            {config.bankTransfer.enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <NetworkErrorBanner error={networkError} onDismiss={() => setNetworkError(null)} />
          {/* ======================================================== */}
          {/* TAB 1: TARIF 4 FORMULIR */}
          {/* ======================================================== */}
          {activeTab === 'fees' && (
            <div className="space-y-5">
              <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Kustomisasi Biaya Pendaftaran:</strong> Admin dapat menentukan nominal biaya (IDR) untuk masing-masing formulir yang diinputkan akun sekolah, atau mengaktifkan opsi <em>Gratis</em> jika tidak dipungut biaya registrasi.
                </div>
              </div>

              {/* Form 1: Polisi Pelajar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      1. Formulir Pendaftaran Polisi Pelajar (Poljar)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Seleksi penerimaan polisi pelajar & pembinaan ketertiban
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.formFees.polisi_pelajar.isFree}
                      onChange={e =>
                        handleFeeChange('polisi_pelajar', 'isFree', e.target.checked)
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Gratis (Bebas Biaya)</span>
                  </label>
                </div>

                {!config.formFees.polisi_pelajar.isFree && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nominal Biaya (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={config.formFees.polisi_pelajar.fee}
                        onChange={e =>
                          handleFeeChange('polisi_pelajar', 'fee', Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {formatRupiah(config.formFees.polisi_pelajar.fee)}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Keterangan Rincian Biaya
                      </label>
                      <input
                        type="text"
                        value={config.formFees.polisi_pelajar.description}
                        onChange={e =>
                          handleFeeChange('polisi_pelajar', 'description', e.target.value)
                        }
                        placeholder="Contoh: Seleksi fisik, piagam, dan tanda pangkat..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Pengaturan Angkatan, NIPP, & Cicilan DP Minimal */}
                <div className="mt-2 pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                        Pengaturan Angkatan, NIPP & Cicilan (Diatur Admin)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Tahun Angkatan & Angkatan dipakai otomatis untuk Nomor Induk Polisi Pelajar (PP-Tahun-Angkatan-TglLahir)
                      </span>
                    </div>
                    <div className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-[11px] font-mono font-bold text-blue-900 shrink-0">
                      Contoh NIPP: {generateNomorIndukPoljar(poljarSettings.tahunAngkatan, poljarSettings.angkatan, '2012-01-15')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tahun Angkatan
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={poljarSettings.tahunAngkatan}
                        onChange={e =>
                          handlePoljarSettingChange('tahunAngkatan', e.target.value.replace(/[^\d]/g, '').slice(0, 4))
                        }
                        placeholder="2026"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Angkatan
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={poljarSettings.angkatan}
                        onChange={e =>
                          handlePoljarSettingChange('angkatan', e.target.value.slice(0, 4))
                        }
                        placeholder="01"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        Kode: {normalizeAngkatanCode(poljarSettings.angkatan)}
                      </span>
                    </div>

                    {!config.formFees.polisi_pelajar.isFree && (
                      <>
                        <div className="flex flex-col justify-center">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Skema Cicilan
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={poljarSettings.allowInstallment}
                              onChange={e =>
                                handlePoljarSettingChange('allowInstallment', e.target.checked)
                              }
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Izinkan Cicilan</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            DP Minimal (%)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="90"
                            disabled={!poljarSettings.allowInstallment}
                            value={poljarSettings.minDpPercent}
                            onChange={e => {
                              const raw = Number(e.target.value) || 10;
                              const clamped = Math.max(10, Math.min(90, raw));
                              handlePoljarSettingChange('minDpPercent', clamped);
                            }}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          {poljarSettings.allowInstallment && (
                            <span className="text-[10px] text-emerald-700 font-mono font-semibold mt-0.5 block">
                              Min DP: {formatRupiah(Math.ceil((config.formFees.polisi_pelajar.fee * poljarSettings.minDpPercent) / 100))}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Form 2: Calon Anggota PKS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      2. Formulir Biodata Calon Anggota PKS
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pendaftaran anggota baru patroli keamanan sekolah
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.formFees.calon_pks.isFree}
                      onChange={e =>
                        handleFeeChange('calon_pks', 'isFree', e.target.checked)
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Gratis (Bebas Biaya)</span>
                  </label>
                </div>

                {!config.formFees.calon_pks.isFree && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Nominal Biaya (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={config.formFees.calon_pks.fee}
                        onChange={e =>
                          handleFeeChange('calon_pks', 'fee', Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {formatRupiah(config.formFees.calon_pks.fee)}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Keterangan Rincian Biaya
                      </label>
                      <input
                        type="text"
                        value={config.formFees.calon_pks.description}
                        onChange={e =>
                          handleFeeChange('calon_pks', 'description', e.target.value)
                        }
                        placeholder="Contoh: Modul diklat dasar, atribut, dan lencana..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form 3: Kemah Balok 1 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">
                        3. Formulir Pendaftaran Perkemahan PKS (Tingkat Balok 1)
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase">
                        Wajib Cash 100%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Biaya wajib tiap sekolah (per formulir dikirim) + tarif dasar peserta + tarif konsumsi · Tanpa cicilan/DP
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.formFees.kemah_balok1.isFree}
                      onChange={e =>
                        handleFeeChange('kemah_balok1', 'isFree', e.target.checked)
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Gratis (Bebas Biaya)</span>
                  </label>
                </div>

                {!config.formFees.kemah_balok1.isFree && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                          Biaya Wajib / Sekolah (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.formFees.kemah_balok1.schoolFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.schoolFee ?? 0}
                          onChange={e =>
                            handleFeeChange('kemah_balok1', 'schoolFee', Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 border border-amber-300 bg-white rounded-lg text-xs font-mono font-bold text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-amber-800 font-mono mt-0.5 block">
                          {formatRupiah(config.formFees.kemah_balok1.schoolFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.schoolFee ?? 0)} / formulir sekolah
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Tarif Dasar / Peserta (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.formFees.kemah_balok1.fee}
                          onChange={e =>
                            handleFeeChange('kemah_balok1', 'fee', Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          {formatRupiah(config.formFees.kemah_balok1.fee)} / peserta
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">
                          Tarif Konsumsi / Peserta (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.formFees.kemah_balok1.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.mealFee ?? 0}
                          onChange={e =>
                            handleFeeChange('kemah_balok1', 'mealFee', Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 border border-emerald-300 bg-white rounded-lg text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">
                          {formatRupiah(config.formFees.kemah_balok1.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.mealFee ?? 0)} / konsumsi
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Keterangan Rincian Biaya
                      </label>
                      <input
                        type="text"
                        value={config.formFees.kemah_balok1.description}
                        onChange={e =>
                          handleFeeChange('kemah_balok1', 'description', e.target.value)
                        }
                        placeholder="Contoh: Biaya wajib sekolah per pengajuan + biaya dasar peserta & opsi konsumsi..."
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Rumus (Cash Penuh): <strong className="text-slate-800">Biaya Wajib Sekolah + (Total Peserta × Tarif Dasar) + (Konsumsi × Tarif Konsumsi)</strong>
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        Simulasi 1 Sekolah + 10 Peserta + 8 Konsumsi = {formatRupiah(
                          (config.formFees.kemah_balok1.schoolFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.schoolFee ?? 0) +
                          10 * (config.formFees.kemah_balok1.fee || 0) +
                          8 * (config.formFees.kemah_balok1.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.mealFee ?? 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Form 4: Balok 2 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      4. Formulir Perkemahan & Ujian PKS (Tingkat Balok 2)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tarif dasar per peserta ditambah tarif konsumsi bagi peserta yang ikut konsumsi
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.formFees.pks_balok2.isFree}
                      onChange={e =>
                        handleFeeChange('pks_balok2', 'isFree', e.target.checked)
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Gratis (Bebas Biaya)</span>
                  </label>
                </div>

                {!config.formFees.pks_balok2.isFree && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Tarif Dasar / Peserta (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.formFees.pks_balok2.fee}
                          onChange={e =>
                            handleFeeChange('pks_balok2', 'fee', Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          {formatRupiah(config.formFees.pks_balok2.fee)} / peserta
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">
                          Tarif Konsumsi / Peserta (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.formFees.pks_balok2.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2.mealFee ?? 0}
                          onChange={e =>
                            handleFeeChange('pks_balok2', 'mealFee', Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 border border-purple-300 bg-white rounded-lg text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-purple-700 font-mono mt-0.5 block">
                          {formatRupiah(config.formFees.pks_balok2.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2.mealFee ?? 0)} / konsumsi
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Keterangan Rincian Biaya
                        </label>
                        <input
                          type="text"
                          value={config.formFees.pks_balok2.description}
                          onChange={e =>
                            handleFeeChange('pks_balok2', 'description', e.target.value)
                          }
                          placeholder="Contoh: Biaya dasar peserta Balok 2 & opsi konsumsi..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Rumus otomatis: <strong className="text-slate-800">(Total Peserta × Tarif Dasar) + (Peserta Konsumsi × Tarif Konsumsi)</strong>
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        Simulasi 10 Peserta + 8 Konsumsi = {formatRupiah(
                          10 * (config.formFees.pks_balok2.fee || 0) +
                          8 * (config.formFees.pks_balok2.mealFee ?? DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2.mealFee ?? 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: MIDTRANS */}
          {/* ======================================================== */}
          {activeTab === 'midtrans' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Aktifkan Payment Gateway Midtrans Snap</h3>
                  <p className="text-xs text-slate-500">
                    Menerima pembayaran otomatis via Virtual Account, GoPay, ShopeePay, dan Kartu Kredit.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.midtrans.enabled}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        midtrans: { ...prev.midtrans, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Environment Midtrans
                  </label>
                  <select
                    value={config.midtrans.isProduction ? 'prod' : 'sandbox'}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        midtrans: { ...prev.midtrans, isProduction: e.target.value === 'prod' }
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sandbox">Sandbox (Mode Uji Coba Simulasi)</option>
                    <option value="prod">Production (Mode Transaksi Asli Live)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Merchant ID Midtrans
                  </label>
                  <input
                    type="text"
                    value={config.midtrans.merchantId}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        midtrans: { ...prev.midtrans, merchantId: e.target.value }
                      }))
                    }
                    placeholder="Contoh: G123456789"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Client Key Midtrans
                  </label>
                  <input
                    type="text"
                    value={config.midtrans.clientKey}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        midtrans: { ...prev.midtrans, clientKey: e.target.value }
                      }))
                    }
                    placeholder="SB-Mid-client-..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Server Key Midtrans
                  </label>
                  <div className="relative">
                    <input
                      type={showServerKey ? 'text' : 'password'}
                      value={config.midtrans.serverKey}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          midtrans: { ...prev.midtrans, serverKey: e.target.value }
                        }))
                      }
                      placeholder="SB-Mid-server-..."
                      className="w-full pr-10 pl-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowServerKey(!showServerKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showServerKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: RATAPAY */}
          {/* ======================================================== */}
          {activeTab === 'ratapay' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Aktifkan Payment Gateway Ratapay</h3>
                  <p className="text-xs text-slate-500">
                    Integrasi pembayaran digital instan via gerbang pembayaran Ratapay.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ratapay.enabled}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        ratapay: { ...prev.ratapay, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Merchant Code Ratapay
                  </label>
                  <input
                    type="text"
                    value={config.ratapay.merchantCode}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        ratapay: { ...prev.ratapay, merchantCode: e.target.value }
                      }))
                    }
                    placeholder="Contoh: RATA-MCH-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    API Key / Secret Token Ratapay
                  </label>
                  <div className="relative">
                    <input
                      type={showRatapayKey ? 'text' : 'password'}
                      value={config.ratapay.apiKey}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          ratapay: { ...prev.ratapay, apiKey: e.target.value }
                        }))
                      }
                      placeholder="RATA-KEY-..."
                      className="w-full pr-10 pl-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRatapayKey(!showRatapayKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showRatapayKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: QRIS STATIS */}
          {/* ======================================================== */}
          {activeTab === 'qris' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Aktifkan Pembayaran QRIS Statis Panitia</h3>
                  <p className="text-xs text-slate-500">
                    Sekolah cukup scan barcode QRIS resmi panitia dari aplikasi m-Banking atau E-Wallet mana pun.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.qris.enabled}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        qris: { ...prev.qris, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Nama Merchant / Akun QRIS Resmi
                    </label>
                    <input
                      type="text"
                      value={config.qris.merchantName}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          qris: { ...prev.qris, merchantName: e.target.value }
                        }))
                      }
                      placeholder="Contoh: PANITIA PKS POLRES MAJALENGKA"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Instruksi Pembayaran QRIS
                    </label>
                    <textarea
                      rows={3}
                      value={config.qris.instruction}
                      onChange={e =>
                        setConfig(prev => ({
                          ...prev,
                          qris: { ...prev.qris, instruction: e.target.value }
                        }))
                      }
                      placeholder="Panduan bagi sekolah saat scan QRIS..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Unggah Gambar Poster Barcode QRIS Resmi
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrisImageUpload}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Format PNG / JPG / WEBP, maksimal 2 MB.
                    </p>
                  </div>
                </div>

                {/* QRIS Preview Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[220px]">
                  {config.qris.qrisImageUrl ? (
                    <div className="space-y-2">
                      <img
                        src={config.qris.qrisImageUrl}
                        alt="Preview QRIS"
                        className="max-h-52 object-contain rounded-xl shadow-xs border border-slate-200 mx-auto bg-white p-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConfig(prev => ({
                            ...prev,
                            qris: { ...prev.qris, qrisImageUrl: '' }
                          }))
                        }
                        className="text-xs text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                      >
                        Hapus Foto QRIS
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                      <QrCode className="w-16 h-16 stroke-1 text-slate-300 mb-2" />
                      <span className="text-xs font-semibold text-slate-500">Belum ada gambar QRIS yang diunggah</span>
                      <span className="text-[11px] text-slate-400">Pilih berkas foto gambar QRIS dari panitia</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: TRANSFER BANK MANUAL */}
          {/* ======================================================== */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Aktifkan Metode Transfer Manual Bank</h3>
                  <p className="text-xs text-slate-500">
                    Sekolah mentransfer ke rekening bank panitia dan mengunggah foto struk/bukti transfer.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.bankTransfer.enabled}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        bankTransfer: { ...prev.bankTransfer, enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Bank Tujuan
                  </label>
                  <input
                    type="text"
                    value={config.bankTransfer.bankName}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        bankTransfer: { ...prev.bankTransfer, bankName: e.target.value }
                      }))
                    }
                    placeholder="Contoh: Bank Mandiri / BCA / BJB / BRI"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nomor Rekening Panitia
                  </label>
                  <input
                    type="text"
                    value={config.bankTransfer.accountNumber}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        bankTransfer: { ...prev.bankTransfer, accountNumber: e.target.value }
                      }))
                    }
                    placeholder="Contoh: 137-00-1234567-8"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Pemilik Rekening (Atas Nama)
                  </label>
                  <input
                    type="text"
                    value={config.bankTransfer.accountHolder}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        bankTransfer: { ...prev.bankTransfer, accountHolder: e.target.value }
                      }))
                    }
                    placeholder="Contoh: Panitia Pelaksana PBB PKS"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Instruksi & Catatan Tambahan Transfer
                  </label>
                  <textarea
                    rows={3}
                    value={config.bankTransfer.instruction}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        bankTransfer: { ...prev.bankTransfer, instruction: e.target.value }
                      }))
                    }
                    placeholder="Panduan bagi perwakilan sekolah saat melakukan transfer bank..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {confirmReset ? (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="font-bold text-amber-900">Reset semua setelan?</span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Ya, Reset
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setConfirmReset(true)}
                className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50 transition underline underline-offset-2 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Kembalikan ke Setelan Awal Demo</span>
              </button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Pengaturan Pembayaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

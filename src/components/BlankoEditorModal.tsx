import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Building2,
  Shield,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Award,
  Star,
  UserCheck,
  Eye,
  Info
} from 'lucide-react';
import { BlankoConfig, DEFAULT_BLANKO_CONFIG } from '../lib/firebase';

interface BlankoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  blankoConfig: BlankoConfig;
  onSaveBlankoConfig: (config: BlankoConfig) => Promise<boolean>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  appLogo?: string | null;
}

export const BlankoEditorModal: React.FC<BlankoEditorModalProps> = ({
  isOpen,
  onClose,
  blankoConfig,
  onSaveBlankoConfig,
  showToast,
  appLogo
}) => {
  const [activeTab, setActiveTab] = useState<'kop' | 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2'>('kop');
  const [config, setConfig] = useState<BlankoConfig>(blankoConfig || DEFAULT_BLANKO_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(blankoConfig || DEFAULT_BLANKO_CONFIG);
    }
  }, [isOpen, blankoConfig]);

  if (!isOpen) return null;

  const handleKopChange = (field: keyof BlankoConfig['kopSurat'], val: string) => {
    setConfig(prev => ({
      ...prev,
      kopSurat: {
        ...prev.kopSurat,
        [field]: val
      }
    }));
  };

  const handleFormBlankoChange = (
    formKey: 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2',
    field: string,
    val: string
  ) => {
    setConfig(prev => ({
      ...prev,
      forms: {
        ...prev.forms,
        [formKey]: {
          ...prev.forms[formKey],
          [field]: val
        }
      }
    }));
  };

  const handleResetToDefault = () => {
    if (window.confirm('Kembalikan seluruh format blangko dan kop surat ke standar resmi Polri?')) {
      setConfig(DEFAULT_BLANKO_CONFIG);
      showToast('Format blangko dikembalikan ke standar bawaan.', 'info');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const ok = await onSaveBlankoConfig(config);
      if (ok) {
        showToast('Format blangko cetak berhasil disimpan ke Cloud!', 'success');
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                Editor Blangko Cetak Pendaftaran Resmi
              </h3>
              <p className="text-xs text-slate-300">
                Kustomisasi Kop Surat, Format Dokumen, Petunjuk Berkas & Pejabat Penandatangan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/80 px-4 pt-2.5 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('kop')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'kop'
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 border-x border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Kop Surat Resmi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('polisi_pelajar')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'polisi_pelajar'
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 border-x border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>1. Polisi Pelajar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calon_pks')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'calon_pks'
                ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600 border-x border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Calon PKS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kemah_balok1')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'kemah_balok1'
                ? 'bg-white text-emerald-600 border-t-2 border-t-emerald-600 border-x border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. Kemah Balok 1</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pks_balok2')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'pks_balok2'
                ? 'bg-white text-purple-600 border-t-2 border-t-purple-600 border-x border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-purple-600" />
            <span>4. Ujian Balok 2</span>
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* TAB 1: KOP SURAT RESMI */}
          {activeTab === 'kop' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900">
                  Kop Surat ini digunakan sebagai kepala surat resmi pada seluruh blanko cetak A4 formulir pendaftaran Polisi Pelajar dan Korps PKS.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-300">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Pratinjau Tampilan Kop Surat:
                </p>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                  <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 uppercase">
                    {config.kopSurat.instansi}
                  </h4>
                  <h4 className="font-extrabold text-[11px] sm:text-xs text-slate-900 uppercase">
                    {config.kopSurat.poldaPolres}
                  </h4>
                  <h3 className="font-black text-xs sm:text-sm text-blue-950 uppercase mt-0.5">
                    {config.kopSurat.satuan}
                  </h3>
                  <h2 className="font-black text-sm sm:text-base text-slate-950 uppercase">
                    {config.kopSurat.lembaga}
                  </h2>
                  <p className="text-[10px] text-slate-600 font-medium mt-1">
                    {config.kopSurat.alamat}
                  </p>
                  <div className="mt-2 border-b-2 border-double border-slate-900"></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Baris 1: Instansi Utama
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.instansi}
                    onChange={e => handleKopChange('instansi', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Baris 2: Daerah / Resor Kepolisian
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.poldaPolres}
                    onChange={e => handleKopChange('poldaPolres', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Baris 3: Satuan / Unit Pelaksana
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.satuan}
                    onChange={e => handleKopChange('satuan', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Baris 4: Korps / Organisasi
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.lembaga}
                    onChange={e => handleKopChange('lembaga', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Baris 5: Alamat Sekretariat, Nomor Telepon & Email
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.alamat}
                    onChange={e => handleKopChange('alamat', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kota Tempat Penandatangan
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.kotaTtd}
                    onChange={e => handleKopChange('kotaTtd', e.target.value)}
                    placeholder="Contoh: Majalengka"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tahun Kegiatan
                  </label>
                  <input
                    type="text"
                    value={config.kopSurat.tahun}
                    onChange={e => handleKopChange('tahun', e.target.value)}
                    placeholder="2026"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2, 3, 4, 5: FORM SPECIFIC BLANKO CUSTOMIZATION */}
          {(['polisi_pelajar', 'calon_pks', 'kemah_balok1', 'pks_balok2'] as const).includes(activeTab as any) && (
            <div className="space-y-4">
              {(() => {
                const key = activeTab as 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2';
                const f = config.forms[key];
                return (
                  <>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                        Judul & Format Dokumen Blangko
                      </h4>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Judul Resmi Formulir (Tercetak di A4)
                        </label>
                        <input
                          type="text"
                          value={f.judul}
                          onChange={e => handleFormBlankoChange(key, 'judul', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Format Prefix Nomor Registrasi / Surat
                        </label>
                        <input
                          type="text"
                          value={f.nomorPrefix}
                          onChange={e => handleFormBlankoChange(key, 'nomorPrefix', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Syarat & Kelengkapan Berkas Pendaftaran
                        </label>
                        <textarea
                          rows={3}
                          value={f.syaratBerkas}
                          onChange={e => handleFormBlankoChange(key, 'syaratBerkas', e.target.value)}
                          placeholder="Masukkan rincian persyaratan berkas..."
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                        Format Kolom Tanda Tangan Resmi (3 Pihak)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Kolom TTD 1 */}
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Kolom 1 (Kiri)</span>
                          <label className="block text-[11px] font-semibold text-slate-700">Label Jabatan</label>
                          <input
                            type="text"
                            value={f.ttd1Label}
                            onChange={e => handleFormBlankoChange(key, 'ttd1Label', e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>

                        {/* Kolom TTD 2 */}
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Kolom 2 (Tengah)</span>
                          <label className="block text-[11px] font-semibold text-slate-700">Label Jabatan</label>
                          <input
                            type="text"
                            value={f.ttd2Label}
                            onChange={e => handleFormBlankoChange(key, 'ttd2Label', e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>

                        {/* Kolom TTD 3 */}
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Kolom 3 (Kanan - Pejabat)</span>
                          <label className="block text-[11px] font-semibold text-slate-700">Label Jabatan</label>
                          <input
                            type="text"
                            value={f.ttd3Label}
                            onChange={e => handleFormBlankoChange(key, 'ttd3Label', e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                          />

                          <label className="block text-[11px] font-semibold text-slate-700 pt-1">Nama Pejabat</label>
                          <input
                            type="text"
                            value={f.ttd3Nama}
                            onChange={e => handleFormBlankoChange(key, 'ttd3Nama', e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-bold"
                          />

                          <label className="block text-[11px] font-semibold text-slate-700 pt-1">Pangkat / NRP</label>
                          <input
                            type="text"
                            value={f.ttd3Nrp || ''}
                            onChange={e => handleFormBlankoChange(key, 'ttd3Nrp', e.target.value)}
                            placeholder="Contoh: NRP 80030112"
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar Polri</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Format Blangko</span>
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

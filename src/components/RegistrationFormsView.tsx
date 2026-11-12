import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  RotateCcw,
  Sparkles,
  Shield,
  UserCheck,
  Award,
  Star,
  Building2,
  Calendar,
  CheckCircle2,
  Cloud,
  Loader2,
  CreditCard,
  QrCode,
  DollarSign,
  Clock,
  XCircle,
  Copy,
  ExternalLink,
  Eye,
  X,
  Upload,
  Check,
  LayoutList,
  Edit3,
  Save,
  FileCheck2
} from 'lucide-react';
import {
  saveRegistrationToCloud,
  PaymentConfig,
  DEFAULT_PAYMENT_CONFIG,
  RegistrationSubmission,
  BlankoConfig,
  DEFAULT_BLANKO_CONFIG
} from '../lib/firebase';
import { AppUser } from '../App';

export type SchoolLevel = 'SLTP' | 'SLTA';

interface RegistrationFormsViewProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  appLogo: string | null;
  currentUser?: AppUser | null;
  paymentConfig?: PaymentConfig;
  submissionsList?: RegistrationSubmission[];
  blankoConfig?: BlankoConfig;
  onOpenBlankoEditor?: () => void;
  formPolisiPelajar: {
    nama: string;
    nisn: string;
    sekolah: string;
    jenjang: SchoolLevel;
    kelas: string;
    ttl: string;
    jk: string;
    agama: string;
    alamat: string;
    noHp: string;
    namaOrtu: string;
    pekerjaanOrtu: string;
    tinggiBadan: string;
    beratBadan: string;
    golDarah: string;
    riwayatPenyakit: string;
    prestasi: string;
    alasan: string;
  };
  setFormPolisiPelajar: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormPolisiPelajarExcel: () => void;

  formCalonPks: {
    nama: string;
    nisn: string;
    sekolah: string;
    jenjang: SchoolLevel;
    kelas: string;
    ttl: string;
    jk: string;
    agama: string;
    alamat: string;
    noHp: string;
    namaPembina: string;
    divisiMinat: string;
    tinggiBadan: string;
    beratBadan: string;
    golDarah: string;
    riwayatOrganisasi: string;
    izinOrtu: boolean;
  };
  setFormCalonPks: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormCalonPksExcel: () => void;

  formBalok1: {
    namaRegu: string;
    sekolah: string;
    jenjang: SchoolLevel;
    namaKetua: string;
    jumlahAnggota: string;
    namaPembina: string;
    noHpPembina: string;
    kategoriKemah: string;
    lokasiPerkemahan: string;
    tanggalKegiatan: string;
    statusKesehatan: string;
    suratIzinKepsek: string;
  };
  setFormBalok1: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormBalok1Excel: () => void;

  formBalok2: {
    namaPeserta: string;
    sekolah: string;
    jenjang: SchoolLevel;
    kelas: string;
    noSertifikatBalok1: string;
    tahunKelulusanBalok1: string;
    jabatanPleton: string;
    namaPembina: string;
    materiUji: string;
    rekomendasiSatlantas: string;
  };
  setFormBalok2: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormBalok2Excel: () => void;

  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RegistrationFormsView: React.FC<RegistrationFormsViewProps> = ({
  currentTab,
  setCurrentTab,
  appLogo,
  currentUser,
  paymentConfig = DEFAULT_PAYMENT_CONFIG,
  submissionsList = [],
  formPolisiPelajar,
  setFormPolisiPelajar,
  handleExportFormPolisiPelajarExcel,
  formCalonPks,
  setFormCalonPks,
  handleExportFormCalonPksExcel,
  formBalok1,
  setFormBalok1,
  handleExportFormBalok1Excel,
  formBalok2,
  setFormBalok2,
  handleExportFormBalok2Excel,
  blankoConfig = DEFAULT_BLANKO_CONFIG,
  onOpenBlankoEditor,
  showToast
}) => {
  const [viewMode, setViewMode] = useState<'form' | 'my_submissions'>('form');
  const [formDisplayMode, setFormDisplayMode] = useState<'compact' | 'blanko'>('compact');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'midtrans' | 'ratapay' | 'qris' | 'bank_transfer'>('midtrans');
  const [payNowChoice, setPayNowChoice] = useState<'pay_now' | 'pay_later'>('pay_now');
  const [proofFileBase64, setProofFileBase64] = useState<string>('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [simulatedGatewaySuccess, setSimulatedGatewaySuccess] = useState(false);
  const [pendingSubmissionPayload, setPendingSubmissionPayload] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Auto-fill school info when logged in as a school account
  useEffect(() => {
    if (currentUser?.role === 'sekolah') {
      const sch = currentUser.schoolName || currentUser.name;
      const lvl = currentUser.schoolLevel || 'SLTP';
      if (sch) {
        setFormPolisiPelajar((prev: any) => ({ ...prev, sekolah: sch, jenjang: lvl }));
        setFormCalonPks((prev: any) => ({ ...prev, sekolah: sch, jenjang: lvl }));
        setFormBalok1((prev: any) => ({ ...prev, sekolah: sch, jenjang: lvl }));
        setFormBalok2((prev: any) => ({ ...prev, sekolah: sch, jenjang: lvl }));
      }
    }
  }, [currentUser]);

  // Fee calculation for the active form
  const currentFeeConfig = useMemo(() => {
    const fees = paymentConfig?.formFees || DEFAULT_PAYMENT_CONFIG.formFees;
    if (currentTab === 'form_polisi_pelajar') return fees.polisi_pelajar;
    if (currentTab === 'form_calon_pks') return fees.calon_pks;
    if (currentTab === 'form_perkemahan_balok1') return fees.kemah_balok1;
    if (currentTab === 'form_perkemahan_balok2') return fees.pks_balok2;
    return { fee: 0, isFree: true, description: '' };
  }, [currentTab, paymentConfig]);

  // My school submissions filter
  const mySchoolSubmissions = useMemo(() => {
    if (!currentUser) return submissionsList;
    const schName = (currentUser.schoolName || currentUser.name || '').toLowerCase().trim();
    const schUname = (currentUser.username || '').toLowerCase().trim();
    return submissionsList.filter(s => {
      const sSchool = (s.schoolName || '').toLowerCase().trim();
      const sUser = (s.schoolUsername || '').toLowerCase().trim();
      return (schName && sSchool === schName) || (schUname && sUser === schUname);
    });
  }, [submissionsList, currentUser]);

  const handlePrint = () => {
    window.print();
  };

  // Helper to construct registration submission payload
  const getFormSubmissionPayload = (): RegistrationSubmission | null => {
    let formId = '';
    let formTitle = '';
    let applicantName = '';
    let schoolName = '';
    let schoolLevel: SchoolLevel = 'SLTP';
    let formData: any = null;

    if (currentTab === 'form_polisi_pelajar') {
      formTitle = blankoConfig?.forms?.polisi_pelajar?.judul || 'Polisi Pelajar (Poljar)';
      formId = `poljar-${formPolisiPelajar.nisn || Date.now()}`;
      applicantName = formPolisiPelajar.nama.trim() || 'Calon Anggota Poljar';
      schoolName = formPolisiPelajar.sekolah.trim() || currentUser?.schoolName || currentUser?.name || 'Sekolah';
      schoolLevel = formPolisiPelajar.jenjang || 'SLTP';
      formData = { ...formPolisiPelajar };
    } else if (currentTab === 'form_calon_pks') {
      formTitle = blankoConfig?.forms?.calon_pks?.judul || 'Calon Anggota PKS';
      formId = `calonpks-${formCalonPks.nisn || Date.now()}`;
      applicantName = formCalonPks.nama.trim() || 'Calon Anggota PKS';
      schoolName = formCalonPks.sekolah.trim() || currentUser?.schoolName || currentUser?.name || 'Sekolah';
      schoolLevel = formCalonPks.jenjang || 'SLTA';
      formData = { ...formCalonPks };
    } else if (currentTab === 'form_perkemahan_balok1') {
      formTitle = blankoConfig?.forms?.kemah_balok1?.judul || 'Kemah PKS Balok 1';
      formId = `balok1-${Date.now()}`;
      applicantName = formBalok1.namaRegu.trim() || formBalok1.namaKetua.trim() || 'Regu Kemah';
      schoolName = formBalok1.sekolah.trim() || currentUser?.schoolName || currentUser?.name || 'Sekolah';
      schoolLevel = formBalok1.jenjang || 'SLTP';
      formData = { ...formBalok1 };
    } else if (currentTab === 'form_perkemahan_balok2') {
      formTitle = blankoConfig?.forms?.pks_balok2?.judul || 'Ujian PKS Balok 2';
      formId = `balok2-${Date.now()}`;
      applicantName = formBalok2.namaPeserta.trim() || 'Peserta Ujian Balok 2';
      schoolName = formBalok2.sekolah.trim() || currentUser?.schoolName || currentUser?.name || 'Sekolah';
      schoolLevel = formBalok2.jenjang || 'SLTA';
      formData = { ...formBalok2 };
    }

    if (!applicantName || !schoolName) {
      showToast('Harap lengkapi nama pendaftar/regu dan asal sekolah terlebih dahulu!', 'error');
      return null;
    }

    const fee = currentFeeConfig.isFree ? 0 : currentFeeConfig.fee;

    return {
      id: formId,
      formType: currentTab.replace('form_', '').replace('perkemahan_', '') as any,
      formTitle,
      schoolName,
      schoolUsername: currentUser?.username || 'sekolah',
      schoolLevel,
      applicantName,
      contactWa: formData.noHp || formData.noHpPembina || currentUser?.contactWa || '',
      formData,
      feeAmount: fee,
      paymentMethod: fee === 0 ? 'free' : 'midtrans',
      paymentStatus: fee === 0 ? 'paid' : 'unpaid',
      stage1Finance: {
        status: fee === 0 ? 'approved' : 'pending',
        verifiedBy: fee === 0 ? 'Sistem (Bebas Biaya)' : undefined,
        verifiedAt: fee === 0 ? new Date().toLocaleString('id-ID') : undefined
      },
      stage2Committee: {
        status: 'pending'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Action: Simpan Dulu (Bayar Nanti)
  const handleSaveForLater = async () => {
    const payload = getFormSubmissionPayload();
    if (!payload) return;

    payload.paymentStatus = 'unpaid';
    setIsSubmitting(true);
    try {
      const res = await saveRegistrationToCloud(payload);
      if (res.success) {
        showToast(
          `Data pendaftaran "${payload.applicantName}" berhasil disimpan ke Cloud! Anda dapat membayarnya nanti di menu Riwayat & Tagihan Sekolah.`,
          'success'
        );
        setViewMode('my_submissions');
      } else {
        showToast(`Gagal menyimpan data: ${res.error}`, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Simpan Data & Lanjut Bayar
  const handleOpenSubmitAndPay = () => {
    const basePayload = getFormSubmissionPayload();
    if (!basePayload) return;

    const fee = currentFeeConfig.isFree ? 0 : currentFeeConfig.fee;

    if (fee === 0) {
      // Free form -> save immediately
      (async () => {
        setIsSubmitting(true);
        try {
          const res = await saveRegistrationToCloud(basePayload);
          if (res.success) {
            showToast(`Pendaftaran "${basePayload.formTitle}" untuk "${basePayload.applicantName}" berhasil dikirim ke panitia!`, 'success');
            setViewMode('my_submissions');
          } else {
            showToast(`Gagal mengirim pendaftaran: ${res.error}`, 'error');
          }
        } finally {
          setIsSubmitting(false);
        }
      })();
    } else {
      // Paid form -> open payment modal
      setPendingSubmissionPayload(basePayload);
      setPayNowChoice('pay_now');
      setProofFileBase64('');
      setProofFileName('');
      setSimulatedGatewaySuccess(false);
      setPaymentModalOpen(true);
    }
  };

  // Proof image upload for manual bank transfer or static QRIS
  const handleProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih berkas foto gambar (JPG / PNG / WEBP)!', 'error');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran berkas maksimal 3 MB!', 'error');
      return;
    }

    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      setProofFileBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Finalize Submission & Payment
  const handleConfirmPaymentAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSubmissionPayload) return;

    setIsSubmitting(true);
    try {
      let finalSubmission: RegistrationSubmission = { ...pendingSubmissionPayload };

      if (payNowChoice === 'pay_later') {
        finalSubmission.paymentStatus = 'unpaid';
        finalSubmission.paymentMethod = selectedPayMethod;
      } else {
        finalSubmission.paymentMethod = selectedPayMethod;

        if (selectedPayMethod === 'bank_transfer' || selectedPayMethod === 'qris') {
          if (!proofFileBase64) {
            showToast('Harap unggah foto bukti transfer atau struk scan QRIS!', 'error');
            setIsSubmitting(false);
            return;
          }
          finalSubmission.paymentStatus = 'pending_verification';
          finalSubmission.paymentProofUrl = proofFileBase64;
          finalSubmission.paymentProofFileName = proofFileName;
          finalSubmission.paymentDate = new Date().toLocaleString('id-ID');
        } else {
          // Midtrans or Ratapay Gateway
          finalSubmission.paymentStatus = 'pending_verification';
          finalSubmission.paymentReference = `${selectedPayMethod.toUpperCase()}-${Date.now()}`;
          finalSubmission.paymentDate = new Date().toLocaleString('id-ID');
        }
      }

      finalSubmission.updatedAt = new Date().toISOString();

      const res = await saveRegistrationToCloud(finalSubmission);
      if (res.success) {
        showToast(
          payNowChoice === 'pay_later'
            ? `Berkas pendaftaran tersimpan! Anda dapat membayarnya nanti di menu Riwayat Pengajuan.`
            : `Pendaftaran & bukti pembayaran berhasil dikirim! Menunggu verifikasi 2-tahap panitia.`,
          'success'
        );
        setPaymentModalOpen(false);
        setPendingSubmissionPayload(null);
        setViewMode('my_submissions');
      } else {
        showToast(`Gagal menyimpan ke Cloud: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Terjadi kesalahan: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSavingCloud = isSubmitting;
  const handleSaveFormToCloud = handleOpenSubmitAndPay;

  // 1. Reset or Fill Demo Data Handlers
  const handleResetPolisiPelajar = () => {
    setFormPolisiPelajar({
      nama: '',
      nisn: '',
      sekolah: '',
      jenjang: 'SLTP',
      kelas: '',
      ttl: '',
      jk: 'Laki-Laki',
      agama: 'Islam',
      alamat: '',
      noHp: '',
      namaOrtu: '',
      pekerjaanOrtu: '',
      tinggiBadan: '',
      beratBadan: '',
      golDarah: 'O',
      riwayatPenyakit: 'Tidak Ada',
      prestasi: '',
      alasan: ''
    });
    showToast('Formulir Polisi Pelajar dikosongkan (siap cetak blanko).', 'info');
  };

  const handleDemoPolisiPelajar = () => {
    setFormPolisiPelajar({
      nama: 'Bintang Pratama',
      nisn: '0089123456',
      sekolah: 'SMP Negeri 1 Majalengka',
      jenjang: 'SLTP',
      kelas: 'VIII-A',
      ttl: 'Majalengka, 15 Januari 2012',
      jk: 'Laki-Laki',
      agama: 'Islam',
      alamat: 'Jl. Pemuda No. 45, Majalengka',
      noHp: '081234567890',
      namaOrtu: 'Hendra Gunawan',
      pekerjaanOrtu: 'Wiraswasta',
      tinggiBadan: '165',
      beratBadan: '52',
      golDarah: 'O',
      riwayatPenyakit: 'Tidak Ada',
      prestasi: 'Juara 2 PBB Tingkat Kabupaten',
      alasan: 'Ingin mengabdi dan menegakkan ketertiban dan keselamatan lalu lintas di sekolah.'
    });
    showToast('Contoh data Polisi Pelajar berhasil dimuat.');
  };

  const handleResetCalonPks = () => {
    setFormCalonPks({
      nama: '',
      nisn: '',
      sekolah: '',
      jenjang: 'SLTA',
      kelas: '',
      ttl: '',
      jk: 'Perempuan',
      agama: 'Islam',
      alamat: '',
      noHp: '',
      namaPembina: '',
      divisiMinat: 'Gatur Lantas & Keselamatan Jalan',
      tinggiBadan: '',
      beratBadan: '',
      golDarah: 'A',
      riwayatOrganisasi: '',
      izinOrtu: true
    });
    showToast('Formulir Calon Anggota PKS dikosongkan.', 'info');
  };

  const handleDemoCalonPks = () => {
    setFormCalonPks({
      nama: 'Aisyah Putri Rahmadani',
      nisn: '0078129845',
      sekolah: 'SMA Negeri 1 Majalengka',
      jenjang: 'SLTA',
      kelas: 'X-MIPA 2',
      ttl: 'Majalengka, 22 April 2010',
      jk: 'Perempuan',
      agama: 'Islam',
      alamat: 'Jl. Kartini No. 12, Majalengka',
      noHp: '085712348900',
      namaPembina: 'Drs. Supriyadi, M.Pd',
      divisiMinat: 'Gatur Lantas & Keselamatan Jalan',
      tinggiBadan: '160',
      beratBadan: '48',
      golDarah: 'A',
      riwayatOrganisasi: 'Pramuka Penggalang Inti',
      izinOrtu: true
    });
    showToast('Contoh data Calon PKS berhasil dimuat.');
  };

  const handleResetBalok1 = () => {
    setFormBalok1({
      namaRegu: '',
      sekolah: '',
      jenjang: 'SLTP',
      namaKetua: '',
      jumlahAnggota: '12 Orang',
      namaPembina: '',
      noHpPembina: '',
      kategoriKemah: 'Balok 1 (Tingkat Dasar / Calon Kader PKS)',
      lokasiPerkemahan: '',
      tanggalKegiatan: '',
      statusKesehatan: 'Semua anggota sehat dan siap kegiatan lapangan',
      suratIzinKepsek: ''
    });
    showToast('Formulir Perkemahan Balok 1 dikosongkan.', 'info');
  };

  const handleDemoBalok1 = () => {
    setFormBalok1({
      namaRegu: 'Regu Elang Sakti',
      sekolah: 'SMP Negeri 1 Majalengka',
      jenjang: 'SLTP',
      namaKetua: 'Fajar Nugraha',
      jumlahAnggota: '12 Orang',
      namaPembina: 'Ahmad Fauzi, S.Pd',
      noHpPembina: '081398765432',
      kategoriKemah: 'Balok 1 (Tingkat Dasar / Calon Kader PKS)',
      lokasiPerkemahan: 'Bumi Perkemahan Sindangkasih, Majalengka',
      tanggalKegiatan: '12 - 14 Juni 2026',
      statusKesehatan: 'Semua anggota sehat dan siap kegiatan lapangan',
      suratIzinKepsek: 'No. 421.3/089/SMPN1/2026'
    });
    showToast('Contoh data Kemah Balok 1 berhasil dimuat.');
  };

  const handleResetBalok2 = () => {
    setFormBalok2({
      namaPeserta: '',
      sekolah: '',
      jenjang: 'SLTA',
      kelas: '',
      noSertifikatBalok1: '',
      tahunKelulusanBalok1: '',
      jabatanPleton: '',
      namaPembina: '',
      materiUji: '',
      rekomendasiSatlantas: ''
    });
    showToast('Formulir PKS Balok 2 dikosongkan.', 'info');
  };

  const handleDemoBalok2 = () => {
    setFormBalok2({
      namaPeserta: 'Rizky Ramadhan',
      sekolah: 'SMA Negeri 1 Majalengka',
      jenjang: 'SLTA',
      kelas: 'XI-IPS 1',
      noSertifikatBalok1: 'PKS-B1/POLRES-MJL/2025/084',
      tahunKelulusanBalok1: '2025',
      jabatanPleton: 'Komandan Pleton (Danton)',
      namaPembina: 'Iptu Agus Salim',
      materiUji: 'Penguasaan 12 Gerakan Gatur Lantas, PBB Tongkat, Senam Lantas, Bela Diri Praktis Polri',
      rekomendasiSatlantas: 'Memenuhi Syarat Kualifikasi Instruktur PKS Balok 2'
    });
    showToast('Contoh data PKS Balok 2 berhasil dimuat.');
  };

  // Shared Official Kop Surat Header from Blanko Configuration
  const renderKopSurat = () => {
    const kop = blankoConfig?.kopSurat || DEFAULT_BLANKO_CONFIG.kopSurat;
    return (
      <div className="border-b-4 border-double border-slate-900 pb-3 mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* Left Emblem */}
          <div className="w-20 h-20 flex items-center justify-center shrink-0">
            {appLogo ? (
              <img src={appLogo} alt="Logo PKS" className="w-18 h-18 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow">
                <Shield className="w-10 h-10 text-amber-400" />
              </div>
            )}
          </div>

          {/* Center Kop Details */}
          <div className="text-center flex-1">
            <h4 className="font-extrabold text-xs sm:text-sm tracking-widest text-slate-900 uppercase">
              {kop.instansi}
            </h4>
            <h4 className="font-extrabold text-xs sm:text-sm tracking-wider text-slate-900 uppercase">
              {kop.poldaPolres}
            </h4>
            <h3 className="font-black text-sm sm:text-base tracking-wide text-blue-950 uppercase mt-0.5">
              {kop.satuan}
            </h3>
            <h2 className="font-black text-base sm:text-lg tracking-tight text-slate-950 uppercase">
              {kop.lembaga}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium mt-1">
              {kop.alamat}
            </p>
          </div>

          {/* Right Emblem Placeholder / Watermark */}
          <div className="w-20 h-20 flex items-center justify-center shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-400 text-center uppercase leading-tight p-1">
              {kop.watermarkText || 'PASUKAN PKS'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* MODE SWITCHER TABS (Hidden in Print) */}
      <div className="no-print bg-slate-900 text-white p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 rounded-xl">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
              Portal Pendaftaran Mandiri Sekolah
            </h2>
            <p className="text-xs text-slate-300">
              {currentUser?.schoolName || currentUser?.name || 'Akun Sekolah'} • Input mandiri & tersinkron langsung ke panitia
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('form')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'form'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Isi Formulir Pendaftaran</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('my_submissions')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'my_submissions'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Riwayat & Tagihan Sekolah</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              {mySchoolSubmissions.length}
            </span>
          </button>
        </div>
      </div>

      {viewMode === 'form' ? (
        <>
          {/* FEE SUMMARY BANNER */}
          <div className="no-print bg-linear-to-r from-blue-50 via-indigo-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[11px] font-black tracking-wider uppercase">
                  Biaya Registrasi Resmi
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {currentTab === 'form_polisi_pelajar' && '1. Polisi Pelajar (Poljar)'}
                  {currentTab === 'form_calon_pks' && '2. Calon Anggota PKS'}
                  {currentTab === 'form_perkemahan_balok1' && '3. Perkemahan PKS Balok 1'}
                  {currentTab === 'form_perkemahan_balok2' && '4. Ujian PKS Balok 2'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {currentFeeConfig.isFree ? 'Gratis (Bebas Biaya)' : formatRupiah(currentFeeConfig.fee)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {currentFeeConfig.description || (currentFeeConfig.isFree ? 'Tanpa biaya pendaftaran panitia' : 'Per peserta/regu terdaftar')}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Tersedia pembayaran otomatis Midtrans, Ratapay, QRIS Statis, serta Transfer Manual Bank (Verifikasi 2-Tahap Keuangan & Panitia).
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={handleOpenSubmitAndPay}
                disabled={isSubmitting}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Kirim & Bayar Pendaftaran</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ACTION TOOLBAR (Hidden in Print) */}
          <div className="no-print bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
            {/* Row 1: Form Selector Pills & Display Mode Toggle */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* Form Selector Pills */}
              <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentTab('form_polisi_pelajar')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'form_polisi_pelajar'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>1. Polisi Pelajar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('form_calon_pks')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'form_calon_pks'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>2. Calon PKS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('form_perkemahan_balok1')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'form_perkemahan_balok1'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>3. Kemah Balok 1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('form_perkemahan_balok2')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    currentTab === 'form_perkemahan_balok2'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>4. PKS Balok 2</span>
                </button>
              </div>

              {/* Mode Switcher: Compact Input vs Official Blanko */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setFormDisplayMode('compact')}
                  className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formDisplayMode === 'compact'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mode Input Ringkas (Isi Cepat)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormDisplayMode('blanko')}
                  className={`flex-1 lg:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formDisplayMode === 'blanko'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Pratinjau Blangko Cetak A4</span>
                </button>
              </div>
            </div>

            {/* Row 2: Secondary Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {onOpenBlankoEditor && (
                  <button
                    type="button"
                    onClick={onOpenBlankoEditor}
                    className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit Format Blangko & Kop</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {formDisplayMode === 'compact'
                    ? '💡 Data terformat otomatis ke format blanko resmi kepolisian saat dicetak.'
                    : '📄 Pratinjau kertas A4 lembar blanko pendaftaran resmi.'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentTab === 'form_polisi_pelajar') handleDemoPolisiPelajar();
                    if (currentTab === 'form_calon_pks') handleDemoCalonPks();
                    if (currentTab === 'form_perkemahan_balok1') handleDemoBalok1();
                    if (currentTab === 'form_perkemahan_balok2') handleDemoBalok2();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Isi Contoh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentTab === 'form_polisi_pelajar') handleResetPolisiPelajar();
                    if (currentTab === 'form_calon_pks') handleResetCalonPks();
                    if (currentTab === 'form_perkemahan_balok1') handleResetBalok1();
                    if (currentTab === 'form_perkemahan_balok2') handleResetBalok2();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentTab === 'form_polisi_pelajar') handleExportFormPolisiPelajarExcel();
                    if (currentTab === 'form_calon_pks') handleExportFormCalonPksExcel();
                    if (currentTab === 'form_perkemahan_balok1') handleExportFormBalok1Excel();
                    if (currentTab === 'form_perkemahan_balok2') handleExportFormBalok2Excel();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>Cetak A4 (PDF)</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 1. MODE INPUT RINGKAS (PENGISIAN CEPAT DI LAYAR) */}
          {/* ========================================================= */}
          {formDisplayMode === 'compact' && (
            <div className="no-print space-y-5">
              {/* COMPACT FORM 1: POLISI PELAJAR */}
              {currentTab === 'form_polisi_pelajar' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">
                          Formulir Pendaftaran Polisi Pelajar (Poljar)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Pengisian data ringkas & cepat. Data otomatis terformat pada lembar blanko resmi Polri.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                        {formPolisiPelajar.jenjang}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formPolisiPelajar.sekolah || 'Pangkalan Belum Diisi'}
                      </span>
                    </div>
                  </div>

                  {/* Grid Bagian A: Data Siswa & Pangkalan */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>A. Data Identitas Calon Siswa</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Siswa *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.nama}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nama: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Masukkan nama lengkap siswa..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">NISN *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.nisn}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nisn: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0089123456"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. WhatsApp Siswa/Ortu</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.noHp}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, noHp: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="081234567890"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Pangkalan Sekolah</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.sekolah}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, sekolah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Asal sekolah..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                          <select
                            value={formPolisiPelajar.jenjang}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, jenjang: e.target.value as SchoolLevel })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="SLTP">SLTP</option>
                            <option value="SLTA">SLTA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Kelas</label>
                          <input
                            type="text"
                            value={formPolisiPelajar.kelas}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, kelas: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="VII-A / X-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Tempat, Tanggal Lahir</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.ttl}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, ttl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Majalengka, 15 Januari 2012"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenis Kelamin</label>
                          <select
                            value={formPolisiPelajar.jk}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, jk: e.target.value })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Laki-Laki">Laki-Laki</option>
                            <option value="Perempuan">Perempuan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Agama</label>
                          <select
                            value={formPolisiPelajar.agama}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, agama: e.target.value })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Islam">Islam</option>
                            <option value="Kristen">Kristen</option>
                            <option value="Katolik">Katolik</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Buddha">Buddha</option>
                            <option value="Konghucu">Konghucu</option>
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">Alamat Tempat Tinggal</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.alamat}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alamat: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Jl. Pemuda No. 45, Desa/Kelurahan..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Grid Bagian B: Orang Tua & Fisik */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                    {/* B1: Orang Tua / Wali */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                        <span>B. Data Orang Tua / Wali</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Nama Orang Tua / Wali</label>
                          <input
                            type="text"
                            value={formPolisiPelajar.namaOrtu}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, namaOrtu: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                            placeholder="Nama ayah / ibu / wali..."
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Pekerjaan Orang Tua</label>
                          <input
                            type="text"
                            value={formPolisiPelajar.pekerjaanOrtu}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, pekerjaanOrtu: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="PNS / Swasta / Wiraswasta..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* B2: Fisik & Medis */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                        <span>C. Data Fisik & Riwayat Medis</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Tinggi (cm)</label>
                          <input
                            type="number"
                            value={formPolisiPelajar.tinggiBadan}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tinggiBadan: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="165"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Berat (kg)</label>
                          <input
                            type="number"
                            value={formPolisiPelajar.beratBadan}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, beratBadan: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="52"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Gol. Darah</label>
                          <select
                            value={formPolisiPelajar.golDarah}
                            onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, golDarah: e.target.value })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="AB">AB</option>
                            <option value="O">O</option>
                            <option value="-">-</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Riwayat Alergi / Sakit</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.riwayatPenyakit}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, riwayatPenyakit: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Tidak ada / riwayat asma dll..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bagian C: Prestasi & Motivasi */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>D. Prestasi & Motivasi Siswa</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Prestasi yang Pernah Diraih</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.prestasi}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, prestasi: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Contoh: Juara 2 PBB Tingkat Kabupaten..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Alasan / Motivasi Bergabung Polisi Pelajar</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.alasan}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alasan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ingin menegakkan kedisiplinan dan keselamatan lalu lintas..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR (LANJUT BAYAR) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Status Siap Simpan
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            Biaya Registrasi: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          Simpan Formulir & Lanjut ke Pembayaran
                        </h4>
                        <p className="text-xs text-slate-300 max-w-lg">
                          Data tersimpan langsung ke cloud database panitia. Anda dapat langsung membayar atau memilih bayar nanti.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormDisplayMode('blanko')}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>Lihat Blanko A4</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveForLater}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                          <Save className="w-4 h-4 text-slate-400" />
                          <span>Simpan Dulu (Bayar Nanti)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenSubmitAndPay}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 text-emerald-200" />
                              <span>Lanjut Bayar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPACT FORM 2: CALON PKS */}
              {currentTab === 'form_calon_pks' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">
                          Formulir Biodata Calon Anggota PKS
                        </h3>
                        <p className="text-xs text-slate-500">
                          Input mandiri calon anggota Patroli Keamanan Sekolah (PKS) pangkalan.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formCalonPks.jenjang}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formCalonPks.sekolah || 'Pangkalan Belum Diisi'}
                      </span>
                    </div>
                  </div>

                  {/* Section A: Identitas Calon PKS */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span>A. Biodata Calon Anggota PKS</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Siswa *</label>
                        <input
                          type="text"
                          value={formCalonPks.nama}
                          onChange={e => setFormCalonPks({ ...formCalonPks, nama: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Nama lengkap..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">NISN *</label>
                        <input
                          type="text"
                          value={formCalonPks.nisn}
                          onChange={e => setFormCalonPks({ ...formCalonPks, nisn: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0089123456"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. WhatsApp Siswa</label>
                        <input
                          type="text"
                          value={formCalonPks.noHp}
                          onChange={e => setFormCalonPks({ ...formCalonPks, noHp: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="081234567890"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Pangkalan Sekolah</label>
                        <input
                          type="text"
                          value={formCalonPks.sekolah}
                          onChange={e => setFormCalonPks({ ...formCalonPks, sekolah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Asal sekolah..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                          <select
                            value={formCalonPks.jenjang}
                            onChange={e => setFormCalonPks({ ...formCalonPks, jenjang: e.target.value as SchoolLevel })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="SLTP">SLTP</option>
                            <option value="SLTA">SLTA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Kelas</label>
                          <input
                            type="text"
                            value={formCalonPks.kelas}
                            onChange={e => setFormCalonPks({ ...formCalonPks, kelas: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="VII-A / X-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Tempat, Tanggal Lahir</label>
                        <input
                          type="text"
                          value={formCalonPks.ttl}
                          onChange={e => setFormCalonPks({ ...formCalonPks, ttl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Majalengka, 15 Januari 2012"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenis Kelamin</label>
                          <select
                            value={formCalonPks.jk}
                            onChange={e => setFormCalonPks({ ...formCalonPks, jk: e.target.value })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Laki-Laki">Laki-Laki</option>
                            <option value="Perempuan">Perempuan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Agama</label>
                          <select
                            value={formCalonPks.agama}
                            onChange={e => setFormCalonPks({ ...formCalonPks, agama: e.target.value })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Islam">Islam</option>
                            <option value="Kristen">Kristen</option>
                            <option value="Katolik">Katolik</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Buddha">Buddha</option>
                            <option value="Konghucu">Konghucu</option>
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">Alamat Rumah Lengkap</label>
                        <input
                          type="text"
                          value={formCalonPks.alamat}
                          onChange={e => setFormCalonPks({ ...formCalonPks, alamat: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Alamat rumah tinggal..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section B: Minat & Pembina */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                        <span>B. Pembina & Minat Korps PKS</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Nama Guru Pembina PKS</label>
                          <input
                            type="text"
                            value={formCalonPks.namaPembina}
                            onChange={e => setFormCalonPks({ ...formCalonPks, namaPembina: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                            placeholder="Nama guru pembina pangkalan..."
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Divisi Minat PKS</label>
                          <select
                            value={formCalonPks.divisiMinat}
                            onChange={e => setFormCalonPks({ ...formCalonPks, divisiMinat: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Gatur Lantas & Keselamatan Jalan">Gatur Lantas & Keselamatan Jalan</option>
                            <option value="PBB & Tata Upacara Bendera">PBB & Tata Upacara Bendera</option>
                            <option value="Keamanan & Ketertiban Lingkungan Sekolah">Keamanan & Ketertiban Lingkungan Sekolah</option>
                            <option value="Pertolongan Pertama (P3K) & SAR">Pertolongan Pertama (P3K) & SAR</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                        <span>C. Fisik & Pengalaman Organisasi</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Tinggi (cm)</label>
                          <input
                            type="number"
                            value={formCalonPks.tinggiBadan}
                            onChange={e => setFormCalonPks({ ...formCalonPks, tinggiBadan: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="168"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Berat (kg)</label>
                          <input
                            type="number"
                            value={formCalonPks.beratBadan}
                            onChange={e => setFormCalonPks({ ...formCalonPks, beratBadan: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="55"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Gol. Darah</label>
                          <select
                            value={formCalonPks.golDarah}
                            onChange={e => setFormCalonPks({ ...formCalonPks, golDarah: e.target.value })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="AB">AB</option>
                            <option value="O">O</option>
                            <option value="-">-</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Riwayat Organisasi / Ekstrakurikuler</label>
                        <input
                          type="text"
                          value={formCalonPks.riwayatOrganisasi}
                          onChange={e => setFormCalonPks({ ...formCalonPks, riwayatOrganisasi: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Pramuka / PMR / OSIS..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section D: Pernyataan & Izin Ortu */}
                  <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-xl text-xs space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formCalonPks.izinOrtu}
                        onChange={e => setFormCalonPks({ ...formCalonPks, izinOrtu: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300"
                      />
                      <span className="text-slate-800 leading-relaxed">
                        <strong>Persetujuan & Izin Tertulis:</strong> Telah mendapatkan izin dari orang tua/wali serta bersedia mengikuti seluruh tahapan diklat disiplin kepolisian dan mentaati norma Tri Siap dan Panca PKS.
                      </span>
                    </label>
                  </div>

                  {/* BOTTOM ACTION BAR (LANJUT BAYAR) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Status Siap Simpan
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            Biaya Registrasi: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          Simpan Formulir & Lanjut ke Pembayaran
                        </h4>
                        <p className="text-xs text-slate-300 max-w-lg">
                          Data tersimpan langsung ke cloud database panitia. Anda dapat langsung membayar atau memilih bayar nanti.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormDisplayMode('blanko')}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Lihat Blanko A4</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveForLater}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                          <Save className="w-4 h-4 text-slate-400" />
                          <span>Simpan Dulu (Bayar Nanti)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenSubmitAndPay}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 text-emerald-200" />
                              <span>Lanjut Bayar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPACT FORM 3: KEMAH BALOK 1 */}
              {currentTab === 'form_perkemahan_balok1' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">
                          Formulir Pendaftaran Perkemahan & Diklat PKS Balok 1
                        </h3>
                        <p className="text-xs text-slate-500">
                          Pendaftaran regu pangkalan untuk kemah pelantikan kader dasar PKS.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {formBalok1.jenjang}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formBalok1.sekolah || 'Pangkalan Belum Diisi'}
                      </span>
                    </div>
                  </div>

                  {/* Section A: Identitas Regu & Pangkalan */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>A. Identitas Regu Peserta</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Regu / Pleton *</label>
                        <input
                          type="text"
                          value={formBalok1.namaRegu}
                          onChange={e => setFormBalok1({ ...formBalok1, namaRegu: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Regu Rajawali / Melati..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Pangkalan Sekolah</label>
                        <input
                          type="text"
                          value={formBalok1.sekolah}
                          onChange={e => setFormBalok1({ ...formBalok1, sekolah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Asal sekolah..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                          <select
                            value={formBalok1.jenjang}
                            onChange={e => setFormBalok1({ ...formBalok1, jenjang: e.target.value as SchoolLevel })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="SLTP">SLTP</option>
                            <option value="SLTA">SLTA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jumlah Anggota</label>
                          <input
                            type="text"
                            value={formBalok1.jumlahAnggota}
                            onChange={e => setFormBalok1({ ...formBalok1, jumlahAnggota: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="12 Orang"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Ketua Regu / Pinsat</label>
                        <input
                          type="text"
                          value={formBalok1.namaKetua}
                          onChange={e => setFormBalok1({ ...formBalok1, namaKetua: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Nama ketua regu..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Pembina Pendamping</label>
                        <input
                          type="text"
                          value={formBalok1.namaPembina}
                          onChange={e => setFormBalok1({ ...formBalok1, namaPembina: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Nama guru pembina..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. WhatsApp Pembina</label>
                        <input
                          type="text"
                          value={formBalok1.noHpPembina}
                          onChange={e => setFormBalok1({ ...formBalok1, noHpPembina: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="081398765432"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section B: Detail Kegiatan & Administrasi */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span>B. Detail Pelaksanaan Kegiatan Perkemahan</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Kategori Kemah</label>
                        <input
                          type="text"
                          value={formBalok1.kategoriKemah}
                          onChange={e => setFormBalok1({ ...formBalok1, kategoriKemah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Balok 1 (Tingkat Dasar)"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Lokasi Perkemahan</label>
                        <input
                          type="text"
                          value={formBalok1.lokasiPerkemahan}
                          onChange={e => setFormBalok1({ ...formBalok1, lokasiPerkemahan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Bumi Perkemahan..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Waktu Pelaksanaan</label>
                        <input
                          type="text"
                          value={formBalok1.tanggalKegiatan}
                          onChange={e => setFormBalok1({ ...formBalok1, tanggalKegiatan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="12 - 14 Juni 2026"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Status Kesehatan Regu</label>
                        <input
                          type="text"
                          value={formBalok1.statusKesehatan}
                          onChange={e => setFormBalok1({ ...formBalok1, statusKesehatan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Semua anggota sehat..."
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">No. Surat Tugas / Izin Kepala Sekolah</label>
                        <input
                          type="text"
                          value={formBalok1.suratIzinKepsek}
                          onChange={e => setFormBalok1({ ...formBalok1, suratIzinKepsek: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="No. 421.3/089/SMPN1/2026"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR (LANJUT BAYAR) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Status Siap Simpan
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            Biaya Registrasi: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          Simpan Formulir & Lanjut ke Pembayaran
                        </h4>
                        <p className="text-xs text-slate-300 max-w-lg">
                          Data tersimpan langsung ke cloud database panitia. Anda dapat langsung membayar atau memilih bayar nanti.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormDisplayMode('blanko')}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Lihat Blanko A4</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveForLater}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                          <Save className="w-4 h-4 text-slate-400" />
                          <span>Simpan Dulu (Bayar Nanti)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenSubmitAndPay}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 text-emerald-200" />
                              <span>Lanjut Bayar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPACT FORM 4: UJIAN BALOK 2 */}
              {currentTab === 'form_perkemahan_balok2' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                        <Star className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">
                          Formulir Pendaftaran Ujian Balok 2 (Instruktur PKS)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Pengajuan ujian kualifikasi pelatih instruktur muda kepolisian pelajar.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
                        {formBalok2.jenjang}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formBalok2.sekolah || 'Pangkalan Belum Diisi'}
                      </span>
                    </div>
                  </div>

                  {/* Section A: Identitas Peserta */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-purple-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <span>A. Data Calon Instruktur PKS Balok 2</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Peserta *</label>
                        <input
                          type="text"
                          value={formBalok2.namaPeserta}
                          onChange={e => setFormBalok2({ ...formBalok2, namaPeserta: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Nama lengkap peserta..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Pangkalan Sekolah</label>
                        <input
                          type="text"
                          value={formBalok2.sekolah}
                          onChange={e => setFormBalok2({ ...formBalok2, sekolah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Asal sekolah..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                          <select
                            value={formBalok2.jenjang}
                            onChange={e => setFormBalok2({ ...formBalok2, jenjang: e.target.value as SchoolLevel })}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="SLTP">SLTP</option>
                            <option value="SLTA">SLTA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Kelas</label>
                          <input
                            type="text"
                            value={formBalok2.kelas}
                            onChange={e => setFormBalok2({ ...formBalok2, kelas: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="XI-IPS 1 / VIII-B"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Jabatan di Pleton / Unit</label>
                        <input
                          type="text"
                          value={formBalok2.jabatanPleton}
                          onChange={e => setFormBalok2({ ...formBalok2, jabatanPleton: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Danton / Senior PKS"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Pembina Pangkalan</label>
                        <input
                          type="text"
                          value={formBalok2.namaPembina}
                          onChange={e => setFormBalok2({ ...formBalok2, namaPembina: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Nama guru pembina..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section B: Prasyarat Balok 1 & Materi Uji */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-purple-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <span>B. Prasyarat Balok 1 & Pengajuan Materi Uji</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. Sertifikat / Piagam Balok 1</label>
                        <input
                          type="text"
                          value={formBalok2.noSertifikatBalok1}
                          onChange={e => setFormBalok2({ ...formBalok2, noSertifikatBalok1: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="PKS-B1/POLRES-MJL/2025/084"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Tahun Kelulusan Balok 1</label>
                        <input
                          type="text"
                          value={formBalok2.tahunKelulusanBalok1}
                          onChange={e => setFormBalok2({ ...formBalok2, tahunKelulusanBalok1: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="2025"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Rekomendasi Satlantas / Panitia</label>
                        <input
                          type="text"
                          value={formBalok2.rekomendasiSatlantas}
                          onChange={e => setFormBalok2({ ...formBalok2, rekomendasiSatlantas: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Memenuhi Syarat Kualifikasi..."
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-slate-700 font-bold mb-1">Materi Uji Kualifikasi yang Diajukan</label>
                        <input
                          type="text"
                          value={formBalok2.materiUji}
                          onChange={e => setFormBalok2({ ...formBalok2, materiUji: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="12 Gerakan Gatur Lantas, PBB Tongkat, Senam Lantas, Bela Diri Praktis Polri..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR (LANJUT BAYAR) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Status Siap Simpan
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            Biaya Registrasi: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          Simpan Formulir & Lanjut ke Pembayaran
                        </h4>
                        <p className="text-xs text-slate-300 max-w-lg">
                          Data tersimpan langsung ke cloud database panitia. Anda dapat langsung membayar atau memilih bayar nanti.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormDisplayMode('blanko')}
                          className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-400" />
                          <span>Lihat Blanko A4</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveForLater}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                          <Save className="w-4 h-4 text-slate-400" />
                          <span>Simpan Dulu (Bayar Nanti)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenSubmitAndPay}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 text-emerald-200" />
                              <span>Lanjut Bayar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

      {/* ========================================================= */}
      {/* 2. LEMBAR PRATINJAU BLANGKO RESMI A4 (CETAK RESMI POLRI)  */}
      {/* ========================================================= */}
      <div className={`${formDisplayMode === 'compact' ? 'hidden print:block' : 'block'} bg-white max-w-4xl mx-auto rounded-2xl shadow-md border border-slate-200 p-6 sm:p-10 text-slate-800 print:shadow-none print:border-none print:p-0 print:max-w-none`}>
        {/* Banner Informational saat di mode Blanko */}
        <div className="no-print mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Pratinjau Lembar Blanko Cetak A4:</strong> Format resmi standar kepolisian untuk berkas fisik.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormDisplayMode('compact')}
            className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Kembali ke Input Ringkas
          </button>
        </div>

        {renderKopSurat()}

        {/* ========================================================= */}
        {/* FORM 1: FORMULIR PENDAFTARAN POLISI PELAJAR (POLJAR) */}
        {/* ========================================================= */}
        {currentTab === 'form_polisi_pelajar' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                {blankoConfig?.forms?.polisi_pelajar?.judul || 'FORMULIR PENDAFTARAN ANGGOTA POLISI PELAJAR (POLJAR)'}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Nomor Registrasi: {blankoConfig?.forms?.polisi_pelajar?.nomorPrefix || 'POLJAR/2026/01-REG'}
              </p>
            </div>

            {/* Bagian A: Data Identitas Siswa */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                A. Identitas Calon Anggota Polisi Pelajar
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Lengkap Siswa</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.nama}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nama: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    placeholder="Nama lengkap..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">NISN (Nomor Induk Siswa Nasional)</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.nisn}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nisn: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="Contoh: 0089123456"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Asal Sekolah</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.sekolah}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, sekolah: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    placeholder="Nama sekolah..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Jenjang</label>
                    <select
                      value={formPolisiPelajar.jenjang}
                      onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, jenjang: e.target.value as SchoolLevel })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white font-bold"
                    >
                      <option value="SLTP">SLTP (SMP/MTs)</option>
                      <option value="SLTA">SLTA (SMA/SMK)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Kelas</label>
                    <input
                      type="text"
                      value={formPolisiPelajar.kelas}
                      onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, kelas: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                      placeholder="VIII-A / X-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tempat, Tanggal Lahir</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.ttl}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, ttl: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Majalengka, 15 Januari 2012"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Jenis Kelamin</label>
                    <select
                      value={formPolisiPelajar.jk}
                      onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, jk: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white"
                    >
                      <option value="Laki-Laki">Laki-Laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Agama</label>
                    <input
                      type="text"
                      value={formPolisiPelajar.agama}
                      onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, agama: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                      placeholder="Islam / Kristen / dsb"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Alamat Lengkap Tempat Tinggal</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.alamat}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alamat: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Alamat lengkap siswa..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">No. Handphone / WhatsApp</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.noHp}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, noHp: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="081234567890"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.namaOrtu}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, namaOrtu: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Nama orang tua / wali..."
                  />
                </div>
              </div>
            </div>

            {/* Bagian B: Data Fisik & Riwayat Kesehatan */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                B. Keterangan Fisik & Kesehatan
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tinggi Badan (cm)</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.tinggiBadan}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tinggiBadan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="165"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Berat Badan (kg)</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.beratBadan}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, beratBadan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="52"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Golongan Darah</label>
                  <select
                    value={formPolisiPelajar.golDarah}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, golDarah: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white font-bold"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                    <option value="-">-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Riwayat Alergi/Sakit</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.riwayatPenyakit}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, riwayatPenyakit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Tidak ada"
                  />
                </div>
              </div>
            </div>

            {/* Bagian C: Motivasi & Prestasi */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                C. Prestasi & Motivasi
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Prestasi yang Pernah Diraih</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.prestasi}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, prestasi: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Prestasi akademik / non-akademik..."
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Alasan Ingin Bergabung Menjadi Polisi Pelajar</label>
                  <textarea
                    rows={2}
                    value={formPolisiPelajar.alasan}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alasan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none resize-none"
                    placeholder="Alasan motivasi..."
                  />
                </div>
              </div>
            </div>

            {/* Blok Tanda Tangan Resmi */}
            <div className="pt-6 border-t border-slate-300 text-xs text-center">
              <div className="text-right text-[11px] text-slate-500 mb-6">
                {blankoConfig?.kopSurat?.kotaTtd || 'Majalengka'}, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-slate-600">Pemohon,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.polisi_pelajar?.ttd1Label || 'Calon Anggota Polisi Pelajar'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan Siswa)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formPolisiPelajar.nama || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengetahui,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.polisi_pelajar?.ttd2Label || 'Pembina PKS Pangkalan'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Stempel Sekolah)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    ...........................................
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengesahkan,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.polisi_pelajar?.ttd3Label || 'Kasat Lantas Polres'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan & Cap)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {blankoConfig?.forms?.polisi_pelajar?.ttd3Nama || 'AKP Mochamad Ali, S.H., M.M.'}
                  </p>
                  {blankoConfig?.forms?.polisi_pelajar?.ttd3Nrp && (
                    <p className="text-[10px] text-slate-500 font-mono">{blankoConfig.forms.polisi_pelajar.ttd3Nrp}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FORM 2: FORMULIR PENDAFTARAN CALON ANGGOTA PKS */}
        {/* ========================================================= */}
        {currentTab === 'form_calon_pks' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                {blankoConfig?.forms?.calon_pks?.judul || 'FORMULIR BIODATA CALON ANGGOTA PATROLI KEAMANAN SEKOLAH (PKS)'}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Nomor Registrasi: {blankoConfig?.forms?.calon_pks?.nomorPrefix || 'PKS-CAP/2026/REG-01'}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-300 pb-1">
                A. Data Biodata Calon Anggota PKS
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Lengkap Siswa</label>
                  <input
                    type="text"
                    value={formCalonPks.nama}
                    onChange={e => setFormCalonPks({ ...formCalonPks, nama: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">NISN</label>
                  <input
                    type="text"
                    value={formCalonPks.nisn}
                    onChange={e => setFormCalonPks({ ...formCalonPks, nisn: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Pangkalan Sekolah</label>
                  <input
                    type="text"
                    value={formCalonPks.sekolah}
                    onChange={e => setFormCalonPks({ ...formCalonPks, sekolah: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Tingkat</label>
                    <select
                      value={formCalonPks.jenjang}
                      onChange={e => setFormCalonPks({ ...formCalonPks, jenjang: e.target.value as SchoolLevel })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                    >
                      <option value="SLTP">SLTP</option>
                      <option value="SLTA">SLTA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Kelas</label>
                    <input
                      type="text"
                      value={formCalonPks.kelas}
                      onChange={e => setFormCalonPks({ ...formCalonPks, kelas: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tempat, Tanggal Lahir</label>
                  <input
                    type="text"
                    value={formCalonPks.ttl}
                    onChange={e => setFormCalonPks({ ...formCalonPks, ttl: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Divisi Minat PKS</label>
                  <select
                    value={formCalonPks.divisiMinat}
                    onChange={e => setFormCalonPks({ ...formCalonPks, divisiMinat: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="Gatur Lantas & Keselamatan Jalan">Gatur Lantas & Keselamatan Jalan</option>
                    <option value="PBB & Tata Upacara Bendera">PBB & Tata Upacara Bendera</option>
                    <option value="Keamanan & Ketertiban Lingkungan Sekolah">Keamanan & Ketertiban Lingkungan Sekolah</option>
                    <option value="Pertolongan Pertama (P3K) & SAR">Pertolongan Pertama (P3K) & SAR</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Alamat Rumah Lengkap</label>
                  <input
                    type="text"
                    value={formCalonPks.alamat}
                    onChange={e => setFormCalonPks({ ...formCalonPks, alamat: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">No. WhatsApp Siswa</label>
                  <input
                    type="text"
                    value={formCalonPks.noHp}
                    onChange={e => setFormCalonPks({ ...formCalonPks, noHp: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Guru Pembina PKS</label>
                  <input
                    type="text"
                    value={formCalonPks.namaPembina}
                    onChange={e => setFormCalonPks({ ...formCalonPks, namaPembina: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Surat Pernyataan / Izin Ortu */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formCalonPks.izinOrtu}
                  onChange={e => setFormCalonPks({ ...formCalonPks, izinOrtu: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-slate-700 leading-relaxed">
                  <strong>Pernyataan Kesiapan:</strong> Dengan ini saya menyatakan bersedia mengikuti seluruh tahapan latihan dasar disiplin, mentaati Tri Siap dan Panca PKS, serta telah mendapatkan izin tertulis dari orang tua/wali untuk bergabung aktif dalam Korps PKS.
                </span>
              </label>
            </div>

            {/* Signature Block */}
            <div className="pt-6 border-t border-slate-300 text-xs text-center">
              <div className="text-right text-[11px] text-slate-500 mb-6">
                {blankoConfig?.kopSurat?.kotaTtd || 'Majalengka'}, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-slate-600">Pemohon,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.calon_pks?.ttd1Label || 'Calon Anggota PKS'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formCalonPks.nama || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengetahui,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.calon_pks?.ttd2Label || 'Pembina PKS Pangkalan'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Stempel & TTD)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formCalonPks.namaPembina || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengesahkan,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.calon_pks?.ttd3Label || 'Kanit Kamsel Satlantas Polres'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan & Cap)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {blankoConfig?.forms?.calon_pks?.ttd3Nama || 'Ipda Supriatna'}
                  </p>
                  {blankoConfig?.forms?.calon_pks?.ttd3Nrp && (
                    <p className="text-[10px] text-slate-500 font-mono">{blankoConfig.forms.calon_pks.ttd3Nrp}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FORM 3: FORMULIR PENDAFTARAN PERKEMAHAN PKS BALOK 1 */}
        {/* ========================================================= */}
        {currentTab === 'form_perkemahan_balok1' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                FORMULIR PENDAFTARAN PERKEMAHAN PKS BALOK 1
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                DIKLAT KADERISASI DASAR KEPOLISIAN SEKOLAH TINGKAT BALOK 1
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-slate-300 pb-1">
                A. Data Regu / Kontingen Sekolah
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Regu / Pleton</label>
                  <input
                    type="text"
                    value={formBalok1.namaRegu}
                    onChange={e => setFormBalok1({ ...formBalok1, namaRegu: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                    placeholder="Contoh: Regu Elang Sakti"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Pangkalan Asal Sekolah</label>
                  <input
                    type="text"
                    value={formBalok1.sekolah}
                    onChange={e => setFormBalok1({ ...formBalok1, sekolah: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Ketua Regu (Pinru)</label>
                  <input
                    type="text"
                    value={formBalok1.namaKetua}
                    onChange={e => setFormBalok1({ ...formBalok1, namaKetua: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Jumlah Anggota Regu</label>
                  <input
                    type="text"
                    value={formBalok1.jumlahAnggota}
                    onChange={e => setFormBalok1({ ...formBalok1, jumlahAnggota: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                    placeholder="12 Orang"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Pembina Pendamping</label>
                  <input
                    type="text"
                    value={formBalok1.namaPembina}
                    onChange={e => setFormBalok1({ ...formBalok1, namaPembina: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">No. Kontak WhatsApp Pembina</label>
                  <input
                    type="text"
                    value={formBalok1.noHpPembina}
                    onChange={e => setFormBalok1({ ...formBalok1, noHpPembina: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Lokasi Bumi Perkemahan</label>
                  <input
                    type="text"
                    value={formBalok1.lokasiPerkemahan}
                    onChange={e => setFormBalok1({ ...formBalok1, lokasiPerkemahan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Jadwal Tanggal Pelaksanaan</label>
                  <input
                    type="text"
                    value={formBalok1.tanggalKegiatan}
                    onChange={e => setFormBalok1({ ...formBalok1, tanggalKegiatan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">No. Surat Mandat / Izin Kepala Sekolah</label>
                  <input
                    type="text"
                    value={formBalok1.suratIzinKepsek}
                    onChange={e => setFormBalok1({ ...formBalok1, suratIzinKepsek: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="Contoh: No. 421.3/089/SMPN1/2026"
                  />
                </div>
              </div>
            </div>

            {/* Checklist Kelengkapan Regu */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1.5">
              <span className="font-bold text-emerald-950 block">Kelengkapan Wajib Peserta Kemah Balok 1:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Seragam Lengkap PKS & Rompi Gatur Lantas
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Perlengkapan Tenda & Kebersihan Regu
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Peluit & Tongkat Morse/PBB Lapangan
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Kotak P3K Regu Standar
                </span>
              </div>
            </div>

            {/* Signature Block */}
            <div className="pt-6 border-t border-slate-300 text-xs text-center">
              <div className="text-right text-[11px] text-slate-500 mb-6">
                Majalengka, .................................... 2026
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-slate-600">Ketua Regu PKS,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formBalok1.namaKetua || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Pembina Pendamping,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formBalok1.namaPembina || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengetahui Kepala Sekolah,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Stempel & TTD Kepsek)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    ...........................................
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FORM 4: FORMULIR PENDAFTARAN PKS BALOK 2 */}
        {/* ========================================================= */}
        {currentTab === 'form_perkemahan_balok2' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                FORMULIR PENDAFTARAN PKS BALOK 2 (UJIAN INSTRUKTUR)
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                KUALIFIKASI INSTRUKTUR & PELATIH MUDA POLISI PELAJAR
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-slate-300 pb-1">
                A. Data Calon Instruktur PKS Balok 2
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Nama Lengkap Peserta</label>
                  <input
                    type="text"
                    value={formBalok2.namaPeserta}
                    onChange={e => setFormBalok2({ ...formBalok2, namaPeserta: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Asal Sekolah</label>
                  <input
                    type="text"
                    value={formBalok2.sekolah}
                    onChange={e => setFormBalok2({ ...formBalok2, sekolah: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Jenjang</label>
                    <select
                      value={formBalok2.jenjang}
                      onChange={e => setFormBalok2({ ...formBalok2, jenjang: e.target.value as SchoolLevel })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                    >
                      <option value="SLTA">SLTA (SMA/SMK)</option>
                      <option value="SLTP">SLTP (Tingkat Lanjut)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Kelas</label>
                    <input
                      type="text"
                      value={formBalok2.kelas}
                      onChange={e => setFormBalok2({ ...formBalok2, kelas: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Jabatan di Pleton / Unit</label>
                  <input
                    type="text"
                    value={formBalok2.jabatanPleton}
                    onChange={e => setFormBalok2({ ...formBalok2, jabatanPleton: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Komandan Pleton / Senior"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">No. Sertifikat / Piagam Balok 1</label>
                  <input
                    type="text"
                    value={formBalok2.noSertifikatBalok1}
                    onChange={e => setFormBalok2({ ...formBalok2, noSertifikatBalok1: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                    placeholder="Contoh: PKS-B1/POLRES/2025/084"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tahun Kelulusan Balok 1</label>
                  <input
                    type="text"
                    value={formBalok2.tahunKelulusanBalok1}
                    onChange={e => setFormBalok2({ ...formBalok2, tahunKelulusanBalok1: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono outline-none"
                    placeholder="2025"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Materi Uji Kualifikasi yang Diajukan</label>
                  <input
                    type="text"
                    value={formBalok2.materiUji}
                    onChange={e => setFormBalok2({ ...formBalok2, materiUji: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Rekomendasi Satlantas / Unit Dikmas</label>
                  <input
                    type="text"
                    value={formBalok2.rekomendasiSatlantas}
                    onChange={e => setFormBalok2({ ...formBalok2, rekomendasiSatlantas: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Signature Block */}
            <div className="pt-6 border-t border-slate-300 text-xs text-center">
              <div className="text-right text-[11px] text-slate-500 mb-6">
                Majalengka, .................................... 2026
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-slate-600">Peserta Ujian Balok 2,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formBalok2.namaPeserta || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Pembina PKS Pangkalan,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Stempel & TTD)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formBalok2.namaPembina || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Tim Penguji Satlantas Polri,</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan Penguji)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    ...........................................
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Submit Floating / Bottom Bar */}
      <div className="no-print max-w-4xl mx-auto bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div>
          <p className="text-xs text-slate-300 font-semibold">Formulir telah selesai diisi?</p>
          <p className="text-sm font-black text-white">
            Kirim ke Panitia & Bayar Registrasi ({currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)})
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSaveForLater}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-400" />
            <span>Simpan Dulu (Bayar Nanti)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSubmitAndPay}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-75 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 text-emerald-200" />
                <span>Lanjut Bayar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  ) : (
    /* ========================================================= */
    /* VIEW MODE: RIWAYAT PENDAFTARAN & TAGIHAN SEKOLAH SAYA */
    /* ========================================================= */
    <div className="space-y-6">
      {/* School Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Formulir</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{mySchoolSubmissions.length}</span>
            <span className="text-xs text-slate-500">Berkas</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Diajukan mandiri</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Lunas & Disahkan</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-600">
              {mySchoolSubmissions.filter(s => s.paymentStatus === 'paid' && s.stage2Committee?.status === 'approved').length}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">Peserta</span>
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">Siap tampil lomba</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Menunggu Verifikasi</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600">
              {mySchoolSubmissions.filter(s => s.paymentStatus === 'pending_verification' || (s.paymentStatus === 'paid' && s.stage2Committee?.status !== 'approved')).length}
            </span>
            <span className="text-xs text-amber-600 font-semibold">Proses</span>
          </div>
          <p className="text-[11px] text-amber-600/80 mt-1">Keuangan / Panitia</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Belum Bayar</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-600">
              {mySchoolSubmissions.filter(s => s.paymentStatus === 'unpaid').length}
            </span>
            <span className="text-xs text-rose-600 font-semibold">Tagihan</span>
          </div>
          <p className="text-[11px] text-rose-600/80 mt-1">Bisa bayar langsung</p>
        </div>
      </div>

      {/* Table of Submissions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Daftar Pengajuan Pendaftaran & Status Pembayaran
            </h3>
            <p className="text-xs text-slate-500">
              Riwayat penginputan formulir oleh akun sekolah dengan pembaruan status real-time dari panitia.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('form')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>+ Buat Pendaftaran Baru</span>
          </button>
        </div>

        {mySchoolSubmissions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Belum Ada Formulir yang Diajukan</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Akun sekolah Anda belum menginput formulir pendaftaran. Pilih formulir (Polisi Pelajar, Calon PKS, Kemah Balok 1, atau Ujian Balok 2) dan klik "Kirim & Bayar Pendaftaran".
            </p>
            <button
              type="button"
              onClick={() => setViewMode('form')}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              Mulai Isi Formulir Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">No</th>
                  <th className="p-3">Formulir & Peserta</th>
                  <th className="p-3">Jenjang</th>
                  <th className="p-3">Biaya Registrasi</th>
                  <th className="p-3">Metode & Status Bayar</th>
                  <th className="p-3">Verifikasi Keuangan (T-1)</th>
                  <th className="p-3">Pengesahan Panitia (T-2)</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mySchoolSubmissions.map((sub, idx) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{sub.applicantName}</div>
                      <div className="text-[11px] text-blue-600 font-semibold">{sub.formTitle}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {sub.id}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {sub.schoolLevel}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {sub.feeAmount === 0 ? 'Gratis' : formatRupiah(sub.feeAmount)}
                    </td>
                    <td className="p-3">
                      {sub.paymentStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Lunas
                        </span>
                      )}
                      {sub.paymentStatus === 'pending_verification' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Verifikasi
                        </span>
                      )}
                      {sub.paymentStatus === 'unpaid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Belum Bayar
                        </span>
                      )}
                      <div className="text-[10px] text-slate-500 mt-0.5 uppercase">
                        {sub.paymentMethod === 'free' ? 'Bebas Biaya' : sub.paymentMethod.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="p-3">
                      {sub.stage1Finance?.status === 'approved' ? (
                        <div className="text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Disetujui</span>
                        </div>
                      ) : sub.stage1Finance?.status === 'rejected' ? (
                        <div className="text-rose-700 font-bold flex items-center gap-1">
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>Ditolak</span>
                        </div>
                      ) : (
                        <div className="text-amber-700 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pengecekan</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {sub.stage1Finance?.verifiedBy || 'Admin Keuangan'}
                      </div>
                    </td>
                    <td className="p-3">
                      {sub.stage2Committee?.status === 'approved' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Disahkan
                          </span>
                          {(sub.stage2Committee?.officialNumber || sub.stage2Committee?.registrationNumber || sub.registrationNumber) && (
                            <div className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-1 inline-block">
                              {sub.stage2Committee?.officialNumber || sub.stage2Committee?.registrationNumber || sub.registrationNumber}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Menunggu T-1</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {sub.paymentStatus === 'unpaid' && sub.feeAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingSubmissionPayload(sub);
                            setProofFileBase64('');
                            setProofFileName('');
                            setSimulatedGatewaySuccess(false);
                            setPayNowChoice('pay_now');
                            setPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Bayar Sekarang</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* ========================================================= */}
  {/* MODAL: PILIHAN PEMBAYARAN & PAYMENT GATEWAY SEKOLAH */}
  {/* ========================================================= */}
  {paymentModalOpen && pendingSubmissionPayload && (
    <div className="no-print fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                Pembayaran Pendaftaran Formulir
              </h3>
              <p className="text-xs text-slate-300">
                {pendingSubmissionPayload.formTitle} • {pendingSubmissionPayload.applicantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPaymentModalOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Bill Summary Banner */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Total Tagihan Registrasi</p>
              <p className="text-xs text-slate-600 mt-0.5">Asal: {pendingSubmissionPayload.schoolName}</p>
            </div>
            <div className="text-right">
              <span className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                {formatRupiah(pendingSubmissionPayload.feeAmount)}
              </span>
            </div>
          </div>

          {/* Flexible Flow Option (Bayar Sekarang vs Simpan Dulu & Bayar Nanti) */}
          <div className="space-y-1.5">
            <label className="block text-slate-800 font-bold">Waktu Pembayaran:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayNowChoice('pay_now')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  payNowChoice === 'pay_now'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold ring-2 ring-blue-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${payNowChoice === 'pay_now' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Bayar Sekarang</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-normal">
                  Unggah bukti atau gunakan gateway online otomatis.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPayNowChoice('pay_later')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  payNowChoice === 'pay_later'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${payNowChoice === 'pay_later' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Simpan & Bayar Nanti</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-normal">
                  Simpan data formulir sekarang, lakukan transfer nanti di menu riwayat.
                </p>
              </button>
            </div>
          </div>

          {payNowChoice === 'pay_now' && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <label className="block text-slate-800 font-bold">Pilih Kanal / Metode Pembayaran:</label>

              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('midtrans')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedPayMethod === 'midtrans'
                      ? 'border-blue-600 bg-blue-600 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-[11px] font-bold">Midtrans</div>
                  <div className={`text-[9px] ${selectedPayMethod === 'midtrans' ? 'text-blue-100' : 'text-slate-400'}`}>Snap Gateway</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('ratapay')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedPayMethod === 'ratapay'
                      ? 'border-indigo-600 bg-indigo-600 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-[11px] font-bold">Ratapay</div>
                  <div className={`text-[9px] ${selectedPayMethod === 'ratapay' ? 'text-indigo-100' : 'text-slate-400'}`}>Gerbang PKS</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('qris')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedPayMethod === 'qris'
                      ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <QrCode className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-[11px] font-bold">QRIS Statis</div>
                  <div className={`text-[9px] ${selectedPayMethod === 'qris' ? 'text-emerald-100' : 'text-slate-400'}`}>Scan & Upload</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('bank_transfer')}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedPayMethod === 'bank_transfer'
                      ? 'border-purple-600 bg-purple-600 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-[11px] font-bold">Transfer Bank</div>
                  <div className={`text-[9px] ${selectedPayMethod === 'bank_transfer' ? 'text-purple-100' : 'text-slate-400'}`}>Manual Bank</div>
                </button>
              </div>

              {/* METHOD 1: MIDTRANS */}
              {selectedPayMethod === 'midtrans' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Midtrans Payment Gateway</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Snap Pop-up
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Mendukung pembayaran instan melalui QRIS GoPay, OVO, ShopeePay, serta Virtual Account Bank BCA, BNI, BRI, dan Bank Mandiri.
                  </p>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Status Gateway</p>
                      <p className="text-[11px] text-emerald-600 font-semibold">Tersambung (Mode Sandbox / Production Ready)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSimulatedGatewaySuccess(true);
                        showToast('Simulasi Midtrans berhasil! Menunggu konfirmasi kirim.', 'info');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {simulatedGatewaySuccess ? '✓ Terverifikasi Online' : 'Buka Pop-up Snap'}
                    </button>
                  </div>
                </div>
              )}

              {/* METHOD 2: RATAPAY */}
              {selectedPayMethod === 'ratapay' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Ratapay Gateway Komunitas</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      Auto Settlement
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sistem pembayaran instan yang terintegrasi dengan rekening kas panitia PKS Polres Majalengka.
                  </p>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">Kanal Ratapay</p>
                      <p className="text-[11px] text-slate-500">Merchant ID: PKS-RESMAJALENGKA-01</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSimulatedGatewaySuccess(true);
                        showToast('Integrasi Ratapay siap diproses!', 'info');
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {simulatedGatewaySuccess ? '✓ Token Dibuat' : 'Generate Checkout'}
                    </button>
                  </div>
                </div>
              )}

              {/* METHOD 3: QRIS STATIS */}
              {selectedPayMethod === 'qris' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">QRIS Statis Panitia</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      NMID Terverifikasi
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
                    <div className="w-32 h-32 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center p-2 shrink-0">
                      <QrCode className="w-20 h-20 text-white" />
                      <span className="text-[9px] font-bold tracking-wider text-slate-300">QRIS RESMI PKS</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <p className="font-bold text-slate-900">
                        {paymentConfig?.qris?.merchantName || 'SATLANTAS POLRES MAJALENGKA - KORPS PKS'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        NMID: ID102026889218 • Status: Aktif
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {paymentConfig?.qris?.instruction || '1. Scan kode QR dengan aplikasi m-Banking atau e-Wallet.'}<br />
                        Nominal tagihan: <strong className="font-mono text-slate-900">{formatRupiah(pendingSubmissionPayload.feeAmount)}</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Upload Proof */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-slate-800 font-bold">Unggah Bukti Struk Transaksi QRIS:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofImageChange}
                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                    </div>
                    {proofFileName && (
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Berkas terpilih: {proofFileName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* METHOD 4: TRANSFER MANUAL BANK */}
              {selectedPayMethod === 'bank_transfer' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Rekening Bank Panitia Resmi</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                      Verifikasi 2-Tahap
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">
                            {paymentConfig?.bankTransfer?.bankName || 'Bank Mandiri'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            a.n {paymentConfig?.bankTransfer?.accountHolder || 'Panitia Pelaksana Lomba PKS'}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-blue-900 text-xs sm:text-sm mt-0.5">
                          {paymentConfig?.bankTransfer?.accountNumber || '137-00-9876543-2'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const acc = paymentConfig?.bankTransfer?.accountNumber || '137-00-9876543-2';
                          navigator.clipboard.writeText(acc);
                          showToast(`Nomor rekening ${paymentConfig?.bankTransfer?.bankName || 'Bank'} disalin!`, 'success');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Salin</span>
                      </button>
                    </div>

                    {paymentConfig?.bankTransfer?.instruction && (
                      <p className="text-[11px] text-slate-500 italic">
                        {paymentConfig.bankTransfer.instruction}
                      </p>
                    )}
                  </div>

                  {/* Upload Slip Proof */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-slate-800 font-bold">Unggah Foto Bukti Transfer Bank:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofImageChange}
                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                    </div>
                    {proofFileName && (
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Berkas terpilih: {proofFileName}
                      </p>
                    )}
                    {proofFileBase64 && (
                      <div className="mt-2 w-28 h-20 rounded-lg overflow-hidden border border-slate-300">
                        <img src={proofFileBase64} alt="Bukti Transfer" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification notice */}
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600 text-[11px]">
            <strong>Catatan Verifikasi Dua Tahap:</strong>
            <p className="mt-0.5">
              1. <em>Tahap 1 (Admin Keuangan):</em> Mengecek kesesuaian mutasi rekening / payment gateway.<br />
              2. <em>Tahap 2 (Panitia Pelaksana):</em> Mengesahkan status kepesertaan & menerbitkan Nomor Registrasi Resmi lomba.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setPaymentModalOpen(false)}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmPaymentAndSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan ke Cloud...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{payNowChoice === 'pay_later' ? 'Simpan & Bayar Nanti' : 'Konfirmasi & Kirim Bukti'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
);
};

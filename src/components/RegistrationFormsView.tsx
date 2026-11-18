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
  FileCheck2,
  User,
  Users,
  Utensils,
  MapPin,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Send,
  AlertCircle
} from 'lucide-react';
import {
  saveRegistrationToCloud,
  PaymentConfig,
  FormFeeConfig,
  DEFAULT_PAYMENT_CONFIG,
  RegistrationSubmission,
  InstallmentPaymentRecord,
  BlankoConfig,
  DEFAULT_BLANKO_CONFIG,
  generateNomorIndukPoljar,
  normalizeAngkatanCode
} from '../lib/firebase';
import { AppUser, CalonPksStudentItem, CampBalokFormData } from '../App';
import { compressImageFile } from '../lib/imageUtils';
import { NetworkErrorBanner, NetworkErrorState } from './NetworkErrorBanner';

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
    tanggalLahir: string;
    jk: string;
    tinggiBadan: string;
    beratBadan: string;
    alamat: string;
    golDarah: string;
    alergi: string;
    sekolah: string;
    jenjang: SchoolLevel;
    riwayatPenyakit?: string;
  };
  setFormPolisiPelajar: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormPolisiPelajarExcel: () => void;

  formCalonPks: {
    sekolah: string;
    jenjang: SchoolLevel;
    students: CalonPksStudentItem[];
  };
  setFormCalonPks: React.Dispatch<React.SetStateAction<any>>;
  handleExportFormCalonPksExcel: () => void;

  formBalok1: CampBalokFormData;
  setFormBalok1: React.Dispatch<React.SetStateAction<CampBalokFormData>>;
  handleExportFormBalok1Excel: () => void;

  formBalok2: CampBalokFormData;
  setFormBalok2: React.Dispatch<React.SetStateAction<CampBalokFormData>>;
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
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<'cash' | 'installment'>('cash');
  const [customPayAmount, setCustomPayAmount] = useState<number>(0);
  const [proofFileBase64, setProofFileBase64] = useState<string>('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [simulatedGatewaySuccess, setSimulatedGatewaySuccess] = useState(false);
  const [pendingSubmissionPayload, setPendingSubmissionPayload] = useState<RegistrationSubmission | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'save_later' | 'pay_now' | 'pay_modal' | null>(null);
  const isSubmitting = submittingAction !== null;
  const [networkError, setNetworkError] = useState<NetworkErrorState | null>(null);
  const [collapsedStudents, setCollapsedStudents] = useState<Record<string, boolean>>({});

  const poljarSettings = useMemo(() => ({
    ...DEFAULT_PAYMENT_CONFIG.poljarSettings!,
    ...(paymentConfig?.poljarSettings || {})
  }), [paymentConfig]);

  const livePoljarNipp = useMemo(() => {
    return generateNomorIndukPoljar(
      poljarSettings.tahunAngkatan,
      poljarSettings.angkatan,
      formPolisiPelajar.tanggalLahir
    );
  }, [poljarSettings.tahunAngkatan, poljarSettings.angkatan, formPolisiPelajar.tanggalLahir]);

  useEffect(() => {
    setNetworkError(null);
  }, [currentTab, viewMode]);

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
        setFormPolisiPelajar((prev: any) => ({
          ...prev,
          sekolah: sch,
          jenjang: lvl
        }));
        setFormCalonPks((prev: any) => ({ ...prev, sekolah: sch, jenjang: lvl }));
        setFormBalok1(prev => ({
          ...prev,
          sekolah: sch,
          jenjang: lvl
        }));
        setFormBalok2(prev => ({
          ...prev,
          sekolah: sch,
          jenjang: lvl
        }));
      }
    }
  }, [currentUser]);

  const syncCampNames = (count: number, currentNames: string[] = []): string[] => {
    const safeCount = Math.max(0, Math.min(100, Math.round(Number(count) || 0)));
    return Array.from({ length: safeCount }, (_, i) => String(currentNames[i] ?? ''));
  };

  const updateCampState = (
    setter: React.Dispatch<React.SetStateAction<CampBalokFormData>>,
    patch: {
      sekolah?: string;
      jenjang?: SchoolLevel;
      maleCount?: number;
      femaleCount?: number;
      mealCount?: number;
      maleNameIndex?: number;
      maleNameValue?: string;
      femaleNameIndex?: number;
      femaleNameValue?: string;
    }
  ) => {
    setter(prev => {
      const nextMaleCount =
        patch.maleCount !== undefined
          ? Math.max(0, Math.min(100, Math.round(Number(patch.maleCount) || 0)))
          : Math.max(0, Math.min(100, Math.round(Number(prev.maleCount) || 0)));
      const nextFemaleCount =
        patch.femaleCount !== undefined
          ? Math.max(0, Math.min(100, Math.round(Number(patch.femaleCount) || 0)))
          : Math.max(0, Math.min(100, Math.round(Number(prev.femaleCount) || 0)));

      let nextMaleNames = syncCampNames(nextMaleCount, prev.maleNames);
      let nextFemaleNames = syncCampNames(nextFemaleCount, prev.femaleNames);

      if (patch.maleNameIndex !== undefined && patch.maleNameValue !== undefined) {
        nextMaleNames = nextMaleNames.map((n, idx) => (idx === patch.maleNameIndex ? patch.maleNameValue! : n));
      }
      if (patch.femaleNameIndex !== undefined && patch.femaleNameValue !== undefined) {
        nextFemaleNames = nextFemaleNames.map((n, idx) => (idx === patch.femaleNameIndex ? patch.femaleNameValue! : n));
      }

      const nextTotal = nextMaleCount + nextFemaleCount;
      const rawMeal =
        patch.mealCount !== undefined
          ? Math.round(Number(patch.mealCount) || 0)
          : Math.round(Number(prev.mealCount) || 0);
      const nextMealCount = Math.max(0, Math.min(nextTotal, rawMeal));

      return {
        ...prev,
        ...(patch.sekolah !== undefined ? { sekolah: patch.sekolah } : {}),
        ...(patch.jenjang !== undefined ? { jenjang: patch.jenjang } : {}),
        maleCount: nextMaleCount,
        femaleCount: nextFemaleCount,
        maleNames: nextMaleNames,
        femaleNames: nextFemaleNames,
        mealCount: nextMealCount
      };
    });
  };

  const computeCampFeeBreakdown = (
    formState: CampBalokFormData,
    feeCfg: FormFeeConfig | { fee: number; mealFee?: number; schoolFee?: number; isFree: boolean },
    includeSchoolFee: boolean = false
  ) => {
    const maleCount = Math.max(0, Math.min(100, Math.round(Number(formState.maleCount) || 0)));
    const femaleCount = Math.max(0, Math.min(100, Math.round(Number(formState.femaleCount) || 0)));
    const totalParticipants = maleCount + femaleCount;
    const mealCount = Math.max(0, Math.min(totalParticipants, Math.round(Number(formState.mealCount) || 0)));
    const schoolFee = includeSchoolFee && !feeCfg.isFree
      ? Number(feeCfg.schoolFee ?? DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1.schoolFee ?? 100000)
      : 0;
    const baseUnitFee = feeCfg.isFree ? 0 : Number(feeCfg.fee || 0);
    const mealUnitFee = feeCfg.isFree ? 0 : Number(feeCfg.mealFee ?? 25000);
    const baseSubtotal = totalParticipants * baseUnitFee;
    const mealSubtotal = mealCount * mealUnitFee;
    const grandTotal = schoolFee + baseSubtotal + mealSubtotal;
    return {
      maleCount,
      femaleCount,
      totalParticipants,
      mealCount,
      schoolFee,
      baseUnitFee,
      mealUnitFee,
      baseSubtotal,
      mealSubtotal,
      grandTotal
    };
  };

  // Fee calculation for the active form
  const currentFeeConfig = useMemo(() => {
    const fees = paymentConfig?.formFees || DEFAULT_PAYMENT_CONFIG.formFees;
    if (currentTab === 'form_polisi_pelajar') {
      return { ...DEFAULT_PAYMENT_CONFIG.formFees.polisi_pelajar, ...(fees.polisi_pelajar || {}) };
    }
    if (currentTab === 'form_calon_pks') {
      return { ...DEFAULT_PAYMENT_CONFIG.formFees.calon_pks, ...(fees.calon_pks || {}) };
    }
    if (currentTab === 'form_perkemahan_balok1') {
      return { ...DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1, ...(fees.kemah_balok1 || {}) };
    }
    if (currentTab === 'form_perkemahan_balok2') {
      return { ...DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2, ...(fees.pks_balok2 || {}) };
    }
    return { fee: 0, mealFee: 0, isFree: true, description: '' };
  }, [currentTab, paymentConfig]);

  const calonPksStudentCount = useMemo(() => {
    return Math.max(1, formCalonPks.students?.length || 1);
  }, [formCalonPks.students]);

  const balok1Breakdown = useMemo(() => {
    const cfg = {
      ...DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1,
      ...(paymentConfig?.formFees?.kemah_balok1 || {})
    };
    return computeCampFeeBreakdown(formBalok1, cfg, true);
  }, [formBalok1, paymentConfig]);

  const balok2Breakdown = useMemo(() => {
    const cfg = {
      ...DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2,
      ...(paymentConfig?.formFees?.pks_balok2 || {})
    };
    return computeCampFeeBreakdown(formBalok2, cfg, false);
  }, [formBalok2, paymentConfig]);

  const activeTotalFee = useMemo(() => {
    if (currentFeeConfig.isFree) return 0;
    if (currentTab === 'form_calon_pks') {
      return (currentFeeConfig.fee || 0) * calonPksStudentCount;
    }
    if (currentTab === 'form_perkemahan_balok1') {
      return balok1Breakdown.grandTotal;
    }
    if (currentTab === 'form_perkemahan_balok2') {
      return balok2Breakdown.grandTotal;
    }
    return currentFeeConfig.fee || 0;
  }, [currentFeeConfig, currentTab, calonPksStudentCount, balok1Breakdown, balok2Breakdown]);

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
    let computedFee = currentFeeConfig.isFree ? 0 : currentFeeConfig.fee;
    let nomorIndukPoljar: string | undefined;
    let nippStatus: 'pending_payment' | 'active' | undefined;
    let tahunAngkatan: string | undefined;
    let angkatan: string | undefined;

    if (currentTab === 'form_polisi_pelajar') {
      const nama = (formPolisiPelajar.nama || '').trim();
      const nisn = (formPolisiPelajar.nisn || '').trim();
      const tanggalLahir = (formPolisiPelajar.tanggalLahir || '').trim();
      const alamat = (formPolisiPelajar.alamat || '').trim();
      const tinggiBadan = String(formPolisiPelajar.tinggiBadan || '').trim();
      const beratBadan = String(formPolisiPelajar.beratBadan || '').trim();
      const alergi = (formPolisiPelajar.alergi || formPolisiPelajar.riwayatPenyakit || '').trim();

      if (!nama) {
        showToast('Harap isi Nama Lengkap calon anggota Polisi Pelajar!', 'error');
        return null;
      }
      if (!nisn) {
        showToast('Harap isi NISN calon anggota Polisi Pelajar!', 'error');
        return null;
      }
      if (!tanggalLahir) {
        showToast('Harap isi Tanggal Lahir untuk menghasilkan Nomor Induk Polisi Pelajar (NIPP)!', 'error');
        return null;
      }
      if (!tinggiBadan || !beratBadan || !alamat) {
        showToast('Harap lengkapi Tinggi Badan, Berat Badan, dan Alamat siswa!', 'error');
        return null;
      }

      tahunAngkatan = (poljarSettings.tahunAngkatan || '2026').trim();
      angkatan = normalizeAngkatanCode(poljarSettings.angkatan || '01');
      nomorIndukPoljar = generateNomorIndukPoljar(tahunAngkatan, angkatan, tanggalLahir);
      if (!nomorIndukPoljar) {
        showToast('Tanggal Lahir tidak valid untuk membuat NIPP. Harap periksa kembali.', 'error');
        return null;
      }

      formTitle = blankoConfig?.forms?.polisi_pelajar?.judul || 'Polisi Pelajar (Poljar)';
      formId = `poljar-${nisn.replace(/[^a-zA-Z0-9_-]/g, '') || 'siswa'}-${Date.now().toString().slice(-5)}`;
      applicantName = nama;
      schoolName = (formPolisiPelajar.sekolah || '').trim() || currentUser?.schoolName || currentUser?.name || 'Sekolah';
      schoolLevel = formPolisiPelajar.jenjang || currentUser?.schoolLevel || 'SLTP';
      nippStatus = computedFee === 0 ? 'active' : 'pending_payment';

      formData = {
        nama,
        nisn,
        tanggalLahir,
        jk: formPolisiPelajar.jk || 'Laki-Laki',
        tinggiBadan,
        beratBadan,
        alamat,
        golDarah: formPolisiPelajar.golDarah || 'O',
        alergi: alergi || 'Tidak Ada',
        tahunAngkatan,
        angkatan,
        nomorIndukPoljar,
        sekolah: schoolName,
        jenjang: schoolLevel
      };
    } else if (currentTab === 'form_calon_pks') {
      formTitle = blankoConfig?.forms?.calon_pks?.judul || 'Calon Anggota PKS';
      schoolName = formCalonPks.sekolah.trim() || currentUser?.schoolName || currentUser?.name || '';
      schoolLevel = formCalonPks.jenjang || 'SLTA';

      const students = formCalonPks.students || [];
      if (students.length === 0) {
        showToast('Minimal harus ada 1 data siswa yang didaftarkan!', 'error');
        return null;
      }

      const emptyNameIdx = students.findIndex(st => !st.nama || !st.nama.trim());
      if (emptyNameIdx !== -1) {
        const targetId = students[emptyNameIdx].id;
        setCollapsedStudents(prev => ({ ...prev, [targetId]: false }));
        showToast(`Harap masukkan Nama Lengkap untuk Siswa ${emptyNameIdx + 1}!`, 'error');
        return null;
      }

      if (!schoolName) {
        showToast('Harap isi Nama Pangkalan Sekolah terlebih dahulu!', 'error');
        return null;
      }

      const firstStudentName = students[0].nama.trim();
      applicantName =
        students.length === 1
          ? firstStudentName
          : `${firstStudentName} (+${students.length - 1} siswa lainnya)`;

      const unitFee = currentFeeConfig.isFree ? 0 : currentFeeConfig.fee;
      computedFee = unitFee * students.length;
      formId = `calonpks-${Date.now()}`;
      formData = {
        sekolah: schoolName,
        jenjang: schoolLevel,
        studentCount: students.length,
        unitFee,
        students: students.map((st, idx) => ({
          id: st.id || `siswa-${idx + 1}`,
          nama: st.nama.trim(),
          tempatLahir: st.tempatLahir.trim(),
          tanggalLahir: st.tanggalLahir,
          jk: st.jk || 'Laki-laki'
        }))
      };
    } else if (currentTab === 'form_perkemahan_balok1' || currentTab === 'form_perkemahan_balok2') {
      const isBalok1 = currentTab === 'form_perkemahan_balok1';
      const campState = isBalok1 ? formBalok1 : formBalok2;
      const breakdown = isBalok1 ? balok1Breakdown : balok2Breakdown;

      formTitle = isBalok1
        ? blankoConfig?.forms?.kemah_balok1?.judul || 'Kemah PKS Balok 1'
        : blankoConfig?.forms?.pks_balok2?.judul || 'Ujian PKS Balok 2';
      formId = `${isBalok1 ? 'balok1' : 'balok2'}-${Date.now()}`;
      schoolName = (campState.sekolah || '').trim() || currentUser?.schoolName || currentUser?.name || '';
      schoolLevel = campState.jenjang || currentUser?.schoolLevel || (isBalok1 ? 'SLTP' : 'SLTA');

      if (!schoolName) {
        showToast('Nama Pangkalan Sekolah belum terisi!', 'error');
        return null;
      }

      if (breakdown.totalParticipants < 1) {
        showToast('Harap masukkan minimal 1 peserta Putra atau Putri!', 'error');
        return null;
      }

      const trimmedMaleNames = syncCampNames(breakdown.maleCount, campState.maleNames).map(n => n.trim());
      const emptyMaleIdx = trimmedMaleNames.findIndex(n => !n);
      if (emptyMaleIdx !== -1) {
        showToast(`Harap isi Nama Peserta Laki-laki (Putra) ke-${emptyMaleIdx + 1}!`, 'error');
        return null;
      }

      const trimmedFemaleNames = syncCampNames(breakdown.femaleCount, campState.femaleNames).map(n => n.trim());
      const emptyFemaleIdx = trimmedFemaleNames.findIndex(n => !n);
      if (emptyFemaleIdx !== -1) {
        showToast(`Harap isi Nama Peserta Perempuan (Putri) ke-${emptyFemaleIdx + 1}!`, 'error');
        return null;
      }

      const participants = [
        ...trimmedMaleNames.map((nama, idx) => ({
          id: `putra-${idx + 1}`,
          nama,
          jk: 'Laki-laki' as const,
          genderGroup: 'Putra' as const
        })),
        ...trimmedFemaleNames.map((nama, idx) => ({
          id: `putri-${idx + 1}`,
          nama,
          jk: 'Perempuan' as const,
          genderGroup: 'Putri' as const
        }))
      ];

      computedFee = breakdown.grandTotal;
      applicantName = `${breakdown.totalParticipants} Peserta (${breakdown.maleCount} Putra, ${breakdown.femaleCount} Putri)`;
      formData = {
        sekolah: schoolName,
        jenjang: schoolLevel,
        maleCount: breakdown.maleCount,
        femaleCount: breakdown.femaleCount,
        totalParticipants: breakdown.totalParticipants,
        mealCount: breakdown.mealCount,
        maleNames: trimmedMaleNames,
        femaleNames: trimmedFemaleNames,
        participants,
        ...(isBalok1 ? { schoolFeePerForm: breakdown.schoolFee } : {}),
        baseFeePerParticipant: breakdown.baseUnitFee,
        mealFeePerParticipant: breakdown.mealUnitFee,
        baseSubtotal: breakdown.baseSubtotal,
        mealSubtotal: breakdown.mealSubtotal
      };
    }

    if (!applicantName || !schoolName) {
      showToast('Harap lengkapi nama pendaftar dan asal sekolah terlebih dahulu!', 'error');
      return null;
    }

    const isCashOnlyForm = currentTab === 'form_perkemahan_balok1';
    const minDpPercent = Math.max(10, Math.min(90, Number(poljarSettings.minDpPercent || 30)));
    const minDpAmount = isCashOnlyForm
      ? computedFee
      : computedFee > 0
      ? Math.ceil((computedFee * minDpPercent) / 100)
      : 0;

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
      feeAmount: computedFee,
      paymentMethod: computedFee === 0 ? 'free' : 'midtrans',
      paymentStatus: computedFee === 0 ? 'paid' : 'unpaid',
      paymentPlan: 'cash',
      paidAmount: 0,
      remainingAmount: computedFee,
      minDpAmount,
      pendingPaymentAmount: 0,
      installmentHistory: [],
      ...(nomorIndukPoljar
        ? {
            nomorIndukPoljar,
            nippStatus,
            tahunAngkatan,
            angkatan,
            registrationNumber: nomorIndukPoljar
          }
        : {}),
      stage1Finance: {
        status: computedFee === 0 ? 'approved' : 'pending',
        verifiedBy: computedFee === 0 ? 'Sistem (Bebas Biaya)' : undefined,
        verifiedAt: computedFee === 0 ? new Date().toLocaleString('id-ID') : undefined
      },
      stage2Committee: {
        status: 'pending'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Action: Simpan Dulu (Bayar Nanti)
  const submitDraftPayload = async (payload: RegistrationSubmission) => {
    setSubmittingAction('save_later');
    setNetworkError(null);
    try {
      const res = await saveRegistrationToCloud(payload);
      if (res.success || res.queuedOffline || res.isQuotaError) {
        showToast(
          res.isQuotaError
            ? `Data pendaftaran "${payload.applicantName}" diamankan di Cadangan Server & lokal (kuota Cloud penuh).`
            : res.queuedOffline
            ? `Data pendaftaran "${payload.applicantName}" disimpan offline & akan otomatis dikirim ke Cloud saat online.`
            : `Data pendaftaran "${payload.applicantName}" berhasil disimpan ke Cloud! Anda dapat membayarnya nanti di menu Riwayat & Tagihan Sekolah.`,
          res.queuedOffline || res.isQuotaError ? 'info' : 'success'
        );
        setViewMode('my_submissions');
      } else {
        setNetworkError({
          title: 'Gagal Menyimpan Draf Pendaftaran ke Cloud',
          message: res.error || 'Terjadi gangguan jaringan saat mengirim data pendaftaran.',
          isNetworkError: res.isNetworkError,
          onRetry: () => submitDraftPayload(payload)
        });
        showToast(`Gagal menyimpan data: ${res.error}`, 'error');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSaveForLater = async () => {
    const payload = getFormSubmissionPayload();
    if (!payload) return;

    payload.paymentStatus = 'unpaid';
    await submitDraftPayload(payload);
  };

  const submitFreeRegistrationPayload = async (basePayload: RegistrationSubmission) => {
    setSubmittingAction('pay_now');
    setNetworkError(null);
    try {
      const res = await saveRegistrationToCloud(basePayload);
      if (res.success || res.queuedOffline || res.isQuotaError) {
        showToast(
          res.isQuotaError
            ? `Pendaftaran "${basePayload.applicantName}" diamankan di Cadangan Server & lokal (kuota Cloud penuh).`
            : res.queuedOffline
            ? `Pendaftaran "${basePayload.applicantName}" disimpan offline & akan otomatis tersinkron saat online.`
            : `Pendaftaran "${basePayload.formTitle}" untuk "${basePayload.applicantName}" berhasil dikirim ke panitia!`,
          res.queuedOffline || res.isQuotaError ? 'info' : 'success'
        );
        setViewMode('my_submissions');
      } else {
        setNetworkError({
          title: 'Gagal Mengirim Formulir Pendaftaran ke Cloud',
          message: res.error || 'Terjadi gangguan jaringan saat mengirim formulir pendaftaran.',
          isNetworkError: res.isNetworkError,
          onRetry: () => submitFreeRegistrationPayload(basePayload)
        });
        showToast(`Gagal mengirim pendaftaran: ${res.error}`, 'error');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  // Helper to compute payment modal figures for either initial payment or subsequent installment
  const openPaymentModalForSubmission = (sub: RegistrationSubmission) => {
    const existingPaid = Number(sub.paidAmount || 0);
    const totalFee = Number(sub.feeAmount || 0);
    const remaining = Math.max(0, totalFee - existingPaid);
    const isCashOnlyForm = sub.formType === 'kemah_balok1';
    const allowInst = !isCashOnlyForm && poljarSettings.allowInstallment !== false;
    const minDpPercent = Math.max(10, Math.min(90, Number(poljarSettings.minDpPercent || 30)));
    const minDp = isCashOnlyForm ? totalFee : (sub.minDpAmount || Math.ceil((totalFee * minDpPercent) / 100));

    setNetworkError(null);
    setPendingSubmissionPayload(sub);
    setPayNowChoice('pay_now');
    setProofFileBase64('');
    setProofFileName('');
    setSimulatedGatewaySuccess(false);

    if (existingPaid > 0 && allowInst) {
      // Subsequent installment / settlement
      setSelectedPaymentPlan('installment');
      setCustomPayAmount(remaining);
    } else {
      setSelectedPaymentPlan('cash');
      setCustomPayAmount(allowInst ? Math.min(remaining, minDp) : remaining);
    }
    setPaymentModalOpen(true);
  };

  // Action: Simpan Data & Lanjut Bayar
  const handleOpenSubmitAndPay = () => {
    const basePayload = getFormSubmissionPayload();
    if (!basePayload) return;

    const fee = basePayload.feeAmount;

    if (fee === 0) {
      // Free form -> save immediately
      void submitFreeRegistrationPayload(basePayload);
    } else {
      openPaymentModalForSubmission(basePayload);
    }
  };

  // Proof image upload for manual bank transfer or static QRIS
  const handleProofImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih berkas foto gambar (JPG / PNG / WEBP)!', 'error');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      showToast('Ukuran berkas maksimal 6 MB!', 'error');
      return;
    }

    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 1280,
        maxDataUrlBytes: 550 * 1024
      });
      setProofFileName(file.name);
      setProofFileBase64(compressed);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses foto bukti pembayaran.', 'error');
    }
  };

  // Finalize Submission & Payment
  const submitFinalPaymentPayload = async (finalSubmission: RegistrationSubmission) => {
    setSubmittingAction('pay_modal');
    setNetworkError(null);
    try {
      const res = await saveRegistrationToCloud(finalSubmission);
      if (res.success || res.queuedOffline || res.isQuotaError) {
        showToast(
          res.isQuotaError
            ? 'Berkas pendaftaran diamankan di Cadangan Server & antrean delta (kuota Cloud penuh).'
            : res.queuedOffline
            ? `Berkas pendaftaran disimpan offline & otomatis dikirim ke Cloud saat koneksi aktif.`
            : payNowChoice === 'pay_later'
            ? `Berkas pendaftaran tersimpan! Anda dapat membayarnya nanti di menu Riwayat Pengajuan.`
            : finalSubmission.paymentPlan === 'installment'
            ? `Pembayaran cicilan/DP sebesar ${formatRupiah(finalSubmission.pendingPaymentAmount || 0)} berhasil dikirim! Menunggu verifikasi Admin.`
            : `Pendaftaran & bukti pembayaran penuh berhasil dikirim! Menunggu verifikasi Admin.`,
          res.queuedOffline || res.isQuotaError ? 'info' : 'success'
        );
        setPaymentModalOpen(false);
        setPendingSubmissionPayload(null);
        setViewMode('my_submissions');
      } else {
        setNetworkError({
          title: 'Gagal Menyimpan Pendaftaran ke Cloud',
          message: res.error || 'Terjadi gangguan jaringan saat mengirim formulir & pembayaran.',
          isNetworkError: res.isNetworkError,
          onRetry: () => submitFinalPaymentPayload(finalSubmission)
        });
        showToast(`Gagal menyimpan ke Cloud: ${res.error}`, 'error');
      }
    } catch (err: any) {
      setNetworkError({
        title: 'Gagal Menyimpan Pendaftaran',
        message: err?.message || 'Terjadi kesalahan jaringan saat mengirim data.',
        isNetworkError: true,
        onRetry: () => submitFinalPaymentPayload(finalSubmission)
      });
      showToast(`Terjadi kesalahan: ${err.message}`, 'error');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmPaymentAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSubmissionPayload) return;

    const totalFee = Number(pendingSubmissionPayload.feeAmount || 0);
    const existingPaid = Number(pendingSubmissionPayload.paidAmount || 0);
    const remainingBalance = Math.max(0, totalFee - existingPaid);
    const isCashOnlyForm = pendingSubmissionPayload.formType === 'kemah_balok1';
    const allowInst = !isCashOnlyForm && poljarSettings.allowInstallment !== false;
    const minDpPercent = Math.max(10, Math.min(90, Number(poljarSettings.minDpPercent || 30)));
    const minDpAmount = isCashOnlyForm
      ? totalFee
      : (pendingSubmissionPayload.minDpAmount || Math.ceil((totalFee * minDpPercent) / 100));

    let finalSubmission: RegistrationSubmission = { ...pendingSubmissionPayload };

    if (payNowChoice === 'pay_later' && existingPaid === 0) {
      finalSubmission.paymentStatus = 'unpaid';
      finalSubmission.paymentMethod = selectedPayMethod;
      finalSubmission.paymentPlan = 'cash';
      finalSubmission.paidAmount = 0;
      finalSubmission.remainingAmount = totalFee;
      finalSubmission.minDpAmount = minDpAmount;
      finalSubmission.pendingPaymentAmount = 0;
    } else {
      const amountToPay =
        !allowInst || selectedPaymentPlan === 'cash'
          ? remainingBalance
          : Math.round(Number(customPayAmount || 0));

      const minAllowed = !allowInst
        ? remainingBalance
        : existingPaid === 0
        ? Math.min(remainingBalance, minDpAmount)
        : Math.min(remainingBalance, 10000);

      if (amountToPay < minAllowed) {
        showToast(
          !allowInst
            ? `Pembayaran Kemah Balok 1 wajib dibayar Cash penuh sebesar ${formatRupiah(remainingBalance)}!`
            : existingPaid === 0
            ? `Nominal cicilan pertama (DP) minimal ${formatRupiah(minAllowed)} (${minDpPercent}% dari biaya)!`
            : `Nominal cicilan minimal ${formatRupiah(minAllowed)}!`,
          'error'
        );
        return;
      }

      if (amountToPay > remainingBalance) {
        showToast(`Nominal pembayaran melebihi sisa tagihan (${formatRupiah(remainingBalance)})!`, 'error');
        return;
      }

      finalSubmission.paymentMethod = selectedPayMethod;

      if (selectedPayMethod === 'bank_transfer' || selectedPayMethod === 'qris') {
        if (!proofFileBase64) {
          showToast('Harap unggah foto bukti transfer atau struk scan QRIS!', 'error');
          return;
        }
      }

      const nowStr = new Date().toLocaleString('id-ID');
      const refCode =
        selectedPayMethod === 'midtrans' || selectedPayMethod === 'ratapay'
          ? `${selectedPayMethod.toUpperCase()}-${Date.now()}`
          : undefined;

      const newRecord: InstallmentPaymentRecord = {
        id: `pay-${Date.now()}`,
        amount: amountToPay,
        method: selectedPayMethod,
        date: nowStr,
        ...(proofFileBase64 ? { proofUrl: proofFileBase64, proofFileName } : {}),
        ...(refCode ? { reference: refCode } : {}),
        status: 'pending_verification',
        isDp: allowInst && existingPaid === 0 && amountToPay < totalFee
      };

      const prevHistory = Array.isArray(pendingSubmissionPayload.installmentHistory)
        ? pendingSubmissionPayload.installmentHistory
        : [];

      finalSubmission.paymentPlan =
        allowInst && (existingPaid > 0 || amountToPay < totalFee) ? 'installment' : 'cash';
      finalSubmission.paidAmount = existingPaid;
      finalSubmission.remainingAmount = remainingBalance;
      finalSubmission.minDpAmount = minDpAmount;
      finalSubmission.pendingPaymentAmount = amountToPay;
      finalSubmission.installmentHistory = [...prevHistory, newRecord];
      finalSubmission.paymentStatus = 'pending_verification';
      if (proofFileBase64) {
        finalSubmission.paymentProofUrl = proofFileBase64;
        finalSubmission.paymentProofFileName = proofFileName;
      }
      if (refCode) {
        finalSubmission.paymentReference = refCode;
      }
      finalSubmission.paymentDate = nowStr;
      finalSubmission.stage1Finance = {
        ...(finalSubmission.stage1Finance || { status: 'pending' }),
        status: 'pending'
      };
    }

    finalSubmission.updatedAt = new Date().toISOString();
    await submitFinalPaymentPayload(finalSubmission);
  };

  const isSavingCloud = isSubmitting;
  const handleSaveFormToCloud = handleOpenSubmitAndPay;

  // 1. Reset or Fill Demo Data Handlers
  const handleResetPolisiPelajar = () => {
    const sch = currentUser?.role === 'sekolah' ? (currentUser.schoolName || currentUser.name || '') : '';
    const lvl: SchoolLevel = currentUser?.role === 'sekolah' ? (currentUser.schoolLevel || 'SLTP') : 'SLTP';
    setFormPolisiPelajar({
      nama: '',
      nisn: '',
      tanggalLahir: '',
      jk: 'Laki-Laki',
      tinggiBadan: '',
      beratBadan: '',
      alamat: '',
      golDarah: 'O',
      alergi: 'Tidak Ada',
      sekolah: sch,
      jenjang: lvl
    });
    showToast('Formulir Polisi Pelajar dikosongkan (siap diisi ulang atau cetak blanko).', 'info');
  };

  const handleDemoPolisiPelajar = () => {
    const sch =
      currentUser?.role === 'sekolah'
        ? currentUser.schoolName || currentUser.name || 'SMP Negeri 1 Majalengka'
        : 'SMP Negeri 1 Majalengka';
    const lvl: SchoolLevel =
      currentUser?.role === 'sekolah' ? currentUser.schoolLevel || 'SLTP' : 'SLTP';
    setFormPolisiPelajar({
      nama: 'Bintang Pratama',
      nisn: '0089123456',
      tanggalLahir: '2012-01-15',
      jk: 'Laki-Laki',
      tinggiBadan: '165',
      beratBadan: '52',
      alamat: 'Jl. Pemuda No. 45, Majalengka',
      golDarah: 'O',
      alergi: 'Tidak Ada',
      sekolah: sch,
      jenjang: lvl
    });
    showToast('Contoh data Polisi Pelajar berhasil dimuat.');
  };

  const handleResetCalonPks = () => {
    const defaultSchool = currentUser?.role === 'sekolah' ? (currentUser.schoolName || currentUser.name || '') : '';
    const defaultLevel: SchoolLevel = currentUser?.role === 'sekolah' ? (currentUser.schoolLevel || 'SLTP') : 'SLTA';
    setFormCalonPks({
      sekolah: defaultSchool,
      jenjang: defaultLevel,
      students: [
        {
          id: `siswa-${Date.now()}`,
          nama: '',
          tempatLahir: '',
          tanggalLahir: '',
          jk: 'Laki-laki'
        }
      ]
    });
    setCollapsedStudents({});
    showToast('Formulir Pendaftaran Calon PKS dikosongkan.', 'info');
  };

  const handleDemoCalonPks = () => {
    const demoSchool =
      currentUser?.role === 'sekolah'
        ? currentUser.schoolName || currentUser.name || 'SMA Negeri 1 Majalengka'
        : 'SMA Negeri 1 Majalengka';
    const demoLevel: SchoolLevel = currentUser?.role === 'sekolah' ? currentUser.schoolLevel || 'SLTA' : 'SLTA';
    setFormCalonPks({
      sekolah: demoSchool,
      jenjang: demoLevel,
      students: [
        {
          id: 'siswa-demo-1',
          nama: 'Aisyah Putri Rahmadani',
          tempatLahir: 'Majalengka',
          tanggalLahir: '2010-04-22',
          jk: 'Perempuan'
        },
        {
          id: 'siswa-demo-2',
          nama: 'Bintang Pratama',
          tempatLahir: 'Majalengka',
          tanggalLahir: '2010-08-15',
          jk: 'Laki-laki'
        }
      ]
    });
    setCollapsedStudents({});
    showToast('Contoh 2 data siswa Calon PKS berhasil dimuat.');
  };

  const handleResetBalok1 = () => {
    const defaultSchool = currentUser?.role === 'sekolah' ? (currentUser.schoolName || currentUser.name || '') : '';
    const defaultLevel: SchoolLevel = currentUser?.role === 'sekolah' ? (currentUser.schoolLevel || 'SLTP') : 'SLTP';
    setFormBalok1({
      sekolah: defaultSchool,
      jenjang: defaultLevel,
      maleCount: 1,
      femaleCount: 0,
      maleNames: [''],
      femaleNames: [],
      mealCount: 1
    });
    showToast('Formulir Perkemahan Balok 1 dikosongkan.', 'info');
  };

  const handleDemoBalok1 = () => {
    const demoSchool =
      currentUser?.role === 'sekolah'
        ? currentUser.schoolName || currentUser.name || 'SMP Negeri 1 Majalengka'
        : 'SMP Negeri 1 Majalengka';
    const demoLevel: SchoolLevel = currentUser?.role === 'sekolah' ? currentUser.schoolLevel || 'SLTP' : 'SLTP';
    setFormBalok1({
      sekolah: demoSchool,
      jenjang: demoLevel,
      maleCount: 3,
      femaleCount: 2,
      maleNames: ['Fajar Nugraha', 'Dimas Pratama', 'Bagus Setiawan'],
      femaleNames: ['Siti Aisyah', 'Nabila Putri'],
      mealCount: 4
    });
    showToast('Contoh 5 peserta (3 Putra, 2 Putri, 4 Konsumsi) Kemah Balok 1 berhasil dimuat.');
  };

  const handleResetBalok2 = () => {
    const defaultSchool = currentUser?.role === 'sekolah' ? (currentUser.schoolName || currentUser.name || '') : '';
    const defaultLevel: SchoolLevel = currentUser?.role === 'sekolah' ? (currentUser.schoolLevel || 'SLTA') : 'SLTA';
    setFormBalok2({
      sekolah: defaultSchool,
      jenjang: defaultLevel,
      maleCount: 1,
      femaleCount: 0,
      maleNames: [''],
      femaleNames: [],
      mealCount: 1
    });
    showToast('Formulir PKS Balok 2 dikosongkan.', 'info');
  };

  const handleDemoBalok2 = () => {
    const demoSchool =
      currentUser?.role === 'sekolah'
        ? currentUser.schoolName || currentUser.name || 'SMA Negeri 1 Majalengka'
        : 'SMA Negeri 1 Majalengka';
    const demoLevel: SchoolLevel = currentUser?.role === 'sekolah' ? currentUser.schoolLevel || 'SLTA' : 'SLTA';
    setFormBalok2({
      sekolah: demoSchool,
      jenjang: demoLevel,
      maleCount: 2,
      femaleCount: 2,
      maleNames: ['Rizky Ramadhan', 'Aditya Saputra'],
      femaleNames: ['Aulia Rahma', 'Putri Maharani'],
      mealCount: 4
    });
    showToast('Contoh 4 peserta (2 Putra, 2 Putri, 4 Konsumsi) PKS Balok 2 berhasil dimuat.');
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
          <NetworkErrorBanner
            error={networkError}
            onDismiss={() => setNetworkError(null)}
            className="no-print"
          />
          {/* FEE SUMMARY BANNER */}
          <div className="no-print bg-linear-to-r from-blue-50 via-indigo-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[11px] font-black tracking-wider uppercase">
                  Biaya Registrasi Resmi
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {currentTab === 'form_polisi_pelajar' && '1. Polisi Pelajar (Poljar)'}
                  {currentTab === 'form_calon_pks' && '2. Calon Anggota PKS'}
                  {currentTab === 'form_perkemahan_balok1' && '3. Perkemahan PKS Balok 1'}
                  {currentTab === 'form_perkemahan_balok2' && '4. Ujian PKS Balok 2'}
                </span>
                {currentTab === 'form_perkemahan_balok1' && !currentFeeConfig.isFree && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase">
                    Wajib Cash 100% · Tanpa Cicilan
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {currentFeeConfig.isFree ? 'Gratis (Bebas Biaya)' : formatRupiah(activeTotalFee)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {currentTab === 'form_calon_pks' && !currentFeeConfig.isFree
                    ? `(${formatRupiah(currentFeeConfig.fee)} × ${calonPksStudentCount} Siswa)`
                    : currentTab === 'form_perkemahan_balok1' && !currentFeeConfig.isFree
                    ? `(Biaya Sekolah ${formatRupiah(balok1Breakdown.schoolFee)} + ${balok1Breakdown.totalParticipants} Peserta × ${formatRupiah(balok1Breakdown.baseUnitFee)} + ${balok1Breakdown.mealCount} Konsumsi × ${formatRupiah(balok1Breakdown.mealUnitFee)})`
                    : currentTab === 'form_perkemahan_balok2' && !currentFeeConfig.isFree
                    ? `(${balok2Breakdown.totalParticipants} Peserta × ${formatRupiah(balok2Breakdown.baseUnitFee)} + ${balok2Breakdown.mealCount} Konsumsi × ${formatRupiah(balok2Breakdown.mealUnitFee)})`
                    : currentFeeConfig.description ||
                      (currentFeeConfig.isFree ? 'Tanpa biaya pendaftaran panitia' : 'Per peserta terdaftar')}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {currentTab === 'form_perkemahan_balok1' && !currentFeeConfig.isFree
                  ? 'Biaya wajib tiap sekolah dikenakan pada setiap formulir Kemah Balok 1 yang dikirim dan wajib dibayar Cash 100% penuh tanpa skema cicilan.'
                  : 'Tersedia pembayaran otomatis Midtrans, Ratapay, QRIS Statis, serta Transfer Manual Bank (Verifikasi 2-Tahap Keuangan & Panitia).'}
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
              {/* COMPACT FORM 1: POLISI PELAJAR (9 INPUT INTI + AUTO NIPP) */}
              {currentTab === 'form_polisi_pelajar' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">
                          Formulir Pendaftaran Polisi Pelajar (Poljar)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Isi 9 data calon anggota untuk menerbitkan Nomor Induk Polisi Pelajar (NIPP) otomatis.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                        {formPolisiPelajar.jenjang || currentUser?.schoolLevel || 'SLTP'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        {formPolisiPelajar.sekolah || currentUser?.schoolName || currentUser?.name || 'Sekolah'}
                      </span>
                    </div>
                  </div>

                  {/* Banner Pratinjau Nomor Induk Polisi Pelajar (NIPP) Otomatis */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                          Nomor Induk Polisi Pelajar (NIPP)
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Tahun Angkatan <strong className="font-mono text-slate-900">{poljarSettings.tahunAngkatan}</strong> · Angkatan{' '}
                          <strong className="font-mono text-slate-900">{normalizeAngkatanCode(poljarSettings.angkatan)}</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tahun & Angkatan diatur terpusat oleh Admin. NIPP diterbitkan otomatis saat formulir dikirim dan dinyatakan <strong>Aktif</strong> setelah verifikasi pembayaran Admin.
                      </p>
                    </div>

                    <div className="bg-white border border-blue-200 rounded-xl px-4 py-2.5 shrink-0 flex flex-col items-start lg:items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pratinjau NIPP Otomatis
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono tabular-nums tracking-wide text-blue-900 mt-0.5">
                        {livePoljarNipp || `PP-${poljarSettings.tahunAngkatan}-${normalizeAngkatanCode(poljarSettings.angkatan)}-DDMMYYYY`}
                      </span>
                      <span className={`text-[10px] font-bold mt-0.5 ${livePoljarNipp ? 'text-amber-700' : 'text-slate-400'}`}>
                        {livePoljarNipp
                          ? '● Siap diterbitkan · Aktif setelah verifikasi bayar'
                          : 'Isi Tanggal Lahir di bawah untuk membentuk NIPP'}
                      </span>
                    </div>
                  </div>

                  {/* 9 Input Inti Formulir Polisi Pelajar */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>Data Calon Anggota Polisi Pelajar (9 Input Wajib)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">1. Nama Lengkap *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.nama}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nama: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Masukkan nama lengkap siswa..."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">2. NISN *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.nisn}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nisn: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0089123456"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">3. Tanggal Lahir * <span className="text-[10px] font-normal text-blue-600">(pembentuk NIPP)</span></label>
                        <input
                          type="date"
                          value={formPolisiPelajar.tanggalLahir}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tanggalLahir: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">4. Jenis Kelamin *</label>
                        <select
                          value={formPolisiPelajar.jk}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, jk: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Laki-Laki">Laki-Laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">5. Tinggi Badan (cm) *</label>
                        <input
                          type="number"
                          min="80"
                          max="230"
                          value={formPolisiPelajar.tinggiBadan}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tinggiBadan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="165"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">6. Berat Badan (kg) *</label>
                        <input
                          type="number"
                          min="20"
                          max="180"
                          value={formPolisiPelajar.beratBadan}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, beratBadan: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="52"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">7. Golongan Darah *</label>
                        <select
                          value={formPolisiPelajar.golDarah}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, golDarah: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="AB">AB</option>
                          <option value="O">O</option>
                          <option value="Belum Diketahui">Belum Diketahui</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">8. Alergi *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.alergi}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alergi: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Contoh: Tidak Ada / Alergi debu / Makanan laut..."
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-slate-700 font-bold mb-1">9. Alamat Lengkap *</label>
                        <input
                          type="text"
                          value={formPolisiPelajar.alamat}
                          onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alamat: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Jl. Pemuda No. 45, Desa/Kelurahan, Kecamatan..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR (LANJUT BAYAR CASH / CICILAN) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                      <div className="space-y-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {poljarSettings.allowInstallment && !currentFeeConfig.isFree
                              ? `Bisa Cash atau Cicilan (DP Min ${poljarSettings.minDpPercent}%)`
                              : 'Siap Simpan & Bayar'}
                          </span>
                          <span className="text-xs text-slate-300 font-semibold tabular-nums">
                            Biaya: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(currentFeeConfig.fee)}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white">
                          Simpan Formulir & Lanjut ke Pembayaran
                        </h4>
                        <p className="text-xs text-slate-300 max-w-lg">
                          NIPP{' '}
                          <span className="font-mono font-bold text-blue-200">
                            {livePoljarNipp || 'PP-YYYY-AA-DDMMYYYY'}
                          </span>{' '}
                          langsung dibuat saat kirim dan aktif setelah verifikasi pembayaran Admin.
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
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                        >
                          {submittingAction === 'save_later' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 text-slate-400" />
                              <span>Simpan Dulu (Bayar Nanti)</span>
                            </>
                          )}
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

              {/* COMPACT FORM 2: CALON PKS (MULTI-SISWA SESUAI REFERENSI) */}
              {currentTab === 'form_calon_pks' && (() => {
                const students = formCalonPks.students || [];
                const unitFee = currentFeeConfig.isFree ? 0 : currentFeeConfig.fee || 0;
                const totalFee = unitFee * Math.max(1, students.length);

                const handleAddStudent = () => {
                  const newId = `siswa-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                  setFormCalonPks((prev: any) => ({
                    ...prev,
                    students: [
                      ...(prev.students || []),
                      {
                        id: newId,
                        nama: '',
                        tempatLahir: '',
                        tanggalLahir: '',
                        jk: 'Laki-laki'
                      }
                    ]
                  }));
                };

                const handleRemoveStudent = (targetId: string) => {
                  if (students.length <= 1) {
                    showToast('Minimal harus terdapat 1 formulir siswa.', 'info');
                    return;
                  }
                  setFormCalonPks((prev: any) => ({
                    ...prev,
                    students: (prev.students || []).filter((s: CalonPksStudentItem) => s.id !== targetId)
                  }));
                };

                const handleUpdateStudent = (targetId: string, patch: Partial<CalonPksStudentItem>) => {
                  setFormCalonPks((prev: any) => ({
                    ...prev,
                    students: (prev.students || []).map((s: CalonPksStudentItem) =>
                      s.id === targetId ? { ...s, ...patch } : s
                    )
                  }));
                };

                const toggleCollapse = (targetId: string) => {
                  setCollapsedStudents(prev => ({
                    ...prev,
                    [targetId]: !prev[targetId]
                  }));
                };

                return (
                  <div className="max-w-3xl mx-auto rounded-3xl overflow-hidden shadow-lg border border-blue-200/80 bg-white">
                    {/* Header Biru Resmi Aplikasi PKS */}
                    <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 px-5 sm:px-7 py-5 text-white relative overflow-hidden">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                            {appLogo ? (
                              <img
                                src={appLogo}
                                alt="Logo PKS"
                                className="w-9 h-9 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Shield className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-blue-100 tracking-wide uppercase">
                              Korps Patroli Keamanan Sekolah · Point 2
                            </p>
                            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white leading-snug">
                              Pendaftaran Siswa
                            </h3>
                            <p className="text-xs text-blue-100/90 mt-0.5">
                              Silakan lengkapi data diri siswa calon anggota PKS yang akan didaftarkan.
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end text-right shrink-0">
                          <span className="text-[11px] font-semibold text-blue-100">Total Siswa</span>
                          <span className="text-xl font-black text-white tabular-nums">
                            {students.length} Siswa
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Body Formulir */}
                    <div className="p-5 sm:p-7 space-y-5 bg-white">
                      {/* Identitas Pangkalan Sekolah di Bagian Atas */}
                      <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-blue-950">
                            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Info Pangkalan Sekolah</span>
                          </div>
                          {currentUser?.role === 'sekolah' && (
                            <span className="text-[11px] font-semibold text-blue-700">
                              Terisi otomatis dari akun sekolah
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="block text-slate-700 font-bold mb-1">
                              Nama Pangkalan / Sekolah *
                            </label>
                            <input
                              type="text"
                              value={formCalonPks.sekolah}
                              onChange={e => setFormCalonPks({ ...formCalonPks, sekolah: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                              placeholder="Contoh: SMA Negeri 1 Majalengka"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-700 font-bold mb-1">
                              Jenjang Sekolah *
                            </label>
                            <select
                              value={formCalonPks.jenjang}
                              onChange={e =>
                                setFormCalonPks({ ...formCalonPks, jenjang: e.target.value as SchoolLevel })
                              }
                              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            >
                              <option value="SLTP">SLTP (SMP / MTs)</option>
                              <option value="SLTA">SLTA (SMA / SMK / MA)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Sub-header "| Data Siswa" */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2.5">
                          <span className="w-1 h-5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                            Data Siswa
                          </h4>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">
                          {students.length} Pendaftar
                        </span>
                      </div>

                      {/* Daftar Kartu Siswa Berulang */}
                      <div className="space-y-4">
                        {students.map((student, idx) => {
                          const isCollapsed = Boolean(collapsedStudents[student.id]);
                          return (
                            <div
                              key={student.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50/50 transition-all overflow-hidden"
                            >
                              {/* Bar Atas Kartu: Badge Siswa # + Hapus + Collapse */}
                              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-extrabold shrink-0 tabular-nums">
                                    Siswa {idx + 1}
                                  </span>
                                  {isCollapsed && (
                                    <span className="text-xs font-semibold text-slate-700 truncate">
                                      {student.nama.trim() || 'Belum diisi nama'}
                                      {student.jk ? ` · ${student.jk}` : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {students.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStudent(student.id)}
                                      title={`Hapus Siswa ${idx + 1}`}
                                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleCollapse(student.id)}
                                    title={isCollapsed ? 'Buka Detail Siswa' : 'Lipat Detail Siswa'}
                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                                  >
                                    {isCollapsed ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronUp className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Isi Kartu Siswa (4 Field Persis Gambar) */}
                              {!isCollapsed && (
                                <div className="p-4 sm:p-5 space-y-4">
                                  {/* 1. Nama Lengkap */}
                                  <div className="flex items-start gap-3">
                                    <div className="mt-2 text-blue-600 shrink-0">
                                      <User className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                        Nama Lengkap <span className="text-rose-500">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={student.nama}
                                        onChange={e =>
                                          handleUpdateStudent(student.id, { nama: e.target.value })
                                        }
                                        placeholder="Masukkan nama lengkap"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                      />
                                    </div>
                                  </div>

                                  {/* 2 & 3. Tempat Lahir + Tanggal Lahir */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Tempat Lahir */}
                                    <div className="flex items-start gap-3">
                                      <div className="mt-2 text-blue-600 shrink-0">
                                        <MapPin className="w-5 h-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                          Tempat Lahir
                                        </label>
                                        <input
                                          type="text"
                                          value={student.tempatLahir}
                                          onChange={e =>
                                            handleUpdateStudent(student.id, { tempatLahir: e.target.value })
                                          }
                                          placeholder="Masukkan tempat lahir"
                                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                      </div>
                                    </div>

                                    {/* Tanggal Lahir */}
                                    <div className="flex items-start gap-3">
                                      <div className="mt-2 text-blue-600 shrink-0">
                                        <Calendar className="w-5 h-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                          Tanggal Lahir
                                        </label>
                                        <input
                                          type="date"
                                          value={student.tanggalLahir}
                                          onChange={e =>
                                            handleUpdateStudent(student.id, { tanggalLahir: e.target.value })
                                          }
                                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* 4. Jenis Kelamin (Radio Laki-laki / Perempuan) */}
                                  <div className="flex items-start gap-3 pt-1">
                                    <div className="mt-0.5 text-blue-600 shrink-0">
                                      <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                      <span className="block text-xs font-bold text-slate-800 mb-2">
                                        Jenis Kelamin
                                      </span>
                                      <div className="flex flex-wrap items-center gap-6">
                                        {(['Laki-laki', 'Perempuan'] as const).map(genderOpt => {
                                          const isChecked = student.jk === genderOpt;
                                          return (
                                            <label
                                              key={genderOpt}
                                              onClick={() => handleUpdateStudent(student.id, { jk: genderOpt })}
                                              className="inline-flex items-center gap-2.5 cursor-pointer select-none py-1"
                                            >
                                              <span
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                                  isChecked
                                                    ? 'border-blue-600 bg-white'
                                                    : 'border-slate-300 bg-white hover:border-blue-400'
                                                }`}
                                              >
                                                {isChecked && (
                                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                                )}
                                              </span>
                                              <span
                                                className={`text-xs sm:text-sm ${
                                                  isChecked
                                                    ? 'font-bold text-slate-900'
                                                    : 'font-medium text-slate-700'
                                                }`}
                                              >
                                                {genderOpt}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Tombol Dashed "+ Tambah Siswa Lainnya" */}
                      <button
                        type="button"
                        onClick={handleAddStudent}
                        className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-blue-500/70 hover:border-blue-600 bg-white hover:bg-blue-50/70 text-blue-700 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4" />
                        </span>
                        <span>Tambah Siswa Lainnya</span>
                      </button>

                      {/* Ringkasan Biaya & Tombol Utama "Daftar Sekarang" */}
                      <div className="pt-2 space-y-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="text-slate-600">
                            <span className="font-bold text-slate-800">Ringkasan Biaya Pendaftaran:</span>{' '}
                            {currentFeeConfig.isFree ? (
                              <span className="text-emerald-700 font-bold">Gratis (Bebas Biaya)</span>
                            ) : (
                              <span className="tabular-nums">
                                {students.length} Siswa × {formatRupiah(unitFee)}
                              </span>
                            )}
                          </div>
                          <div className="font-black text-sm sm:text-base text-blue-700 font-mono tabular-nums">
                            {currentFeeConfig.isFree ? 'Rp 0' : formatRupiah(totalFee)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleOpenSubmitAndPay}
                          disabled={isSubmitting}
                          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 disabled:opacity-75 text-white text-sm sm:text-base font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer shadow-lg hover:shadow-xl"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Memproses Pendaftaran...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5" />
                              <span>Daftar Sekarang</span>
                            </>
                          )}
                        </button>

                        {/* Opsi Tambahan Ringan */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveForLater}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {submittingAction === 'save_later' ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5 text-slate-500" />
                                <span>Simpan Dulu (Bayar Nanti)</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormDisplayMode('blanko')}
                            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Lihat Blanko A4</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* COMPACT FORM 3 & FORM 4: PERKEMAHAN BALOK 1 & BALOK 2 */}
              {(currentTab === 'form_perkemahan_balok1' || currentTab === 'form_perkemahan_balok2') && (() => {
                const isBalok1 = currentTab === 'form_perkemahan_balok1';
                const campState = isBalok1 ? formBalok1 : formBalok2;
                const setCampState = isBalok1 ? setFormBalok1 : setFormBalok2;
                const breakdown = isBalok1 ? balok1Breakdown : balok2Breakdown;
                const isSchoolUser = currentUser?.role === 'sekolah';
                const accentBadge = isBalok1
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200';
                const accentIconBox = isBalok1
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-purple-100 text-purple-700';
                const accentFocus = isBalok1 ? 'focus:ring-emerald-500' : 'focus:ring-purple-500';
                const gradientFooter = isBalok1
                  ? 'from-slate-900 via-slate-800 to-emerald-950'
                  : 'from-slate-900 via-slate-800 to-purple-950';

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                    {/* Header Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${accentIconBox}`}>
                          {isBalok1 ? <Award className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900">
                            {isBalok1
                              ? 'Formulir Pendaftaran Perkemahan PKS Balok 1'
                              : 'Formulir Pendaftaran Perkemahan & Ujian PKS Balok 2'}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Input jumlah & nama peserta berdasarkan jenis kelamin serta jumlah peserta include konsumsi.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isBalok1 && !currentFeeConfig.isFree && (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-50 text-amber-900 border border-amber-200">
                            Wajib Cash 100% · Tanpa Cicilan
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${accentBadge}`}>
                          {campState.jenjang || currentUser?.schoolLevel || 'SLTP'}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                          {campState.sekolah || currentUser?.schoolName || currentUser?.name || 'Sekolah'}
                        </span>
                      </div>
                    </div>

                    {/* Non-school preview school override */}
                    {!isSchoolUser && (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="block text-slate-700 font-bold mb-1">Pangkalan Sekolah (Mode Pratinjau Admin)</label>
                          <input
                            type="text"
                            value={campState.sekolah}
                            onChange={e => updateCampState(setCampState, { sekolah: e.target.value })}
                            className={`w-full px-3 py-2 border border-slate-300 bg-white rounded-xl text-xs font-semibold outline-none focus:ring-2 ${accentFocus}`}
                            placeholder="Nama pangkalan sekolah..."
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                          <select
                            value={campState.jenjang}
                            onChange={e => updateCampState(setCampState, { jenjang: e.target.value as SchoolLevel })}
                            className={`w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white font-bold outline-none focus:ring-2 ${accentFocus}`}
                          >
                            <option value="SLTP">SLTP</option>
                            <option value="SLTA">SLTA</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Section 1: Input Jumlah Peserta per Jenis Kelamin & Jumlah Konsumsi */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Jumlah Putra */}
                      <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-blue-600" />
                            <span>Peserta Laki-laki (Putra)</span>
                          </label>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Putra
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={breakdown.maleCount}
                          onChange={e => updateCampState(setCampState, { maleCount: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-blue-300 bg-white rounded-xl text-base font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                        />
                        <p className="text-[11px] text-slate-600">
                          Menghasilkan <strong>{breakdown.maleCount}</strong> baris nama peserta Putra.
                        </p>
                      </div>

                      {/* Jumlah Putri */}
                      <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-rose-950 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-rose-600" />
                            <span>Peserta Perempuan (Putri)</span>
                          </label>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            Putri
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={breakdown.femaleCount}
                          onChange={e => updateCampState(setCampState, { femaleCount: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-rose-300 bg-white rounded-xl text-base font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 tabular-nums"
                        />
                        <p className="text-[11px] text-slate-600">
                          Menghasilkan <strong>{breakdown.femaleCount}</strong> baris nama peserta Putri.
                        </p>
                      </div>

                      {/* Jumlah Include Konsumsi */}
                      <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <Utensils className="w-4 h-4 text-amber-600" />
                            <span>Peserta Include Konsumsi</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 tabular-nums">
                            Maks: {breakdown.totalParticipants}
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={breakdown.totalParticipants}
                          value={breakdown.mealCount}
                          onChange={e => updateCampState(setCampState, { mealCount: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-amber-300 bg-white rounded-xl text-base font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCampState(setCampState, { mealCount: breakdown.totalParticipants })}
                            className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold transition cursor-pointer"
                          >
                            Semua Ikut ({breakdown.totalParticipants})
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCampState(setCampState, { mealCount: 0 })}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold transition cursor-pointer"
                          >
                            Tanpa Konsumsi (0)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Daftar Input Nama Peserta Berdasarkan Jenis Kelamin */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Kolom Putra */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40 flex flex-col">
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-blue-950">
                            Daftar Nama Peserta Laki-laki (Putra)
                          </span>
                          <span className="text-[11px] font-mono font-bold text-blue-700 tabular-nums">
                            {breakdown.maleCount} Orang
                          </span>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {breakdown.maleCount === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">
                              Tidak ada peserta Putra (jumlah = 0). Ubah angka di atas untuk menambah peserta Putra.
                            </p>
                          ) : (
                            campState.maleNames.slice(0, breakdown.maleCount).map((nameVal, idx) => (
                              <div key={`putra-${idx}`} className="flex items-center gap-2">
                                <span className="w-7 h-8 rounded-lg bg-blue-100 text-blue-800 text-xs font-mono font-black flex items-center justify-center shrink-0 tabular-nums">
                                  {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={nameVal}
                                  onChange={e =>
                                    updateCampState(setCampState, {
                                      maleNameIndex: idx,
                                      maleNameValue: e.target.value
                                    })
                                  }
                                  placeholder={`Nama Lengkap Peserta Putra #${idx + 1}...`}
                                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Kolom Putri */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40 flex flex-col">
                        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-rose-950">
                            Daftar Nama Peserta Perempuan (Putri)
                          </span>
                          <span className="text-[11px] font-mono font-bold text-rose-700 tabular-nums">
                            {breakdown.femaleCount} Orang
                          </span>
                        </div>
                        <div className="p-4 space-y-2.5">
                          {breakdown.femaleCount === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">
                              Tidak ada peserta Putri (jumlah = 0). Ubah angka di atas untuk menambah peserta Putri.
                            </p>
                          ) : (
                            campState.femaleNames.slice(0, breakdown.femaleCount).map((nameVal, idx) => (
                              <div key={`putri-${idx}`} className="flex items-center gap-2">
                                <span className="w-7 h-8 rounded-lg bg-rose-100 text-rose-800 text-xs font-mono font-black flex items-center justify-center shrink-0 tabular-nums">
                                  {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={nameVal}
                                  onChange={e =>
                                    updateCampState(setCampState, {
                                      femaleNameIndex: idx,
                                      femaleNameValue: e.target.value
                                    })
                                  }
                                  placeholder={`Nama Lengkap Peserta Putri #${idx + 1}...`}
                                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Rincian Sinkronisasi Total Pembayaran Real-Time */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                            Rincian Total Pembayaran Tersinkronisasi
                          </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                          Total Peserta: <strong>{breakdown.totalParticipants}</strong> ({breakdown.maleCount} L · {breakdown.femaleCount} P) · Konsumsi: <strong>{breakdown.mealCount}</strong>
                        </span>
                      </div>

                      {currentFeeConfig.isFree ? (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          Kegiatan ini sedang diatur Gratis (Bebas Biaya) oleh Admin. Total Pembayaran: Rp 0.
                        </div>
                      ) : (
                        <>
                          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isBalok1 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 text-xs`}>
                            {isBalok1 && (
                              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                                <span className="text-[10px] font-bold text-amber-900 uppercase block">
                                  Biaya Wajib Sekolah
                                </span>
                                <div className="text-sm font-mono font-black text-amber-950 mt-1 tabular-nums">
                                  {formatRupiah(breakdown.schoolFee)}
                                </div>
                                <span className="text-[11px] text-amber-800 font-semibold">
                                  Per formulir dikirim · Cash penuh
                                </span>
                              </div>
                            )}

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                                Biaya Peserta ({breakdown.totalParticipants} Orang)
                              </span>
                              <div className="text-sm font-mono font-black text-slate-900 mt-1 tabular-nums">
                                {formatRupiah(breakdown.baseSubtotal)}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {breakdown.totalParticipants} × {formatRupiah(breakdown.baseUnitFee)}
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-bold text-amber-700 uppercase block">
                                Biaya Konsumsi ({breakdown.mealCount} Orang)
                              </span>
                              <div className="text-sm font-mono font-black text-amber-800 mt-1 tabular-nums">
                                {formatRupiah(breakdown.mealSubtotal)}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {breakdown.mealCount} × {formatRupiah(breakdown.mealUnitFee)}
                              </span>
                            </div>

                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                                {isBalok1 ? 'Total Wajib Cash Penuh' : 'Total Yang Harus Dibayarkan'}
                              </span>
                              <div className="text-lg font-mono font-black text-emerald-700 mt-0.5 tabular-nums">
                                {formatRupiah(breakdown.grandTotal)}
                              </div>
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                {isBalok1
                                  ? 'Wajib Cash 100% (tanpa cicilan)'
                                  : 'Otomatis tersinkron ke tagihan & pembayaran'}
                              </span>
                            </div>
                          </div>

                          {isBalok1 && (
                            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <span>
                                <strong>Ketentuan Kemah Balok 1:</strong> Biaya Wajib Sekolah sebesar{' '}
                                <strong className="font-mono">{formatRupiah(breakdown.schoolFee)}</strong> dikenakan pada setiap formulir yang dikirim dan pelunasan{' '}
                                <strong>wajib dibayar Cash 100% penuh tanpa skema cicilan/DP</strong>.
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* BOTTOM ACTION BAR */}
                    <div className="pt-4 border-t border-slate-200">
                      <div className={`bg-gradient-to-r ${gradientFooter} text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md`}>
                        <div className="space-y-1 text-center md:text-left">
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                isBalok1 && !currentFeeConfig.isFree
                                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isBalok1 && !currentFeeConfig.isFree
                                ? 'Wajib Cash 100% · Tanpa Cicilan'
                                : 'Sinkron Otomatis'}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold tabular-nums">
                              Total Pembayaran: {currentFeeConfig.isFree ? 'Gratis' : formatRupiah(activeTotalFee)}
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-extrabold text-white">
                            Simpan Formulir ({breakdown.totalParticipants} Peserta · {breakdown.mealCount} Konsumsi) & Lanjut Pembayaran
                          </h4>
                          <p className="text-xs text-slate-300 max-w-lg">
                            {isBalok1 && !currentFeeConfig.isFree
                              ? `Termasuk Biaya Wajib Sekolah ${formatRupiah(breakdown.schoolFee)} + biaya peserta & konsumsi. Wajib dilunasi Cash penuh tanpa DP/cicilan.`
                              : 'Nominal tagihan otomatis mengikuti jumlah peserta dan konsumsi di atas. Bisa dibayar Cash atau Cicilan/DP.'}
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
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                          >
                            {submittingAction === 'save_later' ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 text-slate-400" />
                                <span>Simpan Dulu (Bayar Nanti)</span>
                              </>
                            )}
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
                );
              })()}
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
            <div className="text-center space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                {blankoConfig?.forms?.polisi_pelajar?.judul || 'FORMULIR PENDAFTARAN ANGGOTA POLISI PELAJAR (POLJAR)'}
              </h2>
              <p className="text-xs text-slate-700 font-mono">
                NIPP: <strong>{livePoljarNipp || `PP-${poljarSettings.tahunAngkatan}-${normalizeAngkatanCode(poljarSettings.angkatan)}-DDMMYYYY`}</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Tahun Angkatan {poljarSettings.tahunAngkatan} · Angkatan {normalizeAngkatanCode(poljarSettings.angkatan)} · Pangkalan: {formPolisiPelajar.sekolah || '-'} ({formPolisiPelajar.jenjang || 'SLTP'})
              </p>
            </div>

            {/* Data Calon Anggota Polisi Pelajar (9 Field Inti) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                Data Calon Anggota Polisi Pelajar
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">1. Nama Lengkap</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.nama}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nama: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    placeholder="Nama lengkap..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">2. NISN</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.nisn}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, nisn: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="Contoh: 0089123456"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">3. Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formPolisiPelajar.tanggalLahir}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tanggalLahir: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">4. Jenis Kelamin</label>
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
                  <label className="block text-slate-600 font-bold mb-1">5. Tinggi Badan (cm)</label>
                  <input
                    type="number"
                    value={formPolisiPelajar.tinggiBadan}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, tinggiBadan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="165"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">6. Berat Badan (kg)</label>
                  <input
                    type="number"
                    value={formPolisiPelajar.beratBadan}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, beratBadan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none font-mono"
                    placeholder="52"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">7. Golongan Darah</label>
                  <select
                    value={formPolisiPelajar.golDarah}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, golDarah: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white font-bold"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                    <option value="Belum Diketahui">Belum Diketahui</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">8. Alergi</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.alergi}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alergi: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Tidak Ada"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">9. Alamat Lengkap</label>
                  <input
                    type="text"
                    value={formPolisiPelajar.alamat}
                    onChange={e => setFormPolisiPelajar({ ...formPolisiPelajar, alamat: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                    placeholder="Alamat lengkap siswa..."
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

            {/* Identitas Pangkalan */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                A. Identitas Pangkalan Sekolah
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Pangkalan Sekolah</label>
                  <input
                    type="text"
                    value={formCalonPks.sekolah}
                    onChange={e => setFormCalonPks({ ...formCalonPks, sekolah: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Tingkat / Jenjang</label>
                  <select
                    value={formCalonPks.jenjang}
                    onChange={e => setFormCalonPks({ ...formCalonPks, jenjang: e.target.value as SchoolLevel })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="SLTP">SLTP (SMP/MTs)</option>
                    <option value="SLTA">SLTA (SMA/SMK/MA)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabel Daftar Siswa Calon Anggota PKS */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-300 pb-1">
                B. Daftar Siswa Calon Anggota PKS ({(formCalonPks.students || []).length} Siswa)
              </h3>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 border-r border-slate-300 w-10 text-center">No</th>
                      <th className="p-2.5 border-r border-slate-300">Nama Lengkap Siswa</th>
                      <th className="p-2.5 border-r border-slate-300">Tempat Lahir</th>
                      <th className="p-2.5 border-r border-slate-300 w-32">Tanggal Lahir</th>
                      <th className="p-2.5 w-28">Jenis Kelamin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(formCalonPks.students || []).map((st, idx) => (
                      <tr key={st.id}>
                        <td className="p-2.5 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                        <td className="p-2.5 border-r border-slate-300 font-semibold text-slate-900">
                          {st.nama || '................................................'}
                        </td>
                        <td className="p-2.5 border-r border-slate-300">{st.tempatLahir || '-'}</td>
                        <td className="p-2.5 border-r border-slate-300 font-mono">
                          {st.tanggalLahir
                            ? new Date(st.tanggalLahir).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '-'}
                        </td>
                        <td className="p-2.5">{st.jk || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature Block */}
            <div className="pt-6 border-t border-slate-300 text-xs text-center">
              <div className="text-right text-[11px] text-slate-500 mb-6">
                {blankoConfig?.kopSurat?.kotaTtd || 'Majalengka'}, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-slate-600">Pemohon / Perwakilan,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.calon_pks?.ttd1Label || 'Calon Anggota PKS'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Tanda Tangan)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    {formCalonPks.students?.[0]?.nama || '...........................................'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-600">Mengetahui,</p>
                  <p className="font-bold text-slate-800">{blankoConfig?.forms?.calon_pks?.ttd2Label || 'Pembina PKS Pangkalan'}</p>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                    (Stempel & TTD)
                  </div>
                  <p className="font-bold underline text-slate-900">
                    ...........................................
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
        {/* FORM 3 & FORM 4: BLANGKO RESMI PERKEMAHAN BALOK 1 & BALOK 2 */}
        {/* ========================================================= */}
        {(currentTab === 'form_perkemahan_balok1' || currentTab === 'form_perkemahan_balok2') && (() => {
          const isBalok1 = currentTab === 'form_perkemahan_balok1';
          const campState = isBalok1 ? formBalok1 : formBalok2;
          const breakdown = isBalok1 ? balok1Breakdown : balok2Breakdown;
          const maleList = syncCampNames(breakdown.maleCount, campState.maleNames);
          const femaleList = syncCampNames(breakdown.femaleCount, campState.femaleNames);
          const customFormCfg = isBalok1 ? blankoConfig?.forms?.kemah_balok1 : blankoConfig?.forms?.pks_balok2;

          return (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                  {customFormCfg?.judul ||
                    (isBalok1
                      ? 'FORMULIR PENDAFTARAN PERKEMAHAN PKS BALOK 1'
                      : 'FORMULIR PENDAFTARAN PERKEMAHAN & UJIAN PKS BALOK 2')}
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Nomor Blanko: {customFormCfg?.nomorPrefix || (isBalok1 ? 'PKS-KMH1/2026/REG-01' : 'PKS-BLK2/2026/REG-01')}
                </p>
              </div>

              {/* A. Ringkasan Pangkalan & Jumlah Peserta */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  A. Identitas Pangkalan & Rekap Peserta
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="col-span-2 sm:col-span-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Pangkalan Sekolah</span>
                    <span className="font-bold text-slate-900">{campState.sekolah || '-'} ({campState.jenjang})</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Jumlah Peserta (Putra / Putri)</span>
                    <span className="font-bold font-mono text-slate-900 tabular-nums">
                      {breakdown.totalParticipants} Orang ({breakdown.maleCount} L · {breakdown.femaleCount} P)
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Peserta Include Konsumsi</span>
                    <span className="font-bold font-mono text-slate-900 tabular-nums">
                      {breakdown.mealCount} dari {breakdown.totalParticipants} Peserta
                    </span>
                  </div>
                </div>
              </div>

              {/* B. Tabel Daftar Nama Peserta */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  B. Daftar Nama Peserta ({breakdown.totalParticipants} Orang)
                </h3>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2.5 border-r border-slate-300 w-10 text-center">No</th>
                        <th className="p-2.5 border-r border-slate-300">Nama Lengkap Peserta</th>
                        <th className="p-2.5 border-r border-slate-300 w-40">Jenis Kelamin</th>
                        <th className="p-2.5 w-44">Pangkalan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {breakdown.totalParticipants === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                            Belum ada peserta diisi.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {maleList.map((nama, idx) => (
                            <tr key={`blanko-putra-${idx}`}>
                              <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">{idx + 1}</td>
                              <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                                {nama || '................................................'}
                              </td>
                              <td className="p-2 border-r border-slate-300">Laki-laki (Putra)</td>
                              <td className="p-2 text-slate-600">{campState.sekolah || '-'}</td>
                            </tr>
                          ))}
                          {femaleList.map((nama, idx) => (
                            <tr key={`blanko-putri-${idx}`}>
                              <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">
                                {maleList.length + idx + 1}
                              </td>
                              <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                                {nama || '................................................'}
                              </td>
                              <td className="p-2 border-r border-slate-300">Perempuan (Putri)</td>
                              <td className="p-2 text-slate-600">{campState.sekolah || '-'}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* C. Rincian Pembayaran */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs space-y-2">
                <span className="font-bold uppercase text-slate-800 block">C. Rincian Biaya Pendaftaran & Konsumsi:</span>
                <div className={`grid grid-cols-1 ${isBalok1 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-2 font-mono tabular-nums`}>
                  {isBalok1 && (
                    <div>
                      Biaya Wajib Sekolah: <strong>{formatRupiah(breakdown.schoolFee)}</strong>
                    </div>
                  )}
                  <div>
                    Biaya Peserta: {breakdown.totalParticipants} × {formatRupiah(breakdown.baseUnitFee)} ={' '}
                    <strong>{formatRupiah(breakdown.baseSubtotal)}</strong>
                  </div>
                  <div>
                    Biaya Konsumsi: {breakdown.mealCount} × {formatRupiah(breakdown.mealUnitFee)} ={' '}
                    <strong>{formatRupiah(breakdown.mealSubtotal)}</strong>
                  </div>
                  <div className="text-emerald-800 font-black">
                    Total Bayar{isBalok1 ? ' (Cash)' : ''}: {currentFeeConfig.isFree ? 'Gratis (Rp 0)' : formatRupiah(breakdown.grandTotal)}
                  </div>
                </div>
                {isBalok1 && !currentFeeConfig.isFree && (
                  <p className="text-[10px] text-slate-600 font-sans">
                    Catatan: Biaya wajib sekolah dikenakan per pengajuan formulir Kemah Balok 1 dan wajib dilunasi Cash 100% penuh tanpa skema cicilan.
                  </p>
                )}
              </div>

              {/* Signature Block */}
              <div className="pt-6 border-t border-slate-300 text-xs text-center">
                <div className="text-right text-[11px] text-slate-500 mb-6">
                  {blankoConfig?.kopSurat?.kotaTtd || 'Majalengka'}, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-semibold text-slate-600">Perwakilan Sekolah,</p>
                    <p className="font-bold text-slate-800">{customFormCfg?.ttd1Label || 'Kontingen PKS'}</p>
                    <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                      (Tanda Tangan)
                    </div>
                    <p className="font-bold underline text-slate-900">
                      {campState.sekolah || '...........................................'}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-600">Mengetahui,</p>
                    <p className="font-bold text-slate-800">{customFormCfg?.ttd2Label || 'Pembina PKS Pangkalan'}</p>
                    <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                      (Stempel & TTD Sekolah)
                    </div>
                    <p className="font-bold underline text-slate-900">
                      ...........................................
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-600">Mengesahkan,</p>
                    <p className="font-bold text-slate-800">{customFormCfg?.ttd3Label || 'Panitia Pelaksana Polres'}</p>
                    <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                      (Tanda Tangan & Cap)
                    </div>
                    <p className="font-bold underline text-slate-900">
                      {customFormCfg?.ttd3Nama || 'Ipda Supriatna'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Quick Submit Floating / Bottom Bar */}
      <div className="no-print max-w-4xl mx-auto bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div>
          <p className="text-xs text-slate-300 font-semibold">Formulir telah selesai diisi?</p>
          <p className="text-sm font-black text-white tabular-nums">
            Kirim ke Panitia & Bayar Registrasi ({currentFeeConfig.isFree ? 'Gratis' : formatRupiah(activeTotalFee)})
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSaveForLater}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {submittingAction === 'save_later' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-slate-400" />
                <span>Simpan Dulu (Bayar Nanti)</span>
              </>
            )}
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
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Belum Lunas / Cicilan</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-600">
              {mySchoolSubmissions.filter(s => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial').length}
            </span>
            <span className="text-xs text-rose-600 font-semibold">Tagihan</span>
          </div>
          <p className="text-[11px] text-rose-600/80 mt-1">Cash atau Cicilan DP</p>
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
              Riwayat penginputan formulir oleh akun sekolah beserta status NIPP dan pelunasan cicilan secara real-time.
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
                  <th className="p-3">Biaya & Progres Bayar</th>
                  <th className="p-3">Skema & Status Bayar</th>
                  <th className="p-3">Verifikasi Keuangan (T-1)</th>
                  <th className="p-3">Pengesahan Panitia (T-2)</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mySchoolSubmissions.map((sub, idx) => {
                  const totalFee = Number(sub.feeAmount || 0);
                  const paidAmount =
                    sub.paidAmount !== undefined
                      ? Number(sub.paidAmount)
                      : sub.paymentStatus === 'paid'
                      ? totalFee
                      : 0;
                  const remainingAmount =
                    sub.remainingAmount !== undefined
                      ? Number(sub.remainingAmount)
                      : Math.max(0, totalFee - paidAmount);
                  const canPayOrContinue =
                    totalFee > 0 &&
                    remainingAmount > 0 &&
                    sub.paymentStatus !== 'pending_verification';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{sub.applicantName}</div>
                        <div className="text-[11px] text-blue-600 font-semibold">{sub.formTitle}</div>
                        {(sub.formType === 'kemah_balok1' || sub.formType === 'pks_balok2') &&
                          sub.formData?.totalParticipants !== undefined && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono tabular-nums">
                              {sub.formType === 'kemah_balok1' && Number(sub.formData?.schoolFeePerForm || 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                  Sekolah: {formatRupiah(sub.formData.schoolFeePerForm)}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                {sub.formData.maleCount ?? 0} L · {sub.formData.femaleCount ?? 0} P
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                Konsumsi: {sub.formData.mealCount ?? 0}/{sub.formData.totalParticipants}
                              </span>
                            </div>
                          )}
                        {sub.nomorIndukPoljar && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                              NIPP: {sub.nomorIndukPoljar}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                sub.nippStatus === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {sub.nippStatus === 'active' ? 'Aktif' : 'Belum Aktif'}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {sub.id}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sub.schoolLevel}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">
                          {totalFee === 0 ? 'Gratis' : formatRupiah(totalFee)}
                        </div>
                        {totalFee > 0 && (paidAmount > 0 || remainingAmount < totalFee || sub.paymentPlan === 'installment') && (
                          <div className="text-[10px] font-mono tabular-nums mt-0.5 space-y-0.5">
                            <div className="text-emerald-700 font-semibold">
                              Terbayar: {formatRupiah(paidAmount)}
                            </div>
                            {remainingAmount > 0 && (
                              <div className="text-rose-700 font-bold">
                                Sisa: {formatRupiah(remainingAmount)}
                              </div>
                            )}
                          </div>
                        )}
                        {Number(sub.pendingPaymentAmount || 0) > 0 && (
                          <div className="text-[10px] font-mono text-amber-700 font-semibold mt-0.5">
                            Menunggu Verif: {formatRupiah(sub.pendingPaymentAmount || 0)}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {sub.paymentStatus === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Lunas
                          </span>
                        )}
                        {sub.paymentStatus === 'partial' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Cicilan Aktif
                          </span>
                        )}
                        {sub.paymentStatus === 'pending_verification' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Verifikasi
                          </span>
                        )}
                        {(sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'rejected') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            {sub.paymentStatus === 'rejected' ? 'Ditolak' : 'Belum Bayar'}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5 uppercase">
                          {sub.formType === 'kemah_balok1'
                            ? 'Wajib Cash · '
                            : sub.paymentPlan === 'installment'
                            ? 'Cicilan · '
                            : ''}
                          {sub.paymentMethod === 'free' ? 'Bebas Biaya' : sub.paymentMethod.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="p-3">
                        {sub.stage1Finance?.status === 'approved' ? (
                          <div className="text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{sub.paymentStatus === 'partial' ? 'DP/Cicilan Sah' : 'Disetujui'}</span>
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
                        {canPayOrContinue && (
                          <button
                            type="button"
                            onClick={() => openPaymentModalForSubmission(sub)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>{paidAmount > 0 ? 'Bayar Cicilan / Lunasi' : 'Bayar Sekarang'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* ========================================================= */}
  {/* MODAL: PILIHAN PEMBAYARAN CASH / CICILAN & PAYMENT GATEWAY */}
  {/* ========================================================= */}
  {paymentModalOpen && pendingSubmissionPayload && (() => {
    const totalFee = Number(pendingSubmissionPayload.feeAmount || 0);
    const existingPaid = Number(pendingSubmissionPayload.paidAmount || 0);
    const remainingBalance = Math.max(0, totalFee - existingPaid);
    const isCashOnlyForm = pendingSubmissionPayload.formType === 'kemah_balok1';
    const allowInst = !isCashOnlyForm && poljarSettings.allowInstallment !== false;
    const minDpPercent = Math.max(10, Math.min(90, Number(poljarSettings.minDpPercent || 30)));
    const minDpAmount = isCashOnlyForm
      ? totalFee
      : (pendingSubmissionPayload.minDpAmount || Math.ceil((totalFee * minDpPercent) / 100));
    const minAllowed = !allowInst
      ? remainingBalance
      : existingPaid === 0
      ? Math.min(remainingBalance, minDpAmount)
      : Math.min(remainingBalance, 10000);
    const amountToPayNow =
      !allowInst || selectedPaymentPlan === 'cash'
        ? remainingBalance
        : Math.max(0, Math.min(remainingBalance, Math.round(Number(customPayAmount || 0))));

    return (
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
                {existingPaid > 0 ? 'Pembayaran Cicilan / Pelunasan' : 'Pembayaran Pendaftaran Formulir'}
              </h3>
              <p className="text-xs text-slate-300">
                {pendingSubmissionPayload.formTitle} • {pendingSubmissionPayload.applicantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setNetworkError(null);
              setPaymentModalOpen(false);
            }}
            className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-50 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          <NetworkErrorBanner error={networkError} onDismiss={() => setNetworkError(null)} />
          {/* Bill Summary Banner */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                {existingPaid > 0 ? 'Sisa Tagihan Registrasi' : 'Total Tagihan Registrasi'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Asal: {pendingSubmissionPayload.schoolName}</p>
              {pendingSubmissionPayload.nomorIndukPoljar && (
                <p className="text-[11px] font-mono font-bold text-blue-800 mt-0.5">
                  NIPP: {pendingSubmissionPayload.nomorIndukPoljar} ({pendingSubmissionPayload.nippStatus === 'active' ? 'Aktif' : 'Aktif setelah verif'})
                </p>
              )}
              {existingPaid > 0 && (
                <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                  Sudah terbayar: {formatRupiah(existingPaid)} dari {formatRupiah(totalFee)}
                </p>
              )}
              {pendingSubmissionPayload.formType === 'calon_pks' &&
                Number(pendingSubmissionPayload.formData?.studentCount || 1) > 1 && (
                  <p className="text-[11px] font-bold text-blue-700 mt-0.5">
                    {pendingSubmissionPayload.formData?.studentCount} Siswa × {formatRupiah(pendingSubmissionPayload.formData?.unitFee || 0)}
                  </p>
                )}
              {(pendingSubmissionPayload.formType === 'kemah_balok1' || pendingSubmissionPayload.formType === 'pks_balok2') &&
                pendingSubmissionPayload.formData?.totalParticipants !== undefined && (
                  <div className="text-[11px] text-blue-800 mt-1 space-y-0.5 font-mono tabular-nums">
                    <p className="font-bold">
                      {pendingSubmissionPayload.formData.totalParticipants} Peserta ({pendingSubmissionPayload.formData.maleCount ?? 0} L, {pendingSubmissionPayload.formData.femaleCount ?? 0} P) + {pendingSubmissionPayload.formData.mealCount ?? 0} Konsumsi
                    </p>
                    {isCashOnlyForm && (
                      <p className="text-[10px] text-slate-700">
                        Wajib Sekolah {formatRupiah(pendingSubmissionPayload.formData.schoolFeePerForm || 0)} + Peserta {formatRupiah(pendingSubmissionPayload.formData.baseSubtotal || 0)} + Konsumsi {formatRupiah(pendingSubmissionPayload.formData.mealSubtotal || 0)}
                      </p>
                    )}
                  </div>
                )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-blue-900 font-mono tabular-nums">
                {formatRupiah(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Flexible Flow Option (Bayar Sekarang vs Simpan Dulu & Bayar Nanti) */}
          {existingPaid === 0 && (
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
                    {isCashOnlyForm
                      ? 'Wajib dilunasi Cash 100% penuh (tanpa cicilan/DP).'
                      : allowInst
                      ? `Pilih bayar Cash penuh atau Cicilan DP minimal ${minDpPercent}%.`
                      : 'Pelunasan penuh via gateway atau transfer.'}
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
          )}

          {/* Skema Cash vs Cicilan (or Wajib Cash Penuh banner for Kemah Balok 1) */}
          {(existingPaid > 0 || payNowChoice === 'pay_now') && remainingBalance > 0 && (
            allowInst ? (
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <label className="block text-slate-800 font-bold">
                  Skema Pembayaran:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentPlan('cash');
                      setCustomPayAmount(remainingBalance);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedPaymentPlan === 'cash'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {existingPaid > 0 ? 'Lunasi Sekaligus' : 'Bayar Cash (Lunas 100%)'}
                    </div>
                    <div className="font-mono text-[11px] font-black text-emerald-700 mt-0.5 tabular-nums">
                      {formatRupiah(remainingBalance)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentPlan('installment');
                      setCustomPayAmount(minAllowed);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedPaymentPlan === 'installment'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {existingPaid > 0 ? 'Cicilan Bertahap' : `Cicilan (DP Min ${minDpPercent}%)`}
                    </div>
                    <div className="font-mono text-[11px] font-black text-blue-700 mt-0.5 tabular-nums">
                      Min: {formatRupiah(minAllowed)}
                    </div>
                  </button>
                </div>

                {selectedPaymentPlan === 'installment' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-700 uppercase">
                        Nominal Yang Dibayarkan Sekarang (Rp)
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">
                        Rentang: {formatRupiah(minAllowed)} – {formatRupiah(remainingBalance)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={minAllowed}
                      max={remainingBalance}
                      step="1000"
                      value={customPayAmount}
                      onChange={e => setCustomPayAmount(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-black text-blue-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Sisa tagihan setelah pembayaran ini:</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatRupiah(Math.max(0, remainingBalance - amountToPayNow))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : isCashOnlyForm ? (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-xs">
                    Skema Pembayaran: Wajib Cash 100% Penuh (Tanpa Cicilan / DP)
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Sesuai kebijakan Kemah Balok 1, biaya wajib sekolah beserta seluruh rincian peserta & konsumsi wajib dilunasi sekaligus sebesar{' '}
                    <strong className="font-mono tabular-nums">{formatRupiah(remainingBalance)}</strong>.
                  </p>
                </div>
              </div>
            ) : null
          )}

          {(existingPaid > 0 || payNowChoice === 'pay_now') && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-slate-800 font-bold">Pilih Kanal / Metode Pembayaran:</label>
                <span className="text-xs font-mono font-black text-emerald-700 tabular-nums">
                  Bayar: {formatRupiah(amountToPayNow)}
                </span>
              </div>

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
                        Nominal dibayarkan: <strong className="font-mono text-slate-900">{formatRupiah(amountToPayNow)}</strong>.
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
            disabled={isSubmitting}
            onClick={() => {
              setNetworkError(null);
              setPaymentModalOpen(false);
            }}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition cursor-pointer"
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
    );
  })()}
</div>
);
};

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Building2,
  Users,
  AlertCircle,
  Shield,
  Trash2,
  X,
  CreditCard,
  QrCode,
  Check,
  Calendar,
  Phone,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { RegistrationSubmission, deleteRegistrationFromCloud, saveRegistrationToCloud, PaymentConfig } from '../lib/firebase';
import { AppUser } from '../App';

interface RegistrationSubmissionsAdminViewProps {
  submissionsList: RegistrationSubmission[];
  currentUser: AppUser | null;
  paymentConfig?: PaymentConfig;
  onRefresh?: () => void;
  onOpenPaymentSettings?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RegistrationSubmissionsAdminView: React.FC<RegistrationSubmissionsAdminViewProps> = ({
  submissionsList,
  currentUser,
  paymentConfig,
  onRefresh,
  onOpenPaymentSettings,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormType, setFilterFormType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  // Detail Modal
  const [selectedSubmission, setSelectedSubmission] = useState<RegistrationSubmission | null>(null);

  // Verification Action Dialogs
  const [verifyModalType, setVerifyModalType] = useState<'stage1' | 'stage2' | null>(null);
  const [verifyActionStatus, setVerifyActionStatus] = useState<'approved' | 'rejected'>('approved');
  const [verifyNote, setVerifyNote] = useState('');
  const [officialNumberInput, setOfficialNumberInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Zoom Proof Image Modal
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const getFormLabel = (type: string) => {
    switch (type) {
      case 'polisi_pelajar':
        return '1. Polisi Pelajar';
      case 'calon_pks':
        return '2. Calon Anggota PKS';
      case 'kemah_balok1':
        return '3. Kemah PKS Balok 1';
      case 'pks_balok2':
        return '4. Ujian Balok 2';
      default:
        return type;
    }
  };

  // Metrics computation
  const stats = useMemo(() => {
    let total = submissionsList.length;
    let unpaid = 0;
    let pendingFinance = 0;
    let pendingCommittee = 0;
    let fullyApproved = 0;
    let totalRevenue = 0;

    submissionsList.forEach(s => {
      if (s.paymentStatus === 'unpaid') unpaid++;
      if (s.stage1Finance?.status === 'pending') pendingFinance++;
      if (s.stage1Finance?.status === 'approved' && s.stage2Committee?.status === 'pending') {
        pendingCommittee++;
      }
      if (s.stage1Finance?.status === 'approved' && s.stage2Committee?.status === 'approved') {
        fullyApproved++;
      }
      if (s.paymentStatus === 'paid' || s.stage1Finance?.status === 'approved') {
        totalRevenue += s.feeAmount || 0;
      }
    });

    return {
      total,
      unpaid,
      pendingFinance,
      pendingCommittee,
      fullyApproved,
      totalRevenue
    };
  }, [submissionsList]);

  // Filtered List
  const filteredSubmissions = useMemo(() => {
    return submissionsList.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.schoolName?.toLowerCase().includes(q) ||
        s.applicantName?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.formData?.nisn?.includes(q) ||
        s.formData?.noHp?.includes(q);

      const matchForm = filterFormType === 'all' || s.formType === filterFormType;
      const matchLevel = filterLevel === 'all' || s.schoolLevel === filterLevel;

      let matchStatus = true;
      if (filterStatus === 'unpaid') {
        matchStatus = s.paymentStatus === 'unpaid';
      } else if (filterStatus === 'pending_finance') {
        matchStatus = s.stage1Finance?.status === 'pending';
      } else if (filterStatus === 'pending_committee') {
        matchStatus = s.stage1Finance?.status === 'approved' && s.stage2Committee?.status === 'pending';
      } else if (filterStatus === 'fully_approved') {
        matchStatus = s.stage1Finance?.status === 'approved' && s.stage2Committee?.status === 'approved';
      } else if (filterStatus === 'rejected') {
        matchStatus = s.stage1Finance?.status === 'rejected' || s.stage2Committee?.status === 'rejected';
      }

      return matchSearch && matchForm && matchLevel && matchStatus;
    });
  }, [submissionsList, searchQuery, filterFormType, filterLevel, filterStatus]);

  // Open Stage 1 Verification
  const handleOpenStage1 = (sub: RegistrationSubmission) => {
    setSelectedSubmission(sub);
    setVerifyModalType('stage1');
    setVerifyActionStatus('approved');
    setVerifyNote(sub.stage1Finance?.note || '');
  };

  // Open Stage 2 Verification
  const handleOpenStage2 = (sub: RegistrationSubmission) => {
    setSelectedSubmission(sub);
    setVerifyModalType('stage2');
    setVerifyActionStatus('approved');
    setVerifyNote(sub.stage2Committee?.note || '');
    setOfficialNumberInput(
      sub.stage2Committee?.officialNumber ||
      `REG-${sub.schoolLevel}-${String(Math.floor(Math.random() * 900) + 100)}`
    );
  };

  // Submit Verification
  const handleProcessVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setIsProcessing(true);
    try {
      const verifierName = currentUser?.name || currentUser?.username || 'Admin';
      const nowStr = new Date().toLocaleString('id-ID');

      let updatedSub: RegistrationSubmission = { ...selectedSubmission };

      if (verifyModalType === 'stage1') {
        updatedSub.stage1Finance = {
          status: verifyActionStatus,
          verifiedBy: verifierName,
          verifiedAt: nowStr,
          note: verifyNote.trim()
        };
        if (verifyActionStatus === 'approved') {
          updatedSub.paymentStatus = 'paid';
          updatedSub.paymentDate = nowStr;
        } else {
          updatedSub.paymentStatus = 'rejected';
        }
      } else if (verifyModalType === 'stage2') {
        updatedSub.stage2Committee = {
          status: verifyActionStatus,
          verifiedBy: verifierName,
          verifiedAt: nowStr,
          note: verifyNote.trim(),
          officialNumber: verifyActionStatus === 'approved' ? officialNumberInput.trim() : undefined
        };
      }

      updatedSub.updatedAt = new Date().toISOString();

      await saveRegistrationToCloud(updatedSub);
      setSelectedSubmission(updatedSub);
      setVerifyModalType(null);
      showToast(
        verifyModalType === 'stage1'
          ? `Verifikasi Keuangan (Tahap 1) berhasil disimpan!`
          : `Pengesahan Panitia (Tahap 2) berhasil disimpan!`,
        'success'
      );
    } catch (err: any) {
      showToast(`Gagal memverifikasi berkas: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete submission
  const handleDeleteSubmission = async (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus berkas pendaftaran "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        await deleteRegistrationFromCloud(id);
        if (selectedSubmission?.id === id) {
          setSelectedSubmission(null);
        }
        showToast('Berkas pendaftaran berhasil dihapus dari Cloud.', 'info');
      } catch (err: any) {
        showToast(`Gagal menghapus berkas: ${err.message}`, 'error');
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredSubmissions.length === 0) {
      showToast('Tidak ada data pendaftaran untuk diekspor!', 'error');
      return;
    }

    const rows = filteredSubmissions.map((s, idx) => ({
      'No': idx + 1,
      'ID Registrasi': s.id,
      'Tanggal Input': s.createdAt ? new Date(s.createdAt).toLocaleDateString('id-ID') : '-',
      'Jenis Formulir': getFormLabel(s.formType),
      'Asal Sekolah': s.schoolName,
      'Jenjang': s.schoolLevel,
      'Nama Pendaftar': s.applicantName,
      'No WhatsApp': s.contactWa || s.formData?.noHp || '-',
      'Nominal Biaya': s.feeAmount || 0,
      'Metode Bayar': s.paymentMethod?.toUpperCase() || '-',
      'Status Pembayaran': s.paymentStatus === 'paid' ? 'LUNAS' : s.paymentStatus === 'unpaid' ? 'BELUM BAYAR' : 'MENUNGGU VERIFIKASI',
      'Verifikasi Keuangan (Tahap 1)': s.stage1Finance?.status === 'approved' ? 'DISETUJUI' : s.stage1Finance?.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU',
      'Petugas Keuangan': s.stage1Finance?.verifiedBy || '-',
      'Pengesahan Panitia (Tahap 2)': s.stage2Committee?.status === 'approved' ? 'DISAHKAN' : s.stage2Committee?.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU',
      'Petugas Panitia': s.stage2Committee?.verifiedBy || '-',
      'Nomor Peserta Resmi': s.stage2Committee?.officialNumber || '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 14 },
      { wch: 24 },
      { wch: 30 },
      { wch: 10 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Pendaftaran_PKS');
    XLSX.writeFile(wb, `Rekap_Pendaftaran_PKS_Semua_Sekolah_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Rekap pendaftaran berhasil diunduh (.xlsx)', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Quick Metrics Strip */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-blue-600/30 border border-blue-500/40 rounded-lg text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
              Admin & Committee Dashboard
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
            Rekap & Verifikasi Berkas Pendaftaran Sekolah
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola berkas pengajuan mandiri dari akun sekolah, bukti transfer, dan verifikasi 2-tahap (Keuangan & Panitia)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Rekap Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Score Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Pengajuan</span>
          <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-400">Seluruh berkas sekolah</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase block">Belum Bayar</span>
          <span className="text-xl font-black text-amber-600 font-mono mt-1 block">
            {stats.unpaid}
          </span>
          <span className="text-[10px] text-slate-400">Tagihan tersimpan</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase block">Verif Keuangan</span>
          <span className="text-xl font-black text-blue-600 font-mono mt-1 block">
            {stats.pendingFinance}
          </span>
          <span className="text-[10px] text-slate-400">Menunggu cek mutasi</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-600 uppercase block">Verif Panitia</span>
          <span className="text-xl font-black text-indigo-600 font-mono mt-1 block">
            {stats.pendingCommittee}
          </span>
          <span className="text-[10px] text-slate-400">Menunggu pengesahan</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase block">Disahkan Resmi</span>
          <span className="text-xl font-black text-emerald-600 font-mono mt-1 block">
            {stats.fullyApproved}
          </span>
          <span className="text-[10px] text-slate-400">Pendaftaran sah 100%</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-700 uppercase block">Dana Masuk</span>
          <span className="text-sm sm:text-base font-black text-emerald-700 font-mono mt-1 block truncate">
            {formatRupiah(stats.totalRevenue)}
          </span>
          <span className="text-[10px] text-slate-400">Kas pendaftaran</span>
        </div>
      </div>

      {/* 3. Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama sekolah, siswa, NISN, atau no HP..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Filter Form Type */}
          <div>
            <select
              value={filterFormType}
              onChange={e => setFilterFormType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Jenis Formulir</option>
              <option value="polisi_pelajar">1. Polisi Pelajar</option>
              <option value="calon_pks">2. Calon Anggota PKS</option>
              <option value="kemah_balok1">3. Kemah PKS Balok 1</option>
              <option value="pks_balok2">4. Ujian Balok 2</option>
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status Pendaftaran</option>
              <option value="unpaid">Belum Dibayar</option>
              <option value="pending_finance">Menunggu Verif Keuangan</option>
              <option value="pending_committee">Menunggu Verif Panitia</option>
              <option value="fully_approved">Sah & Disahkan 100%</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Submissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3">Asal Sekolah & Jenjang</th>
                <th className="py-3 px-3">Nama Pendaftar</th>
                <th className="py-3 px-3">Jenis Formulir</th>
                <th className="py-3 px-3">Biaya & Metode</th>
                <th className="py-3 px-3 text-center">Tahap 1: Keuangan</th>
                <th className="py-3 px-3 text-center">Tahap 2: Panitia</th>
                <th className="py-3 px-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada berkas pendaftaran yang cocok.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Data yang diinputkan akun sekolah secara mandiri akan langsung muncul di tabel ini secara real-time.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const isStage1Approved = sub.stage1Finance?.status === 'approved';
                  const isStage2Approved = sub.stage2Committee?.status === 'approved';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{sub.schoolName}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-semibold">{sub.schoolLevel}</span>
                          <span>·</span>
                          <span className="font-mono text-[10px]">@{sub.schoolUsername}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{sub.applicantName}</div>
                        <div className="text-[11px] text-slate-500">
                          {sub.contactWa || sub.formData?.noHp || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700 text-[11px]">
                          {getFormLabel(sub.formType)}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('id-ID') : '-'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900">
                          {sub.feeAmount === 0 ? 'Gratis' : formatRupiah(sub.feeAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-500">
                          <span className="capitalize">{sub.paymentMethod?.replace('_', ' ')}</span>
                          {sub.paymentProofUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomProofUrl(sub.paymentProofUrl!)}
                              className="text-blue-600 hover:text-blue-800 underline font-semibold text-[10px] ml-1 cursor-pointer"
                            >
                              [Bukti Bayar]
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Stage 1: Finance */}
                      <td className="py-3 px-3 text-center">
                        {sub.stage1Finance?.status === 'approved' ? (
                          <div className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Valid (Lunas)</span>
                          </div>
                        ) : sub.stage1Finance?.status === 'rejected' ? (
                          <div className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Ditolak</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenStage1(sub)}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span>Verif Keuangan</span>
                          </button>
                        )}
                      </td>

                      {/* Stage 2: Committee */}
                      <td className="py-3 px-3 text-center">
                        {sub.stage2Committee?.status === 'approved' ? (
                          <div className="inline-flex flex-col items-center">
                            <div className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                              <Shield className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Disahkan</span>
                            </div>
                            {sub.stage2Committee.officialNumber && (
                              <span className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">
                                {sub.stage2Committee.officialNumber}
                              </span>
                            )}
                          </div>
                        ) : sub.stage2Committee?.status === 'rejected' ? (
                          <div className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Ditolak</span>
                          </div>
                        ) : !isStage1Approved ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Tunggu Tahap 1
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenStage2(sub)}
                            className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Sahkan Berkas</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Lihat Detail Berkas Formulir"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSubmission(sub.id, sub.applicantName)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="Hapus Berkas Pengajuan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: DETAIL BERKAS LENGKAP */}
      {selectedSubmission && !verifyModalType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Detail Formulir Registrasi Mandiri</h3>
                  <p className="text-[11px] text-slate-400">
                    {getFormLabel(selectedSubmission.formType)} · ID: {selectedSubmission.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Asal Sekolah & Status Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Asal Sekolah</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSubmission.schoolName}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Jenjang: {selectedSubmission.schoolLevel}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Pendaftar / Siswa</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSubmission.applicantName}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Kontak: {selectedSubmission.contactWa || '-'}</span>
                </div>
              </div>

              {/* Status Pembayaran & 2-Tahap Verification */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>Status Pembayaran & Verifikasi 2-Tahap</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    Biaya: {formatRupiah(selectedSubmission.feeAmount)}
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Tahap 1: Keuangan */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Tahap 1: Admin Keuangan</span>
                    <div className="flex items-center gap-1.5">
                      {selectedSubmission.stage1Finance?.status === 'approved' ? (
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui (Lunas)
                        </span>
                      ) : selectedSubmission.stage1Finance?.status === 'rejected' ? (
                        <span className="font-bold text-rose-600 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Ditolak
                        </span>
                      ) : (
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Verifikasi
                        </span>
                      )}
                    </div>
                    {selectedSubmission.stage1Finance?.verifiedBy && (
                      <p className="text-[11px] text-slate-500">
                        Oleh: {selectedSubmission.stage1Finance.verifiedBy} ({selectedSubmission.stage1Finance.verifiedAt})
                      </p>
                    )}
                    {selectedSubmission.stage1Finance?.note && (
                      <p className="text-[11px] text-slate-600 italic mt-1 bg-slate-50 p-1.5 rounded">
                        Catatan: "{selectedSubmission.stage1Finance.note}"
                      </p>
                    )}
                    {selectedSubmission.stage1Finance?.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleOpenStage1(selectedSubmission)}
                        className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        Verifikasi Keuangan Sekarang
                      </button>
                    )}
                  </div>

                  {/* Tahap 2: Panitia */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Tahap 2: Panitia Pelaksana</span>
                    <div className="flex items-center gap-1.5">
                      {selectedSubmission.stage2Committee?.status === 'approved' ? (
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Disahkan Resmi
                        </span>
                      ) : selectedSubmission.stage2Committee?.status === 'rejected' ? (
                        <span className="font-bold text-rose-600 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Ditolak
                        </span>
                      ) : (
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Pengesahan
                        </span>
                      )}
                    </div>
                    {selectedSubmission.stage2Committee?.officialNumber && (
                      <p className="text-[11px] font-mono font-bold text-slate-800">
                        No. Registrasi: {selectedSubmission.stage2Committee.officialNumber}
                      </p>
                    )}
                    {selectedSubmission.stage2Committee?.verifiedBy && (
                      <p className="text-[11px] text-slate-500">
                        Oleh: {selectedSubmission.stage2Committee.verifiedBy} ({selectedSubmission.stage2Committee.verifiedAt})
                      </p>
                    )}
                    {selectedSubmission.stage1Finance?.status === 'approved' &&
                      selectedSubmission.stage2Committee?.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleOpenStage2(selectedSubmission)}
                          className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                        >
                          Sahkan Berkas Panitia
                        </button>
                      )}
                  </div>
                </div>

                {/* Bukti Bayar Preview if any */}
                {selectedSubmission.paymentProofUrl && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Foto Bukti Transfer:</span>
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedSubmission.paymentProofUrl}
                        alt="Bukti Transfer"
                        onClick={() => setZoomProofUrl(selectedSubmission.paymentProofUrl!)}
                        className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-xs cursor-pointer hover:opacity-90"
                      />
                      <div className="text-xs text-slate-500">
                        <button
                          type="button"
                          onClick={() => setZoomProofUrl(selectedSubmission.paymentProofUrl!)}
                          className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                        >
                          Klik untuk memperbesar foto struk transfer
                        </button>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Metode: {selectedSubmission.paymentMethod?.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rincian Seluruh Isian Formulir */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1">
                  Data Isian Formulir Siswa
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {Object.entries(selectedSubmission.formData || {}).map(([key, value]) => {
                    if (typeof value === 'object' || typeof value === 'function') return null;
                    return (
                      <div key={key} className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block truncate">
                          {key}
                        </span>
                        <span className="font-semibold text-slate-800 text-[11px] block break-words mt-0.5">
                          {String(value || '-')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-100/80 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: DIALOG VERIFIKASI TAHAP 1 (KEUANGAN) / TAHAP 2 (PANITIA) */}
      {verifyModalType && selectedSubmission && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {verifyModalType === 'stage1'
                      ? 'Verifikasi Pembayaran (Tahap 1: Keuangan)'
                      : 'Pengesahan Berkas (Tahap 2: Panitia)'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedSubmission.schoolName} · {selectedSubmission.applicantName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalType(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessVerification} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Tagihan</span>
                  <span className="text-sm font-black font-mono text-emerald-700">
                    {formatRupiah(selectedSubmission.feeAmount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Metode</span>
                  <span className="font-bold capitalize text-slate-800">
                    {selectedSubmission.paymentMethod?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Status Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Keputusan Verifikasi *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyActionStatus('approved')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      verifyActionStatus === 'approved'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Berkas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyActionStatus('rejected')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      verifyActionStatus === 'rejected'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Tolak Berkas</span>
                  </button>
                </div>
              </div>

              {/* Stage 2 Official Number Input */}
              {verifyModalType === 'stage2' && verifyActionStatus === 'approved' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nomor Registrasi / Nomor Induk Peserta Resmi
                  </label>
                  <input
                    type="text"
                    required
                    value={officialNumberInput}
                    onChange={e => setOfficialNumberInput(e.target.value)}
                    placeholder="Contoh: PKS-2026-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Nomor ini akan tercetak pada piagam dan kartu peserta resmi.
                  </p>
                </div>
              )}

              {/* Note / Alasan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Petugas (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={verifyNote}
                  onChange={e => setVerifyNote(e.target.value)}
                  placeholder={
                    verifyActionStatus === 'approved'
                      ? 'Contoh: Pembayaran valid sesuai mutasi bank...'
                      : 'Contoh: Bukti transfer buram atau nominal tidak sesuai...'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVerifyModalType(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Keputusan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ZOOM BUKTI TRANSFER IMAGE MODAL */}
      {zoomProofUrl && (
        <div
          onClick={() => setZoomProofUrl(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer no-print"
        >
          <div className="relative max-w-xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setZoomProofUrl(null)}
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-950"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomProofUrl}
              alt="Bukti Transfer Zoom"
              className="max-h-[80vh] w-auto object-contain mx-auto rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

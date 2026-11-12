import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  UserCheck,
  Shield,
  Award,
  Star,
  Search,
  Download,
  Filter,
  Eye,
  Building2,
  GraduationCap,
  FileSpreadsheet,
  Printer,
  X,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  FileText
} from 'lucide-react';
import { RegistrationSubmission, PaymentConfig } from '../lib/firebase';
import { AppUser, SchoolLevel } from '../App';

export type PksMemberCategory = 'all' | 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2';

interface MembersDirectoryViewProps {
  submissionsList: RegistrationSubmission[];
  currentUser: AppUser | null;
  paymentConfig?: PaymentConfig;
  onNavigateToForm?: (formTab: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface ExtractedMemberItem {
  id: string;
  submissionId: string;
  categoryKey: 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2';
  categoryLabel: string;
  studentName: string;
  schoolName: string;
  schoolLevel: SchoolLevel;
  identifier: string; // NISN or Team Name or Cert No
  classGrade?: string;
  gender?: string;
  pembinaName?: string;
  contactWa?: string;
  submissionDate: string;
  paymentStatus: 'unpaid' | 'pending_verification' | 'paid' | 'rejected';
  verificationStatus: string;
  fullData: Record<string, any>;
}

export const MembersDirectoryView: React.FC<MembersDirectoryViewProps> = ({
  submissionsList,
  currentUser,
  paymentConfig,
  onNavigateToForm,
  showToast
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PksMemberCategory>('all');
  const [selectedJenjang, setSelectedJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailModalItem, setDetailModalItem] = useState<ExtractedMemberItem | null>(null);

  // Flatten and extract individual member data from registrations
  const allMembers: ExtractedMemberItem[] = useMemo(() => {
    return submissionsList.map(sub => {
      let categoryLabel = 'Pendaftaran PKS';
      let studentName = sub.applicantName || 'Peserta';
      let identifier = '-';
      let classGrade = sub.formData?.kelas || '-';
      let gender = sub.formData?.jk || '-';
      let pembinaName = sub.formData?.namaPembina || '-';

      if (sub.formType === 'polisi_pelajar') {
        categoryLabel = 'Polisi Pelajar (Poljar)';
        studentName = sub.formData?.nama || sub.applicantName;
        identifier = sub.formData?.nisn ? `NISN: ${sub.formData.nisn}` : 'NISN: -';
      } else if (sub.formType === 'calon_pks') {
        categoryLabel = 'Calon Anggota PKS';
        studentName = sub.formData?.nama || sub.applicantName;
        identifier = sub.formData?.nisn ? `NISN: ${sub.formData.nisn}` : 'NISN: -';
      } else if (sub.formType === 'kemah_balok1') {
        categoryLabel = 'Kemah PKS Balok 1';
        studentName = sub.formData?.namaKetua
          ? `${sub.formData.namaKetua} (Ketua ${sub.formData.namaRegu || 'Regu'})`
          : sub.applicantName;
        identifier = sub.formData?.namaRegu
          ? `Regu: ${sub.formData.namaRegu} (${sub.formData.jumlahAnggota || '12 Anggota'})`
          : 'Regu Kemah';
        classGrade = sub.formData?.jumlahAnggota || '12 Anggota';
      } else if (sub.formType === 'pks_balok2') {
        categoryLabel = 'Ujian PKS Balok 2';
        studentName = sub.formData?.namaPeserta || sub.applicantName;
        identifier = sub.formData?.noSertifikatBalok1
          ? `Sertifikat B1: ${sub.formData.noSertifikatBalok1}`
          : 'Kualifikasi Balok 2';
      }

      let verificationStatus = 'Menunggu Verifikasi';
      if (sub.stage2Committee?.status === 'approved') {
        verificationStatus = 'Terverifikasi Panitia';
      } else if (sub.stage1Finance?.status === 'approved') {
        verificationStatus = 'Lolos Keuangan';
      } else if (sub.paymentStatus === 'unpaid') {
        verificationStatus = 'Belum Bayar';
      }

      return {
        id: sub.id,
        submissionId: sub.id,
        categoryKey: sub.formType,
        categoryLabel,
        studentName,
        schoolName: sub.schoolName,
        schoolLevel: sub.schoolLevel || 'SLTP',
        identifier,
        classGrade,
        gender,
        pembinaName,
        contactWa: sub.contactWa || sub.formData?.noHp || sub.formData?.noHpPembina || '-',
        submissionDate: sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) : '-',
        paymentStatus: sub.paymentStatus,
        verificationStatus,
        fullData: sub.formData || {}
      };
    });
  }, [submissionsList]);

  // Unique schools list for filtering
  const uniqueSchools = useMemo(() => {
    const set = new Set<string>();
    allMembers.forEach(m => {
      if (m.schoolName) set.add(m.schoolName);
    });
    return Array.from(set).sort();
  }, [allMembers]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = allMembers.length;
    const poljar = allMembers.filter(m => m.categoryKey === 'polisi_pelajar').length;
    const calon = allMembers.filter(m => m.categoryKey === 'calon_pks').length;
    const kemah = allMembers.filter(m => m.categoryKey === 'kemah_balok1').length;
    const balok2 = allMembers.filter(m => m.categoryKey === 'pks_balok2').length;
    const sltp = allMembers.filter(m => m.schoolLevel === 'SLTP').length;
    const slta = allMembers.filter(m => m.schoolLevel === 'SLTA').length;
    return { total, poljar, calon, kemah, balok2, sltp, slta };
  }, [allMembers]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return allMembers.filter(item => {
      // Category filter
      if (selectedCategory !== 'all' && item.categoryKey !== selectedCategory) {
        return false;
      }
      // Jenjang filter
      if (selectedJenjang !== 'all' && item.schoolLevel !== selectedJenjang) {
        return false;
      }
      // School filter
      if (selectedSchool !== 'all' && item.schoolName !== selectedSchool) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchSchool = item.schoolName.toLowerCase().includes(q);
        const matchId = item.identifier.toLowerCase().includes(q);
        const matchPembina = (item.pembinaName || '').toLowerCase().includes(q);
        const matchWa = (item.contactWa || '').includes(q);
        if (!matchName && !matchSchool && !matchId && !matchPembina && !matchWa) {
          return false;
        }
      }
      return true;
    });
  }, [allMembers, selectedCategory, selectedJenjang, selectedSchool, searchQuery]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredMembers.length === 0) {
      showToast('Tidak ada data anggota untuk diekspor!', 'error');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Data yang sedang difilter
    const rows = filteredMembers.map((m, idx) => ({
      'No': idx + 1,
      'Nama Siswa / Anggota': m.studentName,
      'Kategori PKS': m.categoryLabel,
      'Asal Pangkalan / Sekolah': m.schoolName,
      'Jenjang': m.schoolLevel,
      'Identitas / NISN / Regu': m.identifier,
      'Kelas': m.classGrade || '-',
      'Jenis Kelamin': m.gender || '-',
      'Pembina Pendamping': m.pembinaName || '-',
      'Kontak WA': m.contactWa || '-',
      'Tanggal Terdaftar': m.submissionDate,
      'Status Verifikasi': m.verificationStatus,
      'Status Pembayaran': m.paymentStatus === 'paid' ? 'Lunas' : m.paymentStatus === 'unpaid' ? 'Belum Lunas' : 'Menunggu Konfirmasi'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Direktori Anggota PKS');

    // Sheet 2: Rekap Per Kategori jika ekspor seluruhnya
    if (selectedCategory === 'all') {
      const catSummary = [
        { Kategori: 'Polisi Pelajar (Poljar)', 'Jumlah Anggota': stats.poljar },
        { Kategori: 'Calon Anggota PKS', 'Jumlah Anggota': stats.calon },
        { Kategori: 'Kemah PKS Balok 1', 'Jumlah Anggota/Regu': stats.kemah },
        { Kategori: 'Ujian PKS Balok 2', 'Jumlah Anggota': stats.balok2 },
        { Kategori: 'TOTAL ANGGOTA TERDAFTAR', 'Jumlah Anggota': stats.total }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(catSummary);
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan Kategori');
    }

    XLSX.writeFile(
      workbook,
      `Direktori_Nama_Anggota_PKS_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast('File Excel Direktori Anggota PKS berhasil diunduh!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-600/90 text-white rounded-2xl shadow-lg border border-emerald-400/30">
            <UserCheck className="w-7 h-7 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                Database Resmi Kontingen
              </span>
              <span className="text-xs text-blue-300 font-semibold">
                Tahun 2026
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">
              Daftar Nama-Nama Anggota PKS
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-0.5">
              Direktori lengkap seluruh nama siswa dan anggota Patroli Keamanan Sekolah yang didaftarkan oleh pihak sekolah ke masing-masing kategori kegiatan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md hover:shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          {onNavigateToForm && (
            <button
              type="button"
              onClick={() => onNavigateToForm('form_polisi_pelajar')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 text-blue-200" />
              <span>+ Daftarkan Anggota Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STATISTIC KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Card */}
        <div
          onClick={() => setSelectedCategory('all')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md border-blue-500 ring-2 ring-blue-400/40'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              selectedCategory === 'all' ? 'text-blue-100' : 'text-slate-500'
            }`}>
              Semua Anggota
            </span>
            <Users className={`w-4 h-4 ${selectedCategory === 'all' ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
          <p className={`text-[11px] mt-1 ${selectedCategory === 'all' ? 'text-blue-100' : 'text-slate-500'}`}>
            {stats.sltp} SLTP · {stats.slta} SLTA
          </p>
        </div>

        {/* Polisi Pelajar */}
        <div
          onClick={() => setSelectedCategory('polisi_pelajar')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            selectedCategory === 'polisi_pelajar'
              ? 'bg-blue-700 text-white shadow-md border-blue-600 ring-2 ring-blue-400/40'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              selectedCategory === 'polisi_pelajar' ? 'text-blue-100' : 'text-slate-500'
            }`}>
              Polisi Pelajar
            </span>
            <Shield className={`w-4 h-4 ${selectedCategory === 'polisi_pelajar' ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className="text-2xl font-black">{stats.poljar}</div>
          <p className={`text-[11px] mt-1 ${selectedCategory === 'polisi_pelajar' ? 'text-blue-100' : 'text-slate-500'}`}>
            Kategori #1 Poljar
          </p>
        </div>

        {/* Calon PKS */}
        <div
          onClick={() => setSelectedCategory('calon_pks')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            selectedCategory === 'calon_pks'
              ? 'bg-indigo-700 text-white shadow-md border-indigo-600 ring-2 ring-indigo-400/40'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              selectedCategory === 'calon_pks' ? 'text-indigo-100' : 'text-slate-500'
            }`}>
              Calon Anggota PKS
            </span>
            <UserCheck className={`w-4 h-4 ${selectedCategory === 'calon_pks' ? 'text-white' : 'text-indigo-600'}`} />
          </div>
          <div className="text-2xl font-black">{stats.calon}</div>
          <p className={`text-[11px] mt-1 ${selectedCategory === 'calon_pks' ? 'text-indigo-100' : 'text-slate-500'}`}>
            Kategori #2 Biodata PKS
          </p>
        </div>

        {/* Kemah Balok 1 */}
        <div
          onClick={() => setSelectedCategory('kemah_balok1')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            selectedCategory === 'kemah_balok1'
              ? 'bg-emerald-700 text-white shadow-md border-emerald-600 ring-2 ring-emerald-400/40'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              selectedCategory === 'kemah_balok1' ? 'text-emerald-100' : 'text-slate-500'
            }`}>
              Kemah Balok 1
            </span>
            <Award className={`w-4 h-4 ${selectedCategory === 'kemah_balok1' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-black">{stats.kemah}</div>
          <p className={`text-[11px] mt-1 ${selectedCategory === 'kemah_balok1' ? 'text-emerald-100' : 'text-slate-500'}`}>
            Kategori #3 Regu Kemah
          </p>
        </div>

        {/* Ujian Balok 2 */}
        <div
          onClick={() => setSelectedCategory('pks_balok2')}
          className={`p-4 rounded-2xl border transition cursor-pointer col-span-2 lg:col-span-1 ${
            selectedCategory === 'pks_balok2'
              ? 'bg-purple-700 text-white shadow-md border-purple-600 ring-2 ring-purple-400/40'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              selectedCategory === 'pks_balok2' ? 'text-purple-100' : 'text-slate-500'
            }`}>
              Ujian Balok 2
            </span>
            <Star className={`w-4 h-4 ${selectedCategory === 'pks_balok2' ? 'text-white' : 'text-purple-600'}`} />
          </div>
          <div className="text-2xl font-black">{stats.balok2}</div>
          <p className={`text-[11px] mt-1 ${selectedCategory === 'pks_balok2' ? 'text-purple-100' : 'text-slate-500'}`}>
            Kategori #4 Kader Inti
          </p>
        </div>
      </div>

      {/* 3. FILTER CONTROLS & SEARCH BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Category Segmented Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-slate-500 uppercase px-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Kategori:
            </span>
            {(
              [
                { key: 'all', label: `Semua Kategori (${stats.total})` },
                { key: 'polisi_pelajar', label: `Polisi Pelajar (${stats.poljar})` },
                { key: 'calon_pks', label: `Calon PKS (${stats.calon})` },
                { key: 'kemah_balok1', label: `Kemah Balok 1 (${stats.kemah})` },
                { key: 'pks_balok2', label: `Ujian Balok 2 (${stats.balok2})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedCategory(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                  selectedCategory === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Jenjang:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              {(['all', 'SLTP', 'SLTA'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedJenjang(lvl)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    selectedJenjang === lvl
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'all' ? 'Semua' : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Search Input & School Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama anggota, NISN, nama sekolah, atau pembina..."
              className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-64 shrink-0">
            <select
              value={selectedSchool}
              onChange={e => setSelectedSchool(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Pangkalan Sekolah ({uniqueSchools.length})</option>
              {uniqueSchools.map(sch => (
                <option key={sch} value={sch}>
                  {sch}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN MEMBERS DIRECTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-800">
              Menampilkan {filteredMembers.length} dari total {allMembers.length} Nama Anggota PKS
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Data tersinkronisasi otomatis dari berkas pendaftaran sekolah Cloud Firestore
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-4 min-w-[200px]">Nama Siswa / Anggota</th>
                <th className="py-3 px-3 min-w-[150px]">Kategori PKS</th>
                <th className="py-3 px-4 min-w-[200px]">Asal Pangkalan Sekolah</th>
                <th className="py-3 px-3 min-w-[160px]">Nomor Identitas / Regu</th>
                <th className="py-3 px-3 min-w-[150px]">Pembina & Kontak</th>
                <th className="py-3 px-3 text-center w-32">Status Verifikasi</th>
                <th className="py-3 px-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-600">
                        Belum ada anggota terdaftar sesuai filter yang dipilih
                      </p>
                      <p className="text-xs text-slate-400">
                        {allMembers.length === 0
                          ? 'Sekolah belum mengirimkan formulir pendaftaran anggota. Anda dapat mendaftarkan anggota baru melalui menu Formulir Pendaftaran PKS.'
                          : 'Coba ubah kata kunci pencarian, filter kategori, atau jenjang sekolah.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member, index) => {
                  let categoryBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Polisi Pelajar
                    </span>
                  );
                  if (member.categoryKey === 'calon_pks') {
                    categoryBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        Calon PKS
                      </span>
                    );
                  } else if (member.categoryKey === 'kemah_balok1') {
                    categoryBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Kemah Balok 1
                      </span>
                    );
                  } else if (member.categoryKey === 'pks_balok2') {
                    categoryBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        Ujian Balok 2
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setDetailModalItem(member)}
                      className="hover:bg-indigo-50/40 transition cursor-pointer group"
                    >
                      <td className="py-3 px-3 text-center text-slate-400">
                        {index + 1}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 group-hover:text-blue-600 transition block text-sm leading-tight">
                          {member.studentName}
                        </strong>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {member.gender && member.gender !== '-' && (
                            <span>{member.gender}</span>
                          )}
                          {member.classGrade && member.classGrade !== '-' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Kelas: {member.classGrade}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        {categoryBadge}
                      </td>

                      {/* School & Level */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase text-white shrink-0 ${
                              member.schoolLevel === 'SLTA' ? 'bg-indigo-600' : 'bg-blue-600'
                            }`}
                          >
                            {member.schoolLevel}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">
                            {member.schoolName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Terdaftar: {member.submissionDate}
                        </span>
                      </td>

                      {/* Identifier */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold block truncate max-w-[180px]">
                          {member.identifier}
                        </span>
                      </td>

                      {/* Pembina & WA */}
                      <td className="py-3 px-3">
                        <span className="block font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                          {member.pembinaName}
                        </span>
                        {member.contactWa && member.contactWa !== '-' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-mono">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            {member.contactWa}
                          </span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          member.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : member.paymentStatus === 'pending_verification'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {member.paymentStatus === 'paid' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600" />
                          )}
                          <span>{member.verificationStatus}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setDetailModalItem(member);
                          }}
                          title="Lihat Detail Biodata Anggota"
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DETAIL BIODATA ANGGOTA PKS */}
      {detailModalItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Rincian Biodata Anggota PKS
                  </h3>
                  <p className="text-xs text-blue-300">
                    {detailModalItem.categoryLabel} · {detailModalItem.schoolLevel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Primary Identity Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    {detailModalItem.categoryLabel}
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                    {detailModalItem.studentName}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{detailModalItem.schoolName}</span>
                    <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-black ml-1">
                      {detailModalItem.schoolLevel}
                    </span>
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                    detailModalItem.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {detailModalItem.verificationStatus}
                  </span>
                </div>
              </div>

              {/* Data Properties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Identitas / No. Registrasi</span>
                  <p className="font-bold text-slate-900 mt-0.5">{detailModalItem.identifier}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Kelas / Tingkat</span>
                  <p className="font-bold text-slate-900 mt-0.5">{detailModalItem.classGrade || '-'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Jenis Kelamin</span>
                  <p className="font-bold text-slate-900 mt-0.5">{detailModalItem.gender || '-'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal Terdaftar</span>
                  <p className="font-bold text-slate-900 mt-0.5">{detailModalItem.submissionDate}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Guru Pembina</span>
                  <p className="font-bold text-slate-900 mt-0.5">{detailModalItem.pembinaName || '-'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Kontak WhatsApp</span>
                  <p className="font-bold text-slate-900 mt-0.5 font-mono">{detailModalItem.contactWa || '-'}</p>
                </div>
              </div>

              {/* Additional Form Fields */}
              {Object.keys(detailModalItem.fullData).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Informasi Tambahan dari Formulir:
                  </span>
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-slate-600">
                    {detailModalItem.fullData.ttl && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Tempat, Tanggal Lahir:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.ttl}</span>
                      </div>
                    )}
                    {detailModalItem.fullData.alamat && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Alamat Rumah:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.alamat}</span>
                      </div>
                    )}
                    {detailModalItem.fullData.namaOrtu && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Nama Orang Tua / Wali:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.namaOrtu}</span>
                      </div>
                    )}
                    {detailModalItem.fullData.divisiMinat && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Divisi PKS yang Diminati:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.divisiMinat}</span>
                      </div>
                    )}
                    {detailModalItem.fullData.materiUji && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Materi Uji Kualifikasi:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.materiUji}</span>
                      </div>
                    )}
                    {detailModalItem.fullData.prestasi && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Prestasi Sebelumnya:</span>
                        <span className="font-semibold text-slate-800">{detailModalItem.fullData.prestasi}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              {onNavigateToForm && (
                <button
                  type="button"
                  onClick={() => {
                    const targetTab = detailModalItem.categoryKey === 'polisi_pelajar'
                      ? 'form_polisi_pelajar'
                      : detailModalItem.categoryKey === 'calon_pks'
                      ? 'form_calon_pks'
                      : detailModalItem.categoryKey === 'kemah_balok1'
                      ? 'form_perkemahan_balok1'
                      : 'form_perkemahan_balok2';
                    setDetailModalItem(null);
                    onNavigateToForm(targetTab);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Buka Form Blanko Cetak</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

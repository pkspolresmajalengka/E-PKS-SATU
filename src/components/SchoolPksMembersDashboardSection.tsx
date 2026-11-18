import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FilePlus2,
  Layers,
  Search,
  ShieldCheck,
  Users,
  ArrowRight,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { RegistrationSubmission } from '../lib/firebase';
import {
  PKS_TRACK_META,
  PksTrackKey,
  computeSchoolMemberStats,
  extractSchoolPksMembers
} from '../lib/pksMembersExtractor';

interface SchoolPksMembersDashboardSectionProps {
  submissionsList: RegistrationSubmission[];
  schoolDisplayName: string;
  schoolLevel?: 'SLTP' | 'SLTA';
  onNavigateTab: (tab: string) => void;
}

export const SchoolPksMembersDashboardSection: React.FC<SchoolPksMembersDashboardSectionProps> = ({
  submissionsList,
  schoolDisplayName,
  schoolLevel,
  onNavigateTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | PksTrackKey>('all');
  const [statusFilter, setStatusFilter] = useState<'verified' | 'all'>('verified');
  const [searchQuery, setSearchQuery] = useState('');

  const allSchoolMembers = useMemo(
    () => extractSchoolPksMembers(submissionsList),
    [submissionsList]
  );

  const stats = useMemo(
    () => computeSchoolMemberStats(allSchoolMembers),
    [allSchoolMembers]
  );

  const maxCategoryTotal = useMemo(() => {
    const highest = Math.max(...stats.categories.map(c => c.total), 0);
    return highest > 0 ? highest : 1;
  }, [stats.categories]);

  const filteredMemberNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSchoolMembers
      .filter(member => {
        if (statusFilter === 'verified' && !member.isVerified) return false;
        if (selectedCategory !== 'all' && member.categoryKey !== selectedCategory) return false;
        if (q) {
          const matchName = member.studentName.toLowerCase().includes(q);
          const matchId = member.identifier.toLowerCase().includes(q);
          const matchOfficial = member.officialNumber.toLowerCase().includes(q);
          const matchCat = member.categoryLabel.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchOfficial && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        return a.studentName.localeCompare(b.studentName, 'id');
      });
  }, [allSchoolMembers, statusFilter, selectedCategory, searchQuery]);

  const activeCategoryMeta = useMemo(
    () => PKS_TRACK_META.find(c => c.key === selectedCategory) || null,
    [selectedCategory]
  );

  const handleToggleCategory = (catKey: PksTrackKey) => {
    setSelectedCategory(prev => (prev === catKey ? 'all' : catKey));
  };

  return (
    <div className="space-y-6">
      {/* 1. 4 KARTU RINGKASAN ANGGOTA PKS SEKOLAH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Anggota Terdaftar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Anggota Terdaftar
            </span>
            <div className="text-3xl font-black text-slate-900 tabular-nums">
              {stats.totalRegistered}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block truncate">
              Siswa terdaftar dari {schoolDisplayName}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Sudah Terverifikasi Panitia */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-1">
              Terverifikasi Panitia
            </span>
            <div className="text-3xl font-black text-emerald-700 tabular-nums">
              {stats.totalVerified}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block tabular-nums">
              {stats.totalRegistered > 0
                ? `${stats.verificationRate}% resmi disahkan panitia`
                : 'Belum ada anggota terverifikasi'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Menunggu Verifikasi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block mb-1">
              Menunggu Verifikasi
            </span>
            <div className="text-3xl font-black text-amber-600 tabular-nums">
              {stats.pendingCount}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block tabular-nums">
              {stats.rejectedCount > 0
                ? `${stats.rejectedCount} perlu perbaikan berkas`
                : 'Dalam antrean verifikasi panitia'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Kategori Kegiatan Diikuti */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block mb-1">
              Kategori Diikuti
            </span>
            <div className="text-3xl font-black text-slate-900 tabular-nums">
              {stats.activeCategoriesCount}
              <span className="text-base font-bold text-slate-400"> / 4</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(stats.verifiedCategoriesCount / 4) * 100}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. GRAFIK PER KATEGORI KEGIATAN & DAFTAR NAMA ANGGOTA PKS TERVERIFIKASI */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
              <span>Grafik Anggota PKS Terdaftar & Terverifikasi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              <span>{schoolDisplayName}</span>
              {schoolLevel && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>Jenjang {schoolLevel}</span>
                </>
              )}
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">
                {stats.totalVerified} terverifikasi dari {stats.totalRegistered} anggota terdaftar
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Control Status Filter */}
            <div
              className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold"
              role="group"
              aria-label="Filter status anggota"
            >
              <button
                type="button"
                onClick={() => setStatusFilter('verified')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'verified'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Terverifikasi ({stats.totalVerified})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Terdaftar ({stats.totalRegistered})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama anggota atau No. Reg..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-56"
              />
            </div>
          </div>
        </div>

        {/* Main 12-Column Grid: Category Chart (Left 5) + Verified Names List (Right 7) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 5 COLS: INTERACTIVE CATEGORY BAR CHART */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Distribusi per Kategori Kegiatan
                </h4>
                <p className="text-xs text-slate-500">
                  Klik batang kategori untuk menyaring daftar nama
                </p>
              </div>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Semua Kategori
                </button>
              )}
            </div>

            {/* Horizontal Stacked Bar Chart */}
            <div className="space-y-3 pt-1">
              {stats.categories.map(cat => {
                const isSelected = selectedCategory === cat.key;
                const totalWidthPct =
                  cat.total > 0 ? Math.max(4, (cat.total / maxCategoryTotal) * 100) : 0;
                const verifiedRatioPct =
                  cat.total > 0 ? Math.round((cat.verified / cat.total) * 100) : 0;
                const verifiedOfTotalWidthPct =
                  cat.total > 0 ? (cat.verified / cat.total) * 100 : 0;

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleToggleCategory(cat.key)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {cat.label}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-700 shrink-0">
                        <strong className="text-emerald-700">{cat.verified}</strong>
                        <span className="text-slate-400"> / </span>
                        <span>{cat.total}</span>
                      </span>
                    </div>

                    {/* Visual Horizontal SVG/CSS Stacked Bar */}
                    <div className="h-3.5 w-full bg-slate-200/70 rounded-md overflow-hidden flex items-center">
                      {cat.total > 0 ? (
                        <div
                          className="h-full bg-blue-200 flex overflow-hidden rounded-md transition-all duration-300"
                          style={{ width: `${totalWidthPct}%` }}
                        >
                          {cat.verified > 0 && (
                            <div
                              className="h-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${verifiedOfTotalWidthPct}%` }}
                              title={`Terverifikasi: ${cat.verified}`}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="h-full w-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span className="tabular-nums">
                        {cat.total === 0
                          ? 'Belum ada anggota terdaftar'
                          : `${cat.verified} terverifikasi · ${cat.pending} menunggu`}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-600">
                        {verifiedRatioPct}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chart Legend & Quick Action Links */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>Terverifikasi Panitia</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-200 inline-block" />
                  <span>Terdaftar (Menunggu)</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('anggota_pks')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Direktori Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* RIGHT 7 COLS: DAFTAR NAMA ANGGOTA PKS TERDAFTAR & TERVERIFIKASI */}
          <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {statusFilter === 'verified'
                      ? 'Daftar Nama Anggota PKS Terverifikasi'
                      : 'Daftar Nama Anggota PKS Terdaftar'}
                    {activeCategoryMeta ? ` · ${activeCategoryMeta.shortLabel}` : ''}
                  </span>
                </h4>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-600 whitespace-nowrap shrink-0">
                {filteredMemberNames.length} Anggota
              </span>
            </div>

            {filteredMemberNames.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  {stats.totalRegistered === 0 ? (
                    <FilePlus2 className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <p className="text-sm font-bold text-slate-800">
                    {stats.totalRegistered === 0
                      ? 'Belum ada anggota PKS terdaftar untuk sekolah ini'
                      : statusFilter === 'verified' && stats.totalVerified === 0
                      ? 'Belum ada anggota yang disahkan panitia'
                      : 'Tidak ada nama anggota yang cocok dengan filter'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {stats.totalRegistered === 0
                      ? 'Daftarkan anggota Polisi Pelajar, Calon PKS, Kemah Balok 1, atau Ujian Balok 2 melalui menu Formulir Pendaftaran PKS.'
                      : statusFilter === 'verified' && stats.totalVerified === 0
                      ? `Saat ini terdapat ${stats.totalRegistered} anggota terdaftar yang masih menunggu pengesahan panitia. Anda dapat melihatnya dengan memilih tab "Semua Terdaftar".`
                      : 'Coba hapus kata kunci pencarian atau pilih "Semua Kategori" pada grafik di sebelah kiri.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {stats.totalRegistered === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('pendaftaran')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Buka Formulir Pendaftaran PKS
                    </button>
                  ) : (
                    <>
                      {statusFilter === 'verified' && stats.totalRegistered > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter('all')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Lihat Semua Terdaftar ({stats.totalRegistered})
                        </button>
                      )}
                      {(selectedCategory !== 'all' || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('all');
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {filteredMemberNames.map((member, index) => (
                  <div
                    key={member.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xs font-mono tabular-nums font-bold text-slate-400 pt-0.5 shrink-0 w-6">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {member.studentName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="font-semibold text-slate-700">{member.shortCategoryLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{member.identifier}</span>
                          {member.gender && member.gender !== '-' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{member.gender}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Daftar {member.submissionDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pl-9 sm:pl-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      {member.isVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Terverifikasi</span>
                        </span>
                      ) : member.verificationState === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 whitespace-nowrap">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Perlu Perbaikan</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{member.verificationLabel}</span>
                        </span>
                      )}

                      {member.officialNumber && (
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          No. {member.officialNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

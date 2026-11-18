import React, { useMemo, useState } from 'react';
import { BarChart3, Users, ArrowRight, FileText } from 'lucide-react';
import { RegistrationSubmission } from '../lib/firebase';
import {
  computeSchoolMemberStats,
  extractSchoolPksMembers,
  PksTrackKey
} from '../lib/pksMembersExtractor';

interface AdminPksCategoryChartProps {
  submissionsList: RegistrationSubmission[];
  onNavigateTab?: (tab: string) => void;
  canOpenRekapPendaftaran?: boolean;
}

const CATEGORY_ACCENTS: Record<
  PksTrackKey,
  { barVerified: string; barPending: string; labelHint: string }
> = {
  polisi_pelajar: {
    barVerified: 'bg-blue-600',
    barPending: 'bg-blue-200',
    labelHint: 'Jalur NIPP & seleksi Poljar'
  },
  calon_pks: {
    barVerified: 'bg-indigo-600',
    barPending: 'bg-indigo-200',
    labelHint: 'Biodata calon anggota baru'
  },
  kemah_balok1: {
    barVerified: 'bg-emerald-600',
    barPending: 'bg-emerald-200',
    labelHint: 'Perkemahan tingkat Balok 1'
  },
  pks_balok2: {
    barVerified: 'bg-purple-600',
    barPending: 'bg-purple-200',
    labelHint: 'Perkemahan & ujian Balok 2'
  }
};

export const AdminPksCategoryChart: React.FC<AdminPksCategoryChartProps> = ({
  submissionsList,
  onNavigateTab,
  canOpenRekapPendaftaran = false
}) => {
  const [jenjangFilter, setJenjangFilter] = useState<'all' | 'SLTP' | 'SLTA'>('all');

  const filteredSubmissions = useMemo(() => {
    if (jenjangFilter === 'all') return submissionsList;
    return submissionsList.filter(sub => (sub.schoolLevel || 'SLTP') === jenjangFilter);
  }, [submissionsList, jenjangFilter]);

  const allMembers = useMemo(
    () => extractSchoolPksMembers(filteredSubmissions),
    [filteredSubmissions]
  );

  const stats = useMemo(
    () => computeSchoolMemberStats(allMembers),
    [allMembers]
  );

  const uniqueSchoolCount = useMemo(() => {
    const set = new Set<string>();
    allMembers.forEach(m => {
      const name = (m.schoolName || '').trim().toLowerCase();
      if (name) set.add(name);
    });
    return set.size;
  }, [allMembers]);

  const maxCategoryTotal = useMemo(() => {
    const highest = Math.max(...stats.categories.map(c => c.total), 0);
    return highest > 0 ? highest : 1;
  }, [stats.categories]);

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Grafik Jumlah Anggota PKS Berdasarkan Kategorinya</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
            <span>
              Total <strong className="text-slate-800">{stats.totalRegistered}</strong> anggota terdaftar
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-emerald-700">{stats.totalVerified}</strong> terverifikasi ({stats.verificationRate}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-amber-700">{stats.pendingCount}</strong> menunggu
            </span>
            {stats.rejectedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-rose-700">{stats.rejectedCount}</strong> ditolak
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{uniqueSchoolCount} sekolah</span>
          </p>
        </div>

        {/* Filter Jenjang & Quick Links */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold"
            role="group"
            aria-label="Filter jenjang anggota PKS"
          >
            {(['all', 'SLTP', 'SLTA'] as const).map(j => (
              <button
                key={j}
                type="button"
                onClick={() => setJenjangFilter(j)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                  jenjangFilter === j
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {j === 'all' ? 'Semua Jenjang' : j}
              </button>
            ))}
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('anggota_pks')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Direktori Anggota</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
            </button>
          )}
        </div>
      </div>

      {/* Bar Chart Body */}
      {stats.totalRegistered === 0 ? (
        <div className="py-10 px-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-bold text-slate-800">
              {jenjangFilter === 'all'
                ? 'Belum ada pendaftar anggota PKS dari sekolah'
                : `Belum ada pendaftar anggota PKS pada jenjang ${jenjangFilter}`}
            </p>
            <p className="text-xs text-slate-500">
              Jumlah anggota dari formulir Polisi Pelajar, Calon PKS, Kemah Balok 1, dan Ujian Balok 2 akan otomatis tampil di grafik ini.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {jenjangFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setJenjangFilter('all')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
              >
                Tampilkan Semua Jenjang
              </button>
            )}
            {canOpenRekapPendaftaran && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('rekap_pendaftaran')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Buka Rekap Pendaftaran</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Category Bar Rows */}
          <div className="divide-y divide-slate-100">
            {stats.categories.map(cat => {
              const accent = CATEGORY_ACCENTS[cat.key];
              const totalWidthPct =
                cat.total > 0 ? Math.max(3, (cat.total / maxCategoryTotal) * 100) : 0;
              const verifiedSharePct =
                cat.total > 0 ? (cat.verified / cat.total) * 100 : 0;
              const pendingSharePct =
                cat.total > 0 ? (cat.pending / cat.total) * 100 : 0;
              const rejectedSharePct =
                cat.total > 0 ? (cat.rejected / cat.total) * 100 : 0;
              const shareOfAllPct =
                stats.totalRegistered > 0
                  ? Math.round((cat.total / stats.totalRegistered) * 100)
                  : 0;

              return (
                <div key={cat.key} className="py-4 first:pt-1 last:pb-1 space-y-2.5">
                  {/* Top Row: Category Name + Total & Share */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
                    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold text-slate-900">
                        {cat.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {accent.labelHint}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3 text-xs font-mono tabular-nums shrink-0">
                      <span className="text-slate-500">
                        Porsi {shareOfAllPct}%
                      </span>
                      <span className="text-base font-black text-slate-900">
                        {cat.total}{' '}
                        <span className="font-sans text-xs font-semibold text-slate-500">
                          Anggota
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Proportional Stacked Bar */}
                  <div
                    className="h-5 w-full bg-slate-100 rounded-lg overflow-hidden flex items-center"
                    role="img"
                    aria-label={`${cat.label}: ${cat.total} anggota (${cat.verified} terverifikasi, ${cat.pending} menunggu, ${cat.rejected} ditolak)`}
                  >
                    {cat.total > 0 && (
                      <div
                        className="h-full flex overflow-hidden rounded-lg transition-all duration-500"
                        style={{ width: `${totalWidthPct}%` }}
                      >
                        {cat.verified > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${verifiedSharePct}%` }}
                            title={`Terverifikasi Panitia: ${cat.verified} anggota`}
                          />
                        )}
                        {cat.pending > 0 && (
                          <div
                            className="h-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${pendingSharePct}%` }}
                            title={`Menunggu Verifikasi / Bayar: ${cat.pending} anggota`}
                          />
                        )}
                        {cat.rejected > 0 && (
                          <div
                            className="h-full bg-rose-500 transition-all duration-500"
                            style={{ width: `${rejectedSharePct}%` }}
                            title={`Perlu Perbaikan / Ditolak: ${cat.rejected} anggota`}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Metadata Row: Status Breakdown */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                      <span className="text-emerald-700 font-semibold">
                        Terverifikasi: <strong className="font-mono">{cat.verified}</strong>
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-amber-700 font-semibold">
                        Menunggu: <strong className="font-mono">{cat.pending}</strong>
                      </span>
                      {cat.rejected > 0 && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-rose-700 font-semibold">
                            Ditolak: <strong className="font-mono">{cat.rejected}</strong>
                          </span>
                        </>
                      )}
                    </div>

                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {cat.total > 0
                        ? `${Math.round((cat.verified / cat.total) * 100)}% terverifikasi`
                        : '0% terverifikasi'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Legend & Total Strip */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block shrink-0" />
                <span>Terverifikasi Panitia ({stats.totalVerified})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block shrink-0" />
                <span>Menunggu Verifikasi / Bayar ({stats.pendingCount})</span>
              </span>
              {stats.rejectedCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block shrink-0" />
                  <span>Ditolak / Perbaikan ({stats.rejectedCount})</span>
                </span>
              )}
            </div>

            {canOpenRekapPendaftaran && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('rekap_pendaftaran')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Kelola Verifikasi Pendaftaran</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

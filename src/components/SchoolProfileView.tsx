import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users
} from 'lucide-react';
import type { AppUser, SchoolLevel, SchoolProfileData } from '../App';
import { CloudWriteResult } from '../lib/firebase';
import { compressImageFile } from '../lib/imageUtils';
import { NetworkErrorBanner, NetworkErrorState } from './NetworkErrorBanner';

interface SchoolProfileViewProps {
  currentUser: AppUser;
  usersList: AppUser[];
  isAdminRole: boolean;
  isSekolahAccount: boolean;
  onSaveSchoolProfile: (updatedUser: AppUser) => Promise<CloudWriteResult>;
  onOpenSchoolAccountManager?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface ProfileCompletenessSummary {
  filledCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
}

export function computeSchoolProfileCompleteness(user: AppUser): ProfileCompletenessSummary {
  const sp = user.schoolProfile || {};
  const checks = [
    Boolean((user.schoolName || user.name || '').trim()),
    Boolean(user.schoolLevel),
    Boolean((sp.npsn || '').trim()),
    Boolean((sp.statusSekolah || '').trim()),
    Boolean((sp.alamat || '').trim()),
    Boolean((sp.kecamatan || '').trim()),
    Boolean((sp.kabupaten || '').trim()),
    Boolean((sp.kepalaSekolah || '').trim()),
    Boolean((user.pembinaName || '').trim()),
    Boolean((user.contactWa || '').trim()),
    Boolean((sp.emailSekolah || '').trim()),
    Boolean((sp.logoUrl || '').trim())
  ];
  const filledCount = checks.filter(Boolean).length;
  const totalCount = checks.length;
  const percent = Math.round((filledCount / totalCount) * 100);
  return {
    filledCount,
    totalCount,
    percent,
    isComplete: percent >= 80
  };
}

interface ProfileFormState {
  schoolName: string;
  schoolLevel: SchoolLevel;
  npsn: string;
  statusSekolah: 'Negeri' | 'Swasta' | '';
  alamat: string;
  kecamatan: string;
  kabupaten: string;
  kodePos: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  pembinaName: string;
  contactWa: string;
  emailSekolah: string;
  teleponSekolah: string;
  mottoPks: string;
  logoUrl: string;
}

const buildFormStateFromUser = (user: AppUser): ProfileFormState => {
  const sp: SchoolProfileData = user.schoolProfile || {};
  return {
    schoolName: user.schoolName || user.name || '',
    schoolLevel: user.schoolLevel || 'SLTP',
    npsn: sp.npsn || '',
    statusSekolah: sp.statusSekolah || '',
    alamat: sp.alamat || '',
    kecamatan: sp.kecamatan || '',
    kabupaten: sp.kabupaten || 'Majalengka',
    kodePos: sp.kodePos || '',
    kepalaSekolah: sp.kepalaSekolah || '',
    nipKepalaSekolah: sp.nipKepalaSekolah || '',
    pembinaName: user.pembinaName || '',
    contactWa: user.contactWa || '',
    emailSekolah: sp.emailSekolah || '',
    teleponSekolah: sp.teleponSekolah || '',
    mottoPks: sp.mottoPks || '',
    logoUrl: sp.logoUrl || ''
  };
};

export const SchoolProfileView: React.FC<SchoolProfileViewProps> = ({
  currentUser,
  usersList,
  isAdminRole,
  isSekolahAccount,
  onSaveSchoolProfile,
  onOpenSchoolAccountManager,
  showToast
}) => {
  const schoolAccounts = useMemo(
    () =>
      usersList
        .filter(u => u.role === 'sekolah')
        .sort((a, b) =>
          (a.schoolName || a.name || '').localeCompare(b.schoolName || b.name || '', 'id')
        ),
    [usersList]
  );

  const [selectedSchoolUsername, setSelectedSchoolUsername] = useState<string | null>(() =>
    isSekolahAccount ? currentUser.username : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJenjang, setFilterJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [filterCompleteness, setFilterCompleteness] = useState<'all' | 'complete' | 'incomplete'>('all');

  const targetUser: AppUser | null = useMemo(() => {
    if (isSekolahAccount) {
      return (
        usersList.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase()) ||
        currentUser
      );
    }
    if (!selectedSchoolUsername) return null;
    return (
      schoolAccounts.find(u => u.username.toLowerCase() === selectedSchoolUsername.toLowerCase()) ||
      null
    );
  }, [isSekolahAccount, currentUser, usersList, selectedSchoolUsername, schoolAccounts]);

  const canEditTarget = Boolean(
    targetUser &&
      (isAdminRole ||
        (isSekolahAccount &&
          targetUser.username.toLowerCase() === currentUser.username.toLowerCase()))
  );

  const [formState, setFormState] = useState<ProfileFormState>(() =>
    targetUser ? buildFormStateFromUser(targetUser) : buildFormStateFromUser(currentUser)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [networkError, setNetworkError] = useState<NetworkErrorState | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (targetUser) {
      setFormState(buildFormStateFromUser(targetUser));
      setNetworkError(null);
    }
  }, [targetUser]);

  // Keep selectedSchoolUsername synced when role switches
  useEffect(() => {
    if (isSekolahAccount) {
      setSelectedSchoolUsername(currentUser.username);
    }
  }, [isSekolahAccount, currentUser.username]);

  const directoryStats = useMemo(() => {
    const total = schoolAccounts.length;
    let complete = 0;
    schoolAccounts.forEach(acc => {
      if (computeSchoolProfileCompleteness(acc).isComplete) complete++;
    });
    return {
      total,
      complete,
      incomplete: Math.max(0, total - complete)
    };
  }, [schoolAccounts]);

  const filteredSchoolAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return schoolAccounts.filter(acc => {
      const level = acc.schoolLevel || 'SLTP';
      if (filterJenjang !== 'all' && level !== filterJenjang) return false;
      const comp = computeSchoolProfileCompleteness(acc);
      if (filterCompleteness === 'complete' && !comp.isComplete) return false;
      if (filterCompleteness === 'incomplete' && comp.isComplete) return false;
      if (q) {
        const sp = acc.schoolProfile || {};
        const haystack = [
          acc.schoolName,
          acc.name,
          acc.username,
          acc.pembinaName,
          acc.contactWa,
          sp.npsn,
          sp.kecamatan,
          sp.kabupaten,
          sp.kepalaSekolah
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [schoolAccounts, searchQuery, filterJenjang, filterCompleteness]);

  const targetCompleteness = useMemo(() => {
    if (!targetUser) return null;
    const previewUser: AppUser = {
      ...targetUser,
      schoolName: formState.schoolName,
      schoolLevel: formState.schoolLevel,
      pembinaName: formState.pembinaName,
      contactWa: formState.contactWa,
      schoolProfile: {
        ...(targetUser.schoolProfile || {}),
        npsn: formState.npsn,
        statusSekolah: formState.statusSekolah || undefined,
        alamat: formState.alamat,
        kecamatan: formState.kecamatan,
        kabupaten: formState.kabupaten,
        kodePos: formState.kodePos,
        kepalaSekolah: formState.kepalaSekolah,
        nipKepalaSekolah: formState.nipKepalaSekolah,
        emailSekolah: formState.emailSekolah,
        teleponSekolah: formState.teleponSekolah,
        mottoPks: formState.mottoPks,
        logoUrl: formState.logoUrl
      }
    };
    return computeSchoolProfileCompleteness(previewUser);
  }, [targetUser, formState]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditTarget) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih file gambar (PNG, JPG, WEBP, atau SVG).', 'error');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 6 MB.', 'error');
      return;
    }
    setIsCompressingLogo(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 480,
        maxDataUrlBytes: 120 * 1024,
        preferPng: file.type === 'image/png'
      });
      setFormState(prev => ({ ...prev, logoUrl: compressed }));
      showToast('Logo sekolah dimuat. Klik "Simpan Profile Sekolah" untuk menyimpan.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Gagal memproses gambar logo sekolah.', 'error');
    } finally {
      setIsCompressingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const executeSaveProfile = async () => {
    if (!targetUser || !canEditTarget || isSaving) return;

    const cleanSchoolName = formState.schoolName.trim();
    if (!cleanSchoolName) {
      showToast('Nama lengkap sekolah wajib diisi!', 'error');
      return;
    }

    setNetworkError(null);
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedProfile: SchoolProfileData = {
        npsn: formState.npsn.trim(),
        statusSekolah: formState.statusSekolah || undefined,
        alamat: formState.alamat.trim(),
        kecamatan: formState.kecamatan.trim(),
        kabupaten: formState.kabupaten.trim(),
        kodePos: formState.kodePos.trim(),
        kepalaSekolah: formState.kepalaSekolah.trim(),
        nipKepalaSekolah: formState.nipKepalaSekolah.trim(),
        emailSekolah: formState.emailSekolah.trim(),
        teleponSekolah: formState.teleponSekolah.trim(),
        mottoPks: formState.mottoPks.trim(),
        logoUrl: formState.logoUrl.trim(),
        updatedAt: nowIso
      };

      const updatedUser: AppUser = {
        ...targetUser,
        name: cleanSchoolName,
        schoolName: cleanSchoolName,
        schoolLevel: formState.schoolLevel,
        pembinaName: formState.pembinaName.trim(),
        contactWa: formState.contactWa.trim(),
        schoolProfile: updatedProfile
      };

      const res = await onSaveSchoolProfile(updatedUser);
      if (!res.success && !res.queuedOffline && !res.isQuotaError) {
        setNetworkError({
          title: 'Gagal Menyimpan Profile Sekolah ke Cloud',
          message: res.error || 'Terjadi gangguan jaringan saat menyimpan profil sekolah.',
          isNetworkError: res.isNetworkError,
          onRetry: () => void executeSaveProfile()
        });
        return;
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSaveProfile();
  };

  const formatUpdatedAt = (iso?: string): string => {
    if (!iso) return 'Belum pernah diperbarui';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  // ==============================================================
  // VIEW A: ADMIN / NON-SCHOOL DIRECTORY OF REGISTERED SCHOOLS
  // ==============================================================
  if (!isSekolahAccount && !targetUser) {
    return (
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-blue-600 shrink-0" />
              <span>Direktori Profile Sekolah</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pantau kelengkapan identitas pangkalan sekolah terdaftar dan kelola profil resmi masing-masing sekolah.
            </p>
          </div>
          {isAdminRole && onOpenSchoolAccountManager && (
            <button
              type="button"
              onClick={onOpenSchoolAccountManager}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Kelola Akun Login Sekolah</span>
            </button>
          )}
        </div>

        {/* 3 Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Total Akun Sekolah
              </span>
              <div className="text-3xl font-black text-slate-900 tabular-nums">
                {directoryStats.total}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Pangkalan terdaftar</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                Profil Lengkap
              </span>
              <div className="text-3xl font-black text-emerald-700 tabular-nums">
                {directoryStats.complete}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Kelengkapan minimal 80%</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block mb-1">
                Perlu Dilengkapi
              </span>
              <div className="text-3xl font-black text-amber-600 tabular-nums">
                {directoryStats.incomplete}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Menunggu pengisian sekolah</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters + Directory List */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama sekolah, NPSN, pembina, atau kecamatan..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                {(['all', 'SLTP', 'SLTA'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFilterJenjang(lvl)}
                    className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterJenjang === lvl
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'all' ? 'Semua Jenjang' : lvl}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                {(
                  [
                    { key: 'all', label: 'Semua Status' },
                    { key: 'complete', label: 'Lengkap' },
                    { key: 'incomplete', label: 'Belum Lengkap' }
                  ] as const
                ).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilterCompleteness(item.key)}
                    className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterCompleteness === item.key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredSchoolAccounts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {schoolAccounts.length === 0
                  ? 'Belum ada akun sekolah terdaftar'
                  : 'Tidak ada profil sekolah yang cocok dengan filter'}
              </p>
              <p className="text-xs text-slate-500">
                {schoolAccounts.length === 0
                  ? 'Sekolah dapat mendaftar mandiri di halaman login atau ditambahkan melalui menu Kelola Akun Sekolah.'
                  : 'Coba ubah kata kunci pencarian atau reset filter jenjang dan status.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredSchoolAccounts.map(acc => {
                const sp = acc.schoolProfile || {};
                const comp = computeSchoolProfileCompleteness(acc);
                const schoolTitle = acc.schoolName || acc.name;
                return (
                  <div
                    key={acc.username}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {sp.logoUrl ? (
                          <img
                            src={sp.logoUrl}
                            alt={`Logo ${schoolTitle}`}
                            className="w-full h-full object-contain p-1"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 truncate">
                            {schoolTitle}
                          </h3>
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-blue-700">
                            {acc.schoolLevel || 'SLTP'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {sp.npsn ? `NPSN ${sp.npsn}` : 'NPSN belum diisi'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>@{acc.username}</span>
                          {sp.kecamatan && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Kec. {sp.kecamatan}</span>
                            </>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>
                            Kepsek:{' '}
                            <strong className="text-slate-800">
                              {sp.kepalaSekolah || '-'}
                            </strong>
                          </span>
                          <span>
                            Pembina:{' '}
                            <strong className="text-slate-800">
                              {acc.pembinaName || '-'}
                            </strong>
                          </span>
                          <span>
                            WA:{' '}
                            <strong className="font-mono text-slate-800">
                              {acc.contactWa || '-'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-15 md:pl-0">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span
                            className={comp.isComplete ? 'text-emerald-700' : 'text-amber-700'}
                          >
                            {comp.isComplete ? 'Lengkap' : 'Belum Lengkap'}
                          </span>
                          <span className="font-mono tabular-nums text-slate-600">
                            {comp.percent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              comp.isComplete ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${comp.percent}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSchoolUsername(acc.username)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer ${
                          isAdminRole
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        {isAdminRole ? (
                          <>
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Profil</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Profil</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================================================
  // VIEW B: PROFILE SEKOLAH FORM (SELF-SERVICE OR ADMIN EDITOR)
  // ==============================================================
  const displayTitle = formState.schoolName.trim() || targetUser?.schoolName || targetUser?.name || 'Profile Sekolah';
  const lastUpdatedText = formatUpdatedAt(targetUser?.schoolProfile?.updatedAt);

  return (
    <div className="space-y-6">
      <NetworkErrorBanner
        error={networkError}
        onDismiss={() => setNetworkError(null)}
      />

      {/* Top School Profile Summary Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {!isSekolahAccount && (
            <button
              type="button"
              onClick={() => setSelectedSchoolUsername(null)}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition shrink-0 cursor-pointer"
              title="Kembali ke Daftar Profile Sekolah"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
            {formState.logoUrl ? (
              <img
                src={formState.logoUrl}
                alt={`Logo ${displayTitle}`}
                className="w-full h-full object-contain p-1.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Building2 className="w-7 h-7 text-blue-600" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-blue-700">
              {isSekolahAccount ? 'Profile Pangkalan Sekolah Saya' : 'Detail Profile Sekolah'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 truncate mt-0.5">
              {displayTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>Jenjang {formState.schoolLevel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">@{targetUser?.username}</span>
              <span aria-hidden="true">·</span>
              <span>Diperbarui: {lastUpdatedText}</span>
            </p>
          </div>
        </div>

        {/* Profile Completeness Meter */}
        {targetCompleteness && (
          <div className="lg:w-64 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-700">Kelengkapan Data</span>
              <span
                className={`font-mono tabular-nums ${
                  targetCompleteness.isComplete ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {targetCompleteness.filledCount}/{targetCompleteness.totalCount} ({targetCompleteness.percent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  targetCompleteness.isComplete ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
                style={{ width: `${targetCompleteness.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {targetCompleteness.isComplete
                ? 'Profil pangkalan sudah terisi lengkap.'
                : 'Lengkapi kolom identitas, pimpinan, dan logo sekolah.'}
            </p>
          </div>
        )}
      </div>

      {/* Main School Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identitas Lengkap Sekolah */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <div className="border-b border-slate-200 pb-3.5 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>01. Identitas Lengkap Sekolah</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Data resmi satuan pendidikan yang digunakan pada direktori dan formulir pendaftaran PKS.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Lengkap Sekolah <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canEditTarget}
                value={formState.schoolName}
                onChange={e => setFormState(prev => ({ ...prev, schoolName: e.target.value }))}
                placeholder="Contoh: SMA Negeri 1 Majalengka"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                NPSN (Nomor Pokok Sekolah Nasional)
              </label>
              <input
                type="text"
                disabled={!canEditTarget}
                value={formState.npsn}
                onChange={e => setFormState(prev => ({ ...prev, npsn: e.target.value }))}
                placeholder="Contoh: 20213885"
                maxLength={20}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Jenjang Pendidikan
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['SLTP', 'SLTA'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    disabled={!canEditTarget}
                    onClick={() => setFormState(prev => ({ ...prev, schoolLevel: lvl }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      formState.schoolLevel === lvl
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {lvl === 'SLTP' ? 'SLTP (SMP / MTs)' : 'SLTA (SMA / SMK / MA)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Status Satuan Pendidikan
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Negeri', 'Swasta'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    disabled={!canEditTarget}
                    onClick={() => setFormState(prev => ({ ...prev, statusSekolah: st }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      formState.statusSekolah === st
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Sekolah {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Alamat Lengkap Sekolah</span>
              </label>
              <textarea
                rows={2}
                disabled={!canEditTarget}
                value={formState.alamat}
                onChange={e => setFormState(prev => ({ ...prev, alamat: e.target.value }))}
                placeholder="Contoh: Jl. K.H. Abdul Halim No. 113, Majalengka Kulon"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:col-span-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kecamatan
                </label>
                <input
                  type="text"
                  disabled={!canEditTarget}
                  value={formState.kecamatan}
                  onChange={e => setFormState(prev => ({ ...prev, kecamatan: e.target.value }))}
                  placeholder="Contoh: Majalengka"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kabupaten / Kota
                </label>
                <input
                  type="text"
                  disabled={!canEditTarget}
                  value={formState.kabupaten}
                  onChange={e => setFormState(prev => ({ ...prev, kabupaten: e.target.value }))}
                  placeholder="Contoh: Kabupaten Majalengka"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode Pos
                </label>
                <input
                  type="text"
                  disabled={!canEditTarget}
                  value={formState.kodePos}
                  onChange={e => setFormState(prev => ({ ...prev, kodePos: e.target.value }))}
                  placeholder="45418"
                  maxLength={10}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pimpinan Sekolah & Pembina PKS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <div className="border-b border-slate-200 pb-3.5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>02. Kepala Sekolah & Pembina PKS</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Penanggung jawab satuan pendidikan serta pembina/pelatih pangkalan PKS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Kepala Sekolah
              </label>
              <input
                type="text"
                disabled={!canEditTarget}
                value={formState.kepalaSekolah}
                onChange={e => setFormState(prev => ({ ...prev, kepalaSekolah: e.target.value }))}
                placeholder="Nama lengkap beserta gelar"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                NIP / NIY Kepala Sekolah
              </label>
              <input
                type="text"
                disabled={!canEditTarget}
                value={formState.nipKepalaSekolah}
                onChange={e => setFormState(prev => ({ ...prev, nipKepalaSekolah: e.target.value }))}
                placeholder="Opsional (jika ada)"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Guru Pembina PKS
              </label>
              <input
                type="text"
                disabled={!canEditTarget}
                value={formState.pembinaName}
                onChange={e => setFormState(prev => ({ ...prev, pembinaName: e.target.value }))}
                placeholder="Contoh: Drs. Ahmad Hidayat, M.Pd."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nomor WhatsApp Pembina</span>
              </label>
              <input
                type="tel"
                disabled={!canEditTarget}
                value={formState.contactWa}
                onChange={e => setFormState(prev => ({ ...prev, contactWa: e.target.value }))}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Kontak Resmi, Motto & Logo Sekolah */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <div className="border-b border-slate-200 pb-3.5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>03. Kontak Resmi, Motto & Logo Sekolah</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Informasi kontak resmi sekolah serta unggah lambang/logo satuan sekolah Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Resmi Sekolah</span>
                </label>
                <input
                  type="email"
                  disabled={!canEditTarget}
                  value={formState.emailSekolah}
                  onChange={e => setFormState(prev => ({ ...prev, emailSekolah: e.target.value }))}
                  placeholder="Contoh: info@sman1majalengka.sch.id"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Telepon Kantor Sekolah
                </label>
                <input
                  type="tel"
                  disabled={!canEditTarget}
                  value={formState.teleponSekolah}
                  onChange={e => setFormState(prev => ({ ...prev, teleponSekolah: e.target.value }))}
                  placeholder="Contoh: (0233) 281234"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motto / Semboyan Satuan PKS Sekolah
                </label>
                <input
                  type="text"
                  disabled={!canEditTarget}
                  value={formState.mottoPks}
                  onChange={e => setFormState(prev => ({ ...prev, mottoPks: e.target.value }))}
                  placeholder="Contoh: Disiplin, Tangkas, Pelopor Keselamatan Berlalu Lintas"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Logo Uploader */}
            <div className="lg:col-span-4 border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Logo Sekolah</span>
                </span>
                {formState.logoUrl && canEditTarget && (
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, logoUrl: '' }))}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                  {isCompressingLogo ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : formState.logoUrl ? (
                    <img
                      src={formState.logoUrl}
                      alt="Pratinjau Logo Sekolah"
                      className="w-full h-full object-contain p-1.5"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-300" />
                  )}
                </div>

                {canEditTarget ? (
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={e => void handleLogoUpload(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isCompressingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formState.logoUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Format PNG/JPG/WEBP, otomatis dikompresi agar ringan di Cloud.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {formState.logoUrl ? 'Logo pangkalan terpasang.' : 'Belum ada logo diunggah.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky / Bottom Action Footer */}
        {canEditTarget && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Username akun login (<span className="font-mono font-bold text-slate-700">@{targetUser?.username}</span>) tetap terjaga agar riwayat pendaftaran anggota PKS tidak terputus.
            </p>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (targetUser) setFormState(buildFormStateFromUser(targetUser));
                  showToast('Perubahan formulir dikembalikan ke data tersimpan terakhir.', 'info');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Perubahan</span>
              </button>

              <button
                type="submit"
                disabled={isSaving || isCompressingLogo}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Profile...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Profile Sekolah</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

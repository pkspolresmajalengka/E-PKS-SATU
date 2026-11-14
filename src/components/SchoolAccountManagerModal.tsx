import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Building2,
  Users,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Download,
  Search,
  X,
  Check,
  Eye,
  EyeOff,
  Phone,
  AlertTriangle,
  UserCheck,
  Copy,
  Lock,
  Plus,
  Loader2
} from 'lucide-react';
import { AppUser, Participant, SchoolLevel } from '../App';
import {
  saveUserToCloud,
  deleteUserFromCloud,
  saveParticipantToCloud
} from '../lib/firebase';
import { NetworkErrorBanner, NetworkErrorState } from './NetworkErrorBanner';

interface SchoolAccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersList: AppUser[];
  setUsersList: React.Dispatch<React.SetStateAction<AppUser[]>>;
  pesertaList: Participant[];
  setPesertaList: React.Dispatch<React.SetStateAction<Participant[]>>;
  currentUser: AppUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenPesertaForSchool?: (schoolName: string) => void;
}

export const SchoolAccountManagerModal: React.FC<SchoolAccountManagerModalProps> = ({
  isOpen,
  onClose,
  usersList,
  setUsersList,
  pesertaList,
  setPesertaList,
  currentUser,
  setCurrentUser,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJenjang, setFilterJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Editing state
  const [editingTargetUsername, setEditingTargetUsername] = useState<string | null>(null);

  // Form inputs for Add / Edit
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolLevel: 'SLTP' as SchoolLevel,
    username: '',
    password: '',
    pembinaName: '',
    contactWa: '',
    autoCreatePeserta: true
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);
  const [networkError, setNetworkError] = useState<NetworkErrorState | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setNetworkError(null);
      setEditingTargetUsername(null);
      setConfirmDeleteUser(null);
      setActiveTab('list');
    }
  }, [isOpen]);

  // Filtered school accounts list
  const schoolAccounts = useMemo(() => {
    return usersList.filter(u => u.role === 'sekolah');
  }, [usersList]);

  const filteredSchoolAccounts = useMemo(() => {
    return schoolAccounts.filter(u => {
      const matchLevel = filterJenjang === 'all' || u.schoolLevel === filterJenjang;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.schoolName && u.schoolName.toLowerCase().includes(q)) ||
        u.username.toLowerCase().includes(q) ||
        (u.pembinaName && u.pembinaName.toLowerCase().includes(q)) ||
        (u.contactWa && u.contactWa.includes(q));

      return matchLevel && matchSearch;
    });
  }, [schoolAccounts, filterJenjang, searchQuery]);

  // Map of participant counts per school
  const schoolPesertaCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    pesertaList.forEach(p => {
      const key = p.sekolah.toLowerCase().trim();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [pesertaList]);

  const canViewPasswords = useMemo(() => {
    return Boolean(
      currentUser && (
        currentUser.role === 'admin' ||
        currentUser.role === 'superadmin' ||
        currentUser.username.toLowerCase() === 'admin' ||
        currentUser.username.toLowerCase() === 'administrator'
      )
    );
  }, [currentUser]);

  if (!isOpen) return null;

  const toggleShowPassword = (username: string) => {
    if (!canViewPasswords) {
      showToast('Hanya akun Admin dan Super Admin yang berhak melihat password!', 'error');
      return;
    }
    setShowPasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    if (label.toLowerCase().includes('password') && !canViewPasswords) {
      showToast('Hanya akun Admin dan Super Admin yang berhak menyalin password!', 'error');
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} disalin ke clipboard!`, 'info');
    }
  };

  const resetForm = () => {
    setFormData({
      schoolName: '',
      schoolLevel: 'SLTP',
      username: '',
      password: '',
      pembinaName: '',
      contactWa: '',
      autoCreatePeserta: true
    });
    setFormError('');
    setEditingTargetUsername(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setActiveTab('add');
  };

  const handleStartEdit = (user: AppUser) => {
    setEditingTargetUsername(user.username);
    setFormData({
      schoolName: user.schoolName || user.name || '',
      schoolLevel: user.schoolLevel || 'SLTP',
      username: user.username,
      password: user.password || '',
      pembinaName: user.pembinaName || '',
      contactWa: user.contactWa || '',
      autoCreatePeserta: false
    });
    setFormError('');
    setActiveTab('edit');
  };

  const handleSaveNewSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError('');
    setNetworkError(null);

    const school = formData.schoolName.trim();
    const uname = formData.username.trim().toLowerCase().replace(/\s+/g, '');
    const pwd = formData.password.trim();

    if (!school) {
      setFormError('Nama lengkap sekolah wajib diisi!');
      return;
    }
    if (!uname) {
      setFormError('Username akun wajib diisi!');
      return;
    }
    if (pwd.length < 4) {
      setFormError('Password minimal 4 karakter!');
      return;
    }

    if (usersList.some(u => u.username.toLowerCase() === uname)) {
      setFormError(`Username "${uname}" sudah digunakan oleh akun lain!`);
      return;
    }

    setIsSaving(true);
    setNetworkError(null);

    const runCreateSave = async () => {
      const newSchoolUser: AppUser = {
        username: uname,
        password: pwd,
        name: school,
        role: 'sekolah',
        schoolName: school,
        schoolLevel: formData.schoolLevel,
        pembinaName: formData.pembinaName.trim(),
        contactWa: formData.contactWa.trim(),
        isCustom: true
      };

      const userSyncRes = await saveUserToCloud(newSchoolUser);
      if (!userSyncRes.success && !userSyncRes.queuedOffline) {
        setNetworkError({
          title: 'Gagal Menyimpan Akun Sekolah ke Cloud',
          message: userSyncRes.error || 'Terjadi gangguan jaringan saat menyimpan akun sekolah.',
          isNetworkError: userSyncRes.isNetworkError,
          onRetry: async () => {
            setIsSaving(true);
            setNetworkError(null);
            try {
              await runCreateSave();
            } finally {
              setIsSaving(false);
            }
          }
        });
        showToast(userSyncRes.error || 'Gagal menyimpan akun sekolah ke Cloud.', 'error');
        return;
      }

      const updatedUsers = [...usersList, newSchoolUser];
      setUsersList(updatedUsers);
      try {
        localStorage.setItem('PBB_PKS_USERS_V4_DATA', JSON.stringify(updatedUsers));
      } catch {
        // ignore
      }

      // Auto-create initial participant profile for this school if requested and doesn't exist yet
      if (formData.autoCreatePeserta) {
        const exists = pesertaList.some(
          p => p.sekolah.toLowerCase().trim() === school.toLowerCase().trim()
        );
        if (!exists) {
          const nextNo = String(pesertaList.length + 1).padStart(2, '0');
          const newPeserta: Participant = {
            id: `p-${Date.now()}`,
            nomor: nextNo,
            peleton: `Peleton ${school}`,
            jenjang: formData.schoolLevel,
            sekolah: school,
            tanggal: new Date().toISOString().split('T')[0],
            juri: 'Belum Ditentukan',
            scores: {
              pbb: {}, danton: {},
              devile: {}, gatur: {}, senam: {}, yelyel: {},
              beladiri: {}, speaking: {}, tenda: {}
            }
          };
          const updatedPeserta = [...pesertaList, newPeserta];
          setPesertaList(updatedPeserta);
          try {
            localStorage.setItem('PBB_PKS_REKAP_APP_V4_DATA', JSON.stringify({ pesertaList: updatedPeserta }));
          } catch {
            // ignore
          }
          await saveParticipantToCloud(newPeserta);
        }
      }

      showToast(
        userSyncRes.queuedOffline
          ? `Akun sekolah "${school}" disimpan offline & akan otomatis tersinkron saat online.`
          : `Akun sekolah "${school}" berhasil dibuat & tersinkron ke Cloud!`,
        userSyncRes.queuedOffline ? 'info' : 'success'
      );
      resetForm();
      setActiveTab('list');
    };

    try {
      await runCreateSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTargetUsername) return;
    setFormError('');
    setNetworkError(null);

    const school = formData.schoolName.trim();
    const uname = formData.username.trim().toLowerCase().replace(/\s+/g, '');
    const pwd = formData.password.trim();

    if (!school) {
      setFormError('Nama lengkap sekolah wajib diisi!');
      return;
    }
    if (!uname) {
      setFormError('Username akun wajib diisi!');
      return;
    }
    if (pwd.length < 4) {
      setFormError('Password minimal 4 karakter!');
      return;
    }

    // Check if new username conflicts with another user
    if (
      uname !== editingTargetUsername.toLowerCase() &&
      usersList.some(u => u.username.toLowerCase() === uname)
    ) {
      setFormError(`Username "${uname}" sudah digunakan akun lain!`);
      return;
    }

    const updatedUser: AppUser = {
      username: uname,
      password: pwd,
      name: school,
      role: 'sekolah',
      schoolName: school,
      schoolLevel: formData.schoolLevel,
      pembinaName: formData.pembinaName.trim(),
      contactWa: formData.contactWa.trim(),
      isCustom: true
    };

    setIsSaving(true);
    const runUpdateSave = async () => {
      const syncRes = await saveUserToCloud(updatedUser);
      if (!syncRes.success && !syncRes.queuedOffline) {
        setNetworkError({
          title: 'Gagal Memperbarui Akun Sekolah di Cloud',
          message: syncRes.error || 'Terjadi gangguan jaringan saat menyimpan perubahan akun sekolah.',
          isNetworkError: syncRes.isNetworkError,
          onRetry: async () => {
            setIsSaving(true);
            setNetworkError(null);
            try {
              await runUpdateSave();
            } finally {
              setIsSaving(false);
            }
          }
        });
        showToast(syncRes.error || 'Gagal memperbarui akun sekolah ke Cloud.', 'error');
        return;
      }

      const updatedUsers = usersList.map(u =>
        u.username === editingTargetUsername ? updatedUser : u
      );
      setUsersList(updatedUsers);
      try {
        localStorage.setItem('PBB_PKS_USERS_V4_DATA', JSON.stringify(updatedUsers));
      } catch {
        // ignore
      }

      // If currently logged in as this school user, sync
      if (currentUser && currentUser.username === editingTargetUsername) {
        setCurrentUser(updatedUser);
        sessionStorage.setItem('PBB_PKS_ACTIVE_AUTH_SESSION', JSON.stringify(updatedUser));
      }

      showToast(`Data akun sekolah "${school}" berhasil diperbarui & tersinkron ke Cloud!`, 'success');
      resetForm();
      setActiveTab('list');
    };

    try {
      await runUpdateSave();
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteSchool = async (user: AppUser) => {
    const school = user.schoolName || user.name;
    setDeletingUsername(user.username);
    setNetworkError(null);

    try {
      const delRes = await deleteUserFromCloud(user.username);
      if (!delRes.success && !delRes.queuedOffline) {
        setConfirmDeleteUser(null);
        setNetworkError({
          title: 'Gagal Menghapus Akun Sekolah dari Cloud',
          message: delRes.error || 'Terjadi gangguan jaringan saat menghapus akun sekolah.',
          isNetworkError: delRes.isNetworkError,
          onRetry: () => executeDeleteSchool(user)
        });
        showToast(delRes.error || 'Gagal menghapus akun sekolah dari Cloud.', 'error');
        return;
      }

      const updatedUsers = usersList.filter(u => u.username !== user.username);
      setUsersList(updatedUsers);
      try {
        localStorage.setItem('PBB_PKS_USERS_V4_DATA', JSON.stringify(updatedUsers));
      } catch {
        // ignore
      }
      setConfirmDeleteUser(null);
      showToast(`Akun sekolah "${school}" berhasil dihapus dari Cloud.`, 'info');
    } finally {
      setDeletingUsername(null);
    }
  };

  const handleDeleteSchool = (user: AppUser) => {
    if (currentUser && currentUser.username === user.username) {
      showToast('Tidak dapat menghapus akun sekolah yang sedang login saat ini!', 'error');
      return;
    }
    setConfirmDeleteUser(user);
  };

  // Export School Credentials to Excel
  const handleExportSchoolsExcel = () => {
    if (schoolAccounts.length === 0) {
      showToast('Belum ada akun sekolah yang terdaftar untuk diekspor.', 'error');
      return;
    }

    const header = [
      ['KORPS PATROLI KEAMANAN SEKOLAH (PKS) & POLISI PELAJAR'],
      ['DAFTAR AKUN SEKOLAH & KREDENSIAL LOGIN MANDIRI'],
      [`Waktu Unduh: ${new Date().toLocaleString('id-ID')}`],
      []
    ];

    const tableHeaders = [
      'No',
      'Nama Sekolah',
      'Jenjang',
      'Username Login',
      'Password Akun',
      'Nama Pembina / Pendamping',
      'Kontak WhatsApp',
      'Jumlah Peserta Terdaftar'
    ];

    const rows = schoolAccounts.map((u, idx) => {
      const school = u.schoolName || u.name;
      const count = schoolPesertaCountMap[school.toLowerCase().trim()] || 0;
      return [
        idx + 1,
        school,
        u.schoolLevel || 'SLTP',
        u.username,
        canViewPasswords ? (u.password || '123456') : '•••••••• (Hanya Admin)',
        u.pembinaName || '-',
        u.contactWa || '-',
        `${count} Kontingen`
      ];
    });

    const sheetData = [...header, tableHeaders, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Akun Sekolah');
    XLSX.writeFile(wb, `Daftar_Akun_Sekolah_PKS_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('File Excel kredensial akun sekolah berhasil diunduh!');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>Manajemen & Kelola Akun Sekolah</span>
                <span className="bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {schoolAccounts.length} Akun Terdaftar
                </span>
              </h3>
              <p className="text-xs text-blue-300">
                Kelola kredensial login mandiri, jenjang sekolah, kontak pembina, dan hak akses kontingen
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving || Boolean(deletingUsername)}
            onClick={onClose}
            className="text-slate-400 hover:text-white disabled:opacity-50 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('list');
              setEditingTargetUsername(null);
            }}
            className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'list'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Daftar Akun Sekolah ({schoolAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartAdd}
            className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'add'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 border-x border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>+ Tambah Akun Sekolah Baru</span>
          </button>

          {editingTargetUsername && (
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white text-amber-700 border-t-2 border-amber-600 border-x border-slate-200 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Edit className="w-4 h-4 text-amber-600" />
              <span>Edit: @{editingTargetUsername}</span>
            </button>
          )}
        </div>

        {/* ==================================================== */}
        {/* TAB 1: LIST DAFTAR AKUN SEKOLAH */}
        {/* ==================================================== */}
        {activeTab === 'list' && (
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <NetworkErrorBanner error={networkError} onDismiss={() => setNetworkError(null)} />
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari nama sekolah / username / pembina..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Jenjang */}
                <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold shrink-0">
                  {(['all', 'SLTP', 'SLTA'] as const).map(j => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setFilterJenjang(j)}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        filterJenjang === j
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {j === 'all' ? 'Semua' : j}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions: Export Excel */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportSchoolsExcel}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Unduh seluruh daftar akun dan password sekolah ke file Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unduh Excel Kredensial</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Akun</span>
                </button>
              </div>
            </div>

            {/* School Accounts Table */}
            {filteredSchoolAccounts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Tidak Ada Akun Sekolah</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || filterJenjang !== 'all'
                    ? 'Tidak ada akun sekolah yang cocok dengan filter pencarian.'
                    : 'Belum ada akun sekolah terdaftar. Buat akun baru atau minta perwakilan sekolah mendaftar lewat formulir login mandiri.'}
                </p>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Buat Akun Sekolah Pertama
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 font-bold uppercase text-slate-600 border-b border-slate-200 text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5">Nama Sekolah</th>
                        <th className="py-3 px-2.5 text-center">Jenjang</th>
                        <th className="py-3 px-3">Username</th>
                        <th className="py-3 px-3">Password</th>
                        <th className="py-3 px-3">Pembina & Kontak</th>
                        <th className="py-3 px-2.5 text-center">Peserta</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSchoolAccounts.map(u => {
                        const school = u.schoolName || u.name;
                        const count = schoolPesertaCountMap[school.toLowerCase().trim()] || 0;
                        const isPwdShown = showPasswords[u.username];

                        return (
                          <tr key={u.username} className="hover:bg-emerald-50/30 transition">
                            {/* School Name */}
                            <td className="py-3 px-3.5 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="block text-slate-900 font-bold text-xs">{school}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                                </div>
                              </div>
                            </td>

                            {/* Level Badge */}
                            <td className="py-3 px-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${
                                  u.schoolLevel === 'SLTA' ? 'bg-indigo-600' : 'bg-blue-600'
                                }`}
                              >
                                {u.schoolLevel || 'SLTP'}
                              </span>
                            </td>

                            {/* Username */}
                            <td className="py-3 px-3 font-mono text-slate-700">
                              <div className="flex items-center gap-1">
                                <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                  {u.username}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(u.username, 'Username')}
                                  title="Salin Username"
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Password */}
                            <td className="py-3 px-3">
                              {canViewPasswords ? (
                                <div className="flex items-center gap-1 font-mono">
                                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold border transition ${
                                    isPwdShown ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                    {isPwdShown ? (u.password || '-') : '••••••••'}
                                  </span>
                                  <button
                                    onClick={() => toggleShowPassword(u.username)}
                                    title={isPwdShown ? "Sembunyikan Password" : "Lihat Password"}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer transition"
                                  >
                                    {isPwdShown ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(u.password || '', 'Password')}
                                    title="Salin Password"
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer transition"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium"
                                  title="Hanya akun Admin dan Super Admin yang berhak melihat password akun sekolah"
                                >
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>••••••••</span>
                                </span>
                              )}
                            </td>

                            {/* Pembina & Contact */}
                            <td className="py-3 px-3 text-slate-700">
                              <div>
                                <span className="block font-semibold text-xs text-slate-800">
                                  {u.pembinaName || '-'}
                                </span>
                                {u.contactWa ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-mono">
                                    <Phone className="w-3 h-3 text-emerald-600" /> {u.contactWa}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No WA belum diisi</span>
                                )}
                              </div>
                            </td>

                            {/* Peserta Count */}
                            <td className="py-3 px-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  count > 0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {count} Kontingen
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(u)}
                                  title="Edit Akun & Password Sekolah"
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  disabled={deletingUsername === u.username}
                                  onClick={() => handleDeleteSchool(u)}
                                  title="Hapus Akun Sekolah"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-60 rounded-lg transition cursor-pointer"
                                >
                                  {deletingUsername === u.username ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TAMBAH AKUN SEKOLAH BARU */}
        {/* ==================================================== */}
        {activeTab === 'add' && (
          <form onSubmit={handleSaveNewSchool} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900">
              <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                <Building2 className="w-4 h-4 text-emerald-700" />
                Tambah Akun Perwakilan Sekolah
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                Akun ini diberikan kepada pembina atau official sekolah agar dapat mengelola data peserta, kontingen, dan formulir pendaftaran resmi PKS secara mandiri.
              </p>
            </div>

            <NetworkErrorBanner error={networkError} onDismiss={() => setNetworkError(null)} />

            {formError && (
              <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nama Lengkap Sekolah */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap Sekolah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.schoolName}
                  onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                  placeholder="Contoh: SMP Negeri 2 Majalengka"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Jenjang */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tingkat / Jenjang Pendidikan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, schoolLevel: 'SLTP' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.schoolLevel === 'SLTP'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTP (SMP/MTs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, schoolLevel: 'SLTA' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.schoolLevel === 'SLTA'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTA (SMA/SMK/MA)</span>
                  </button>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Username Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      username: e.target.value.toLowerCase().replace(/\s+/g, '')
                    })
                  }
                  placeholder="Huruf kecil tanpa spasi, contoh: smpn2majalengka"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Password Akun <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 4 karakter"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Nama Pembina */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Guru Pembina / Official
                </label>
                <input
                  type="text"
                  value={formData.pembinaName}
                  onChange={e => setFormData({ ...formData, pembinaName: e.target.value })}
                  placeholder="Nama pembina pendamping..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Kontak WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  No. Handphone / WhatsApp Pembina
                </label>
                <input
                  type="text"
                  value={formData.contactWa}
                  onChange={e => setFormData({ ...formData, contactWa: e.target.value })}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Checkbox auto-create participant */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.autoCreatePeserta}
                  onChange={e => setFormData({ ...formData, autoCreatePeserta: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                />
                <span className="font-semibold">
                  Otomatis buat profil kontingen peserta pertama untuk sekolah ini di daftar peserta lomba
                </span>
              </label>
            </div>

            {/* Form Action Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setNetworkError(null);
                  setActiveTab('list');
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Akun Sekolah</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ==================================================== */}
        {/* TAB 3: EDIT AKUN SEKOLAH */}
        {/* ==================================================== */}
        {activeTab === 'edit' && editingTargetUsername && (
          <form onSubmit={handleUpdateSchool} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <div>
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Edit className="w-4 h-4 text-amber-700" />
                  Mode Edit Akun Sekolah: @{editingTargetUsername}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Anda dapat memperbarui identitas sekolah, nama pembina, kontak WA, serta mereset password akun ini.
                </p>
              </div>
            </div>

            <NetworkErrorBanner error={networkError} onDismiss={() => setNetworkError(null)} />

            {formError && (
              <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nama Lengkap Sekolah */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap Sekolah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.schoolName}
                  onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Jenjang */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tingkat / Jenjang Pendidikan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, schoolLevel: 'SLTP' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.schoolLevel === 'SLTP'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTP (SMP/MTs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, schoolLevel: 'SLTA' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.schoolLevel === 'SLTA'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTA (SMA/SMK/MA)</span>
                  </button>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Username Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      username: e.target.value.toLowerCase().replace(/\s+/g, '')
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Password Baru / Reset Password *</span>
                  <span className="text-amber-700 font-semibold text-[10px] lowercase">Ketik untuk ganti</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Ketik password baru"
                  className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none text-slate-900"
                />
              </div>

              {/* Nama Pembina */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Guru Pembina / Official
                </label>
                <input
                  type="text"
                  value={formData.pembinaName}
                  onChange={e => setFormData({ ...formData, pembinaName: e.target.value })}
                  placeholder="Nama pembina..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Kontak WhatsApp */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  No. Handphone / WhatsApp Pembina
                </label>
                <input
                  type="text"
                  value={formData.contactWa}
                  onChange={e => setFormData({ ...formData, contactWa: e.target.value })}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Form Action Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setNetworkError(null);
                  resetForm();
                  setActiveTab('list');
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-75 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Perubahan Akun Sekolah</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* IN-APP DELETE CONFIRMATION DIALOG */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600/20 border border-rose-500/40 rounded-xl text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Hapus Akun Sekolah?</h4>
                  <p className="text-[11px] text-slate-400">@{confirmDeleteUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={deletingUsername === confirmDeleteUser.username}
                onClick={() => setConfirmDeleteUser(null)}
                className="text-slate-400 hover:text-white disabled:opacity-50 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              {(() => {
                const school = confirmDeleteUser.schoolName || confirmDeleteUser.name;
                const count = schoolPesertaCountMap[school.toLowerCase().trim()] || 0;
                return (
                  <p className="leading-relaxed">
                    Yakin ingin menghapus akun sekolah <strong className="text-slate-900">"{school}"</strong> (@{confirmDeleteUser.username})?
                    {count > 0 && (
                      <span className="block mt-1.5 text-amber-700 font-semibold">
                        Catatan: Sekolah ini memiliki {count} kontingen/peserta terdaftar.
                      </span>
                    )}
                  </p>
                );
              })()}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={deletingUsername === confirmDeleteUser.username}
                  onClick={() => setConfirmDeleteUser(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 rounded-xl font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deletingUsername === confirmDeleteUser.username}
                  onClick={() => executeDeleteSchool(confirmDeleteUser)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-75 text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {deletingUsername === confirmDeleteUser.username ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Akun</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

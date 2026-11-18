import { RegistrationSubmission } from './firebase';

export type SchoolLevel = RegistrationSubmission['schoolLevel'];

export type PksTrackKey = 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2';

export type MemberVerificationState =
  | 'verified'
  | 'finance_approved'
  | 'pending'
  | 'unpaid'
  | 'rejected';

export interface SchoolExtractedMember {
  id: string;
  submissionId: string;
  categoryKey: PksTrackKey;
  categoryLabel: string;
  shortCategoryLabel: string;
  studentName: string;
  schoolName: string;
  schoolLevel: SchoolLevel;
  identifier: string;
  gender: string;
  pembinaName: string;
  submissionDate: string;
  createdAtMs: number;
  isVerified: boolean;
  verificationState: MemberVerificationState;
  verificationLabel: string;
  officialNumber: string;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CategoryMemberBreakdown {
  key: PksTrackKey;
  label: string;
  shortLabel: string;
  total: number;
  verified: number;
  pending: number;
  rejected: number;
}

export interface SchoolMemberStatsSummary {
  totalRegistered: number;
  totalVerified: number;
  pendingCount: number;
  rejectedCount: number;
  verificationRate: number;
  activeCategoriesCount: number;
  verifiedCategoriesCount: number;
  categories: CategoryMemberBreakdown[];
}

export const PKS_TRACK_META: Array<{
  key: PksTrackKey;
  label: string;
  shortLabel: string;
}> = [
  { key: 'polisi_pelajar', label: 'Polisi Pelajar (Poljar)', shortLabel: 'Polisi Pelajar' },
  { key: 'calon_pks', label: 'Calon Anggota PKS', shortLabel: 'Calon PKS' },
  { key: 'kemah_balok1', label: 'Kemah PKS Balok 1', shortLabel: 'Kemah Balok 1' },
  { key: 'pks_balok2', label: 'Ujian PKS Balok 2', shortLabel: 'Ujian Balok 2' },
];

const formatDateShortId = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const resolveVerificationInfo = (
  sub: RegistrationSubmission
): {
  isVerified: boolean;
  verificationState: MemberVerificationState;
  verificationLabel: string;
  officialNumber: string;
  verifiedBy: string;
  verifiedAt: string;
} => {
  const stage2Status = sub.stage2Committee?.status;
  const stage1Status = sub.stage1Finance?.status;

  const officialNumber = (
    sub.stage2Committee?.officialNumber ||
    sub.stage2Committee?.registrationNumber ||
    sub.nomorIndukPoljar ||
    sub.registrationNumber ||
    ''
  ).trim();
  const verifiedBy = (sub.stage2Committee?.verifiedBy || '').trim();
  const verifiedAt = (sub.stage2Committee?.verifiedAt || '').trim();

  if (stage2Status === 'approved') {
    return {
      isVerified: true,
      verificationState: 'verified',
      verificationLabel: 'Terverifikasi Panitia',
      officialNumber,
      verifiedBy,
      verifiedAt,
    };
  }

  if (stage2Status === 'rejected' || stage1Status === 'rejected' || sub.paymentStatus === 'rejected') {
    return {
      isVerified: false,
      verificationState: 'rejected',
      verificationLabel: 'Perlu Perbaikan / Ditolak',
      officialNumber,
      verifiedBy,
      verifiedAt,
    };
  }

  if (stage1Status === 'approved') {
    return {
      isVerified: false,
      verificationState: 'finance_approved',
      verificationLabel:
        sub.paymentStatus === 'partial'
          ? 'DP Valid (Cicilan) · Menunggu Panitia'
          : 'Lolos Keuangan · Menunggu Panitia',
      officialNumber,
      verifiedBy,
      verifiedAt,
    };
  }

  if (sub.paymentStatus === 'partial') {
    return {
      isVerified: false,
      verificationState: 'finance_approved',
      verificationLabel: 'Cicilan Aktif',
      officialNumber,
      verifiedBy,
      verifiedAt,
    };
  }

  if (sub.paymentStatus === 'unpaid') {
    return {
      isVerified: false,
      verificationState: 'unpaid',
      verificationLabel: 'Menunggu Pembayaran',
      officialNumber,
      verifiedBy,
      verifiedAt,
    };
  }

  return {
    isVerified: false,
    verificationState: 'pending',
    verificationLabel: 'Menunggu Verifikasi',
    officialNumber,
    verifiedBy,
    verifiedAt,
  };
};

export function extractSchoolPksMembers(submissions: RegistrationSubmission[]): SchoolExtractedMember[] {
  return submissions.flatMap((sub): SchoolExtractedMember[] => {
    const verInfo = resolveVerificationInfo(sub);
    const submissionDate = formatDateShortId(sub.createdAt);
    const createdAtMs = sub.createdAt ? Date.parse(sub.createdAt) || 0 : 0;
    const pembinaName = (sub.formData?.namaPembina || '-').trim() || '-';

    if (
      sub.formType === 'calon_pks' &&
      Array.isArray(sub.formData?.students) &&
      sub.formData.students.length > 0
    ) {
      return sub.formData.students.map((st: any, idx: number): SchoolExtractedMember => {
        const tempat = (st?.tempatLahir || '').trim();
        const tgl = formatDateShortId(st?.tanggalLahir);
        const ttlText = [tempat, tgl !== '-' ? tgl : ''].filter(Boolean).join(', ');
        const studentName = (st?.nama || '').trim() || `Calon Anggota #${idx + 1}`;

        return {
          id: `${sub.id}__${st?.id || idx}`,
          submissionId: sub.id,
          categoryKey: 'calon_pks',
          categoryLabel: 'Calon Anggota PKS',
          shortCategoryLabel: 'Calon PKS',
          studentName,
          schoolName: sub.schoolName,
          schoolLevel: sub.schoolLevel || 'SLTP',
          identifier: ttlText ? `TTL: ${ttlText}` : `Peserta #${idx + 1}`,
          gender: st?.jk || '-',
          pembinaName,
          submissionDate,
          createdAtMs,
          ...verInfo,
        };
      });
    }

    if (
      (sub.formType === 'kemah_balok1' || sub.formType === 'pks_balok2') &&
      Array.isArray(sub.formData?.participants) &&
      sub.formData.participants.length > 0
    ) {
      const isBalok1 = sub.formType === 'kemah_balok1';
      const categoryLabel = isBalok1 ? 'Kemah PKS Balok 1' : 'Ujian PKS Balok 2';
      const shortCategoryLabel = isBalok1 ? 'Kemah Balok 1' : 'Ujian Balok 2';
      const mealInfo =
        sub.formData?.mealCount !== undefined
          ? `Konsumsi: ${sub.formData.mealCount}/${sub.formData.totalParticipants ?? sub.formData.participants.length}`
          : '';

      return sub.formData.participants.map((pt: any, idx: number): SchoolExtractedMember => {
        const genderText = pt?.jk || (pt?.genderGroup === 'Putri' ? 'Perempuan' : 'Laki-laki');
        const groupLabel = pt?.genderGroup || (genderText === 'Perempuan' ? 'Putri' : 'Putra');
        const studentName = (pt?.nama || '').trim() || `Peserta #${idx + 1}`;
        return {
          id: `${sub.id}__${pt?.id || idx}`,
          submissionId: sub.id,
          categoryKey: sub.formType,
          categoryLabel,
          shortCategoryLabel,
          studentName,
          schoolName: sub.schoolName,
          schoolLevel: sub.schoolLevel || 'SLTP',
          identifier: [groupLabel, mealInfo].filter(Boolean).join(' · ') || `Peserta #${idx + 1}`,
          gender: genderText,
          pembinaName,
          submissionDate,
          createdAtMs,
          ...verInfo,
        };
      });
    }

    let categoryKey: PksTrackKey = 'calon_pks';
    let categoryLabel = 'Calon Anggota PKS';
    let shortCategoryLabel = 'Calon PKS';
    let studentName = (sub.applicantName || 'Peserta PKS').trim();
    let identifier = '-';

    if (sub.formType === 'polisi_pelajar') {
      categoryKey = 'polisi_pelajar';
      categoryLabel = 'Polisi Pelajar (Poljar)';
      shortCategoryLabel = 'Polisi Pelajar';
      studentName = (sub.formData?.nama || sub.applicantName || 'Peserta Poljar').trim();
      const nisnText = sub.formData?.nisn ? `NISN: ${sub.formData.nisn}` : '';
      identifier = sub.nomorIndukPoljar
        ? nisnText
          ? `${sub.nomorIndukPoljar} · ${nisnText}`
          : sub.nomorIndukPoljar
        : nisnText || 'NISN: -';
    } else if (sub.formType === 'calon_pks') {
      categoryKey = 'calon_pks';
      categoryLabel = 'Calon Anggota PKS';
      shortCategoryLabel = 'Calon PKS';
      studentName = (sub.formData?.nama || sub.applicantName || 'Calon Anggota PKS').trim();
      identifier = sub.formData?.nisn ? `NISN: ${sub.formData.nisn}` : 'NISN: -';
    } else if (sub.formType === 'kemah_balok1') {
      categoryKey = 'kemah_balok1';
      categoryLabel = 'Kemah PKS Balok 1';
      shortCategoryLabel = 'Kemah Balok 1';
      studentName = sub.formData?.namaKetua
        ? `${sub.formData.namaKetua} (Ketua ${sub.formData.namaRegu || 'Regu'})`
        : sub.applicantName || 'Regu Kemah PKS';
      identifier = sub.formData?.namaRegu
        ? `Regu: ${sub.formData.namaRegu} (${sub.formData.jumlahAnggota || '12 Anggota'})`
        : 'Regu Kemah Balok 1';
    } else if (sub.formType === 'pks_balok2') {
      categoryKey = 'pks_balok2';
      categoryLabel = 'Ujian PKS Balok 2';
      shortCategoryLabel = 'Ujian Balok 2';
      studentName = (sub.formData?.namaPeserta || sub.applicantName || 'Peserta Balok 2').trim();
      identifier = sub.formData?.noSertifikatBalok1
        ? `Sertifikat B1: ${sub.formData.noSertifikatBalok1}`
        : 'Kualifikasi Balok 2';
    }

    return [
      {
        id: sub.id,
        submissionId: sub.id,
        categoryKey,
        categoryLabel,
        shortCategoryLabel,
        studentName,
        schoolName: sub.schoolName,
        schoolLevel: sub.schoolLevel || 'SLTP',
        identifier,
        gender: sub.formData?.jk || '-',
        pembinaName,
        submissionDate,
        createdAtMs,
        ...verInfo,
      },
    ];
  });
}

export function computeSchoolMemberStats(
  members: SchoolExtractedMember[]
): SchoolMemberStatsSummary {
  const categories: CategoryMemberBreakdown[] = PKS_TRACK_META.map(meta => {
    const trackMembers = members.filter(m => m.categoryKey === meta.key);
    const verified = trackMembers.filter(m => m.isVerified).length;
    const rejected = trackMembers.filter(m => m.verificationState === 'rejected').length;
    const pending = Math.max(0, trackMembers.length - verified - rejected);

    return {
      key: meta.key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      total: trackMembers.length,
      verified,
      pending,
      rejected,
    };
  });

  const totalRegistered = members.length;
  const totalVerified = members.filter(m => m.isVerified).length;
  const rejectedCount = members.filter(m => m.verificationState === 'rejected').length;
  const pendingCount = Math.max(0, totalRegistered - totalVerified - rejectedCount);
  const verificationRate =
    totalRegistered > 0 ? Math.round((totalVerified / totalRegistered) * 100) : 0;
  const activeCategoriesCount = categories.filter(c => c.total > 0).length;
  const verifiedCategoriesCount = categories.filter(c => c.verified > 0).length;

  return {
    totalRegistered,
    totalVerified,
    pendingCount,
    rejectedCount,
    verificationRate,
    activeCategoriesCount,
    verifiedCategoriesCount,
    categories,
  };
}

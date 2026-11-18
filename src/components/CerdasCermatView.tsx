import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit,
  FileCheck2,
  HelpCircle,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  Users,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type {
  CerdasCermatAnswerItem,
  CerdasCermatConfig,
  CerdasCermatGradeItem,
  CerdasCermatOptionKey,
  CerdasCermatQuestion,
  CerdasCermatQuestionType,
  CerdasCermatSubmission,
  CerdasCermatTargetLevel,
  CloudWriteResult
} from '../lib/firebase';
import { DEFAULT_CERDAS_CERMAT_CONFIG } from '../lib/firebase';
import type { AppUser, Participant } from '../App';

interface CerdasCermatViewProps {
  mode: 'school' | 'admin';
  currentUser: AppUser;
  quizConfig: CerdasCermatConfig;
  submissionsList: CerdasCermatSubmission[];
  participantsList: Participant[];
  usersList: AppUser[];
  onSaveQuizConfig: (config: CerdasCermatConfig) => Promise<CloudWriteResult>;
  onSubmitSchoolAnswers: (submission: CerdasCermatSubmission) => Promise<CloudWriteResult>;
  onGradeSubmission: (
    submission: CerdasCermatSubmission,
    participantIdToSync: string
  ) => Promise<CloudWriteResult>;
  onDeleteSubmission?: (submissionId: string) => Promise<CloudWriteResult>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function normalizeSchoolNameKey(val?: string): string {
  return String(val || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTimeId(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

function buildAutoGradesForSubmission(
  sub: CerdasCermatSubmission,
  questions: CerdasCermatQuestion[]
): Record<string, CerdasCermatGradeItem> {
  const existing = sub.questionGrades || {};
  const next: Record<string, CerdasCermatGradeItem> = {};
  questions.forEach(q => {
    const prev = existing[q.id];
    const ans = sub.answers?.[q.id];
    if (prev && typeof prev.score === 'number') {
      next[q.id] = {
        score: Math.max(0, Math.min(q.maxPoints, Number(prev.score) || 0)),
        comment: prev.comment || ''
      };
    } else if (q.type === 'multiple_choice') {
      const isCorrect =
        Boolean(ans?.selectedOption) &&
        String(ans?.selectedOption).toUpperCase() === String(q.correctOption).toUpperCase();
      next[q.id] = {
        score: isCorrect ? Number(q.maxPoints) || 0 : 0,
        comment: ''
      };
    } else {
      next[q.id] = {
        score: 0,
        comment: ''
      };
    }
  });
  return next;
}

export const CerdasCermatView: React.FC<CerdasCermatViewProps> = ({
  mode,
  currentUser,
  quizConfig,
  submissionsList,
  participantsList,
  usersList,
  onSaveQuizConfig,
  onSubmitSchoolAnswers,
  onGradeSubmission,
  onDeleteSubmission,
  showToast
}) => {
  const cleanUsername = useMemo(
    () => String(currentUser.username || '').trim().toLowerCase().replace(/\s+/g, ''),
    [currentUser.username]
  );

  // ========================================================
  // SCHOOL MODE STATE & LOGIC
  // ========================================================
  const schoolLevel: 'SLTP' | 'SLTA' = currentUser.schoolLevel === 'SLTA' ? 'SLTA' : 'SLTP';
  const schoolDisplayName = currentUser.schoolName || currentUser.name;
  const schoolSubmissionId = `cc_${cleanUsername}`;
  const draftStorageKey = `PBB_PKS_CC_DRAFT_${cleanUsername}`;

  const schoolApplicableQuestions = useMemo(() => {
    const raw = Array.isArray(quizConfig.questions) ? quizConfig.questions : [];
    return raw
      .filter(q => q.targetLevel === 'ALL' || !q.targetLevel || q.targetLevel === schoolLevel)
      .slice()
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [quizConfig.questions, schoolLevel]);

  const schoolMaxPossibleScore = useMemo(
    () => schoolApplicableQuestions.reduce((acc, q) => acc + (Number(q.maxPoints) || 0), 0),
    [schoolApplicableQuestions]
  );

  const mySubmission = useMemo(() => {
    return (
      submissionsList.find(
        s =>
          s.id === schoolSubmissionId ||
          String(s.schoolUsername || '').trim().toLowerCase() === cleanUsername
      ) || null
    );
  }, [submissionsList, schoolSubmissionId, cleanUsername]);

  const [schoolAnswers, setSchoolAnswers] = useState<Record<string, CerdasCermatAnswerItem>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });

  useEffect(() => {
    if (mode !== 'school' || mySubmission) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(schoolAnswers));
      }
    } catch {
      // ignore
    }
  }, [mode, mySubmission, draftStorageKey, schoolAnswers]);

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [isSubmittingSchool, setIsSubmittingSchool] = useState(false);

  const answeredCount = useMemo(() => {
    return schoolApplicableQuestions.filter(q => {
      const a = schoolAnswers[q.id];
      if (!a) return false;
      if (q.type === 'multiple_choice') return Boolean(a.selectedOption);
      return Boolean(a.textAnswer && a.textAnswer.trim().length > 0);
    }).length;
  }, [schoolApplicableQuestions, schoolAnswers]);

  const handleSchoolSelectOption = (questionId: string, optionKey: CerdasCermatOptionKey) => {
    setSchoolAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        selectedOption: optionKey
      }
    }));
  };

  const handleSchoolEssayChange = (questionId: string, val: string) => {
    setSchoolAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        textAnswer: val
      }
    }));
  };

  const handleConfirmSchoolSubmit = async () => {
    if (isSubmittingSchool || mySubmission) return;
    setIsSubmittingSchool(true);
    try {
      const nowIso = new Date().toISOString();
      const matchedParticipant = participantsList.find(
        p => normalizeSchoolNameKey(p.sekolah) === normalizeSchoolNameKey(schoolDisplayName)
      );
      const submissionPayload: CerdasCermatSubmission = {
        id: schoolSubmissionId,
        schoolUsername: cleanUsername,
        schoolName: schoolDisplayName,
        schoolLevel,
        submittedByName: currentUser.pembinaName || currentUser.name,
        participantId: matchedParticipant?.id || '',
        participantLabel: matchedParticipant
          ? `No. ${matchedParticipant.nomor} · ${matchedParticipant.sekolah}`
          : '',
        answers: schoolAnswers,
        questionGrades: {},
        autoMcScore: 0,
        essayScore: 0,
        totalScore: 0,
        maxPossibleScore: schoolMaxPossibleScore,
        status: 'submitted',
        adminNote: '',
        submittedAt: nowIso,
        updatedAt: nowIso
      };

      const res = await onSubmitSchoolAnswers(submissionPayload);
      if (res.success || res.queuedOffline || res.isQuotaError) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(draftStorageKey);
          }
        } catch {
          // ignore
        }
        setConfirmSubmitOpen(false);
        showToast(
          res.success
            ? 'Jawaban Lomba Cerdas Cermat berhasil dikirim! Menunggu penilaian Admin.'
            : 'Jawaban disimpan lokal / Cadangan Server dan otomatis tersinkron ke Cloud.',
          res.success ? 'success' : 'info'
        );
      } else {
        showToast(res.error || 'Gagal mengirim jawaban Lomba Cerdas Cermat.', 'error');
      }
    } finally {
      setIsSubmittingSchool(false);
    }
  };

  // ========================================================
  // ADMIN MODE STATE & LOGIC
  // ========================================================
  const [adminSubTab, setAdminSubTab] = useState<'questions' | 'grading'>('questions');
  const [draftConfig, setDraftConfig] = useState<CerdasCermatConfig>(() => quizConfig);
  const [hasUnsavedConfigChanges, setHasUnsavedConfigChanges] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [questionLevelFilter, setQuestionLevelFilter] = useState<'ALL' | 'SLTP' | 'SLTA'>('ALL');

  useEffect(() => {
    if (!hasUnsavedConfigChanges) {
      setDraftConfig(quizConfig);
    }
  }, [quizConfig, hasUnsavedConfigChanges]);

  const draftTotalPoints = useMemo(
    () =>
      (draftConfig.questions || []).reduce(
        (acc, q) => acc + (Number(q.maxPoints) || 0),
        0
      ),
    [draftConfig.questions]
  );

  const filteredDraftQuestions = useMemo(() => {
    const list = draftConfig.questions || [];
    if (questionLevelFilter === 'ALL') return list;
    return list.filter(q => q.targetLevel === 'ALL' || q.targetLevel === questionLevelFilter);
  }, [draftConfig.questions, questionLevelFilter]);

  const handleUpdateDraftMeta = (patch: Partial<CerdasCermatConfig>) => {
    setDraftConfig(prev => ({ ...prev, ...patch }));
    setHasUnsavedConfigChanges(true);
  };

  const handleAddQuestion = (type: CerdasCermatQuestionType) => {
    const nextNumber = (draftConfig.questions?.length || 0) + 1;
    const newQ: CerdasCermatQuestion = {
      id: `cc-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      number: nextNumber,
      type,
      targetLevel: 'ALL',
      prompt: '',
      options:
        type === 'multiple_choice'
          ? [
              { key: 'A', text: '' },
              { key: 'B', text: '' },
              { key: 'C', text: '' },
              { key: 'D', text: '' }
            ]
          : [],
      correctOption: 'A',
      maxPoints: type === 'multiple_choice' ? 10 : 20,
      guideAnswer: ''
    };
    setDraftConfig(prev => ({
      ...prev,
      questions: [...(prev.questions || []), newQ]
    }));
    setHasUnsavedConfigChanges(true);
  };

  const handleUpdateQuestion = (
    questionId: string,
    updater: (q: CerdasCermatQuestion) => CerdasCermatQuestion
  ) => {
    setDraftConfig(prev => ({
      ...prev,
      questions: (prev.questions || []).map(q => (q.id === questionId ? updater(q) : q))
    }));
    setHasUnsavedConfigChanges(true);
  };

  const handleMoveQuestion = (index: number, direction: -1 | 1) => {
    const list = [...(draftConfig.questions || [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    const renumbered = list.map((q, idx) => ({ ...q, number: idx + 1 }));
    setDraftConfig(prev => ({ ...prev, questions: renumbered }));
    setHasUnsavedConfigChanges(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const next = (draftConfig.questions || [])
      .filter(q => q.id !== questionId)
      .map((q, idx) => ({ ...q, number: idx + 1 }));
    setDraftConfig(prev => ({ ...prev, questions: next }));
    setHasUnsavedConfigChanges(true);
  };

  const handleLoadStarterTemplate = () => {
    setDraftConfig(prev => ({
      ...DEFAULT_CERDAS_CERMAT_CONFIG,
      isOpen: prev.isOpen,
      questions: DEFAULT_CERDAS_CERMAT_CONFIG.questions.map((q, idx) => ({
        ...q,
        id: `cc-q-${Date.now()}-${idx + 1}`,
        number: idx + 1
      }))
    }));
    setHasUnsavedConfigChanges(true);
    showToast('Contoh paket soal PKS dimuat ke editor. Klik Simpan Paket Soal untuk menerapkan.', 'info');
  };

  const handleSaveAdminQuizConfig = async () => {
    if (!draftConfig.title.trim()) {
      showToast('Judul paket soal Lomba Cerdas Cermat wajib diisi.', 'error');
      return;
    }
    const emptyPrompt = (draftConfig.questions || []).find(q => !q.prompt.trim());
    if (emptyPrompt) {
      showToast(`Pertanyaan Soal No. ${emptyPrompt.number} masih kosong.`, 'error');
      return;
    }
    const emptyMcOption = (draftConfig.questions || []).find(
      q =>
        q.type === 'multiple_choice' &&
        (!Array.isArray(q.options) || q.options.some(opt => !opt.text.trim()))
    );
    if (emptyMcOption) {
      showToast(
        `Pilihan jawaban A–D pada Soal No. ${emptyMcOption.number} harus diisi lengkap.`,
        'error'
      );
      return;
    }

    setIsSavingConfig(true);
    try {
      const normalizedQuestions = (draftConfig.questions || []).map((q, idx) => ({
        ...q,
        number: idx + 1,
        maxPoints: Math.max(1, Number(q.maxPoints) || 10)
      }));
      const payload: CerdasCermatConfig = {
        ...draftConfig,
        id: 'cerdas_cermat_config',
        title: draftConfig.title.trim(),
        description: draftConfig.description.trim(),
        questions: normalizedQuestions,
        updatedBy: currentUser.username,
        updatedAt: new Date().toISOString()
      };
      const res = await onSaveQuizConfig(payload);
      if (res.success || res.queuedOffline || res.isQuotaError) {
        setDraftConfig(payload);
        setHasUnsavedConfigChanges(false);
        showToast(
          res.success
            ? 'Paket soal Lomba Cerdas Cermat berhasil disimpan ke Cloud!'
            : 'Paket soal disimpan lokal / Cadangan Server dan siap disinkronkan.',
          res.success ? 'success' : 'info'
        );
      } else {
        showToast(res.error || 'Gagal menyimpan paket soal.', 'error');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Grading State (Admin)
  const [gradeSearch, setGradeSearch] = useState('');
  const [gradeStatusFilter, setGradeStatusFilter] = useState<'all' | 'submitted' | 'graded'>('all');
  const [gradeLevelFilter, setGradeLevelFilter] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [editingGrades, setEditingGrades] = useState<Record<string, CerdasCermatGradeItem>>({});
  const [editingAdminNote, setEditingAdminNote] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const filteredSubmissions = useMemo(() => {
    const q = gradeSearch.trim().toLowerCase();
    return [...submissionsList]
      .filter(sub => {
        if (gradeStatusFilter !== 'all' && sub.status !== gradeStatusFilter) return false;
        if (gradeLevelFilter !== 'all' && sub.schoolLevel !== gradeLevelFilter) return false;
        if (q) {
          const matchSchool = sub.schoolName.toLowerCase().includes(q);
          const matchUser = sub.schoolUsername.toLowerCase().includes(q);
          const matchName = sub.submittedByName.toLowerCase().includes(q);
          if (!matchSchool && !matchUser && !matchName) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'submitted' ? -1 : 1;
        return (Date.parse(b.submittedAt || '') || 0) - (Date.parse(a.submittedAt || '') || 0);
      });
  }, [submissionsList, gradeSearch, gradeStatusFilter, gradeLevelFilter]);

  useEffect(() => {
    if (adminSubTab !== 'grading') return;
    if (
      filteredSubmissions.length > 0 &&
      (!selectedSubmissionId || !filteredSubmissions.some(s => s.id === selectedSubmissionId))
    ) {
      setSelectedSubmissionId(filteredSubmissions[0].id);
    }
  }, [adminSubTab, filteredSubmissions, selectedSubmissionId]);

  const activeSubmission = useMemo(
    () => submissionsList.find(s => s.id === selectedSubmissionId) || null,
    [submissionsList, selectedSubmissionId]
  );

  const activeSubmissionQuestions = useMemo(() => {
    if (!activeSubmission) return [];
    const raw = Array.isArray(quizConfig.questions) ? quizConfig.questions : [];
    return raw
      .filter(
        q =>
          q.targetLevel === 'ALL' ||
          !q.targetLevel ||
          q.targetLevel === activeSubmission.schoolLevel
      )
      .slice()
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [activeSubmission, quizConfig.questions]);

  useEffect(() => {
    if (!activeSubmission) return;
    setEditingGrades(buildAutoGradesForSubmission(activeSubmission, activeSubmissionQuestions));
    setEditingAdminNote(activeSubmission.adminNote || '');

    if (activeSubmission.participantId && participantsList.some(p => p.id === activeSubmission.participantId)) {
      setSelectedParticipantId(activeSubmission.participantId);
    } else {
      const targetSchoolKey = normalizeSchoolNameKey(activeSubmission.schoolName);
      const exactMatch =
        participantsList.find(
          p =>
            normalizeSchoolNameKey(p.sekolah) === targetSchoolKey &&
            p.jenjang === activeSubmission.schoolLevel
        ) || participantsList.find(p => normalizeSchoolNameKey(p.sekolah) === targetSchoolKey);
      setSelectedParticipantId(exactMatch?.id || '');
    }
    setConfirmResetId(null);
  }, [activeSubmission?.id]);

  const gradingSummary = useMemo(() => {
    let autoMcScore = 0;
    let essayScore = 0;
    let maxScore = 0;
    activeSubmissionQuestions.forEach(q => {
      const maxPts = Number(q.maxPoints) || 0;
      maxScore += maxPts;
      const g = editingGrades[q.id];
      const val = Math.max(0, Math.min(maxPts, Number(g?.score) || 0));
      if (q.type === 'multiple_choice') {
        autoMcScore += val;
      } else {
        essayScore += val;
      }
    });
    return {
      autoMcScore,
      essayScore,
      totalScore: autoMcScore + essayScore,
      maxScore
    };
  }, [activeSubmissionQuestions, editingGrades]);

  const handleRecalculateMcScores = () => {
    if (!activeSubmission) return;
    setEditingGrades(prev => {
      const next = { ...prev };
      activeSubmissionQuestions.forEach(q => {
        if (q.type === 'multiple_choice') {
          const ans = activeSubmission.answers?.[q.id];
          const isCorrect =
            Boolean(ans?.selectedOption) &&
            String(ans?.selectedOption).toUpperCase() === String(q.correctOption).toUpperCase();
          next[q.id] = {
            score: isCorrect ? Number(q.maxPoints) || 0 : 0,
            comment: prev[q.id]?.comment || ''
          };
        }
      });
      return next;
    });
    showToast('Nilai seluruh soal Pilihan Ganda dihitung otomatis sesuai kunci jawaban.', 'info');
  };

  const handleSaveAndPublishGrade = async () => {
    if (!activeSubmission || isSavingGrade) return;
    setIsSavingGrade(true);
    try {
      const nowIso = new Date().toISOString();
      const targetParticipant = participantsList.find(p => p.id === selectedParticipantId) || null;
      const gradedSubmission: CerdasCermatSubmission = {
        ...activeSubmission,
        participantId: targetParticipant?.id || '',
        participantLabel: targetParticipant
          ? `No. ${targetParticipant.nomor} · ${targetParticipant.sekolah}`
          : '',
        questionGrades: editingGrades,
        autoMcScore: gradingSummary.autoMcScore,
        essayScore: gradingSummary.essayScore,
        totalScore: gradingSummary.totalScore,
        maxPossibleScore: gradingSummary.maxScore || activeSubmission.maxPossibleScore,
        status: 'graded',
        adminNote: editingAdminNote.trim(),
        gradedBy: currentUser.name || currentUser.username,
        gradedAt: nowIso,
        updatedAt: nowIso
      };

      const res = await onGradeSubmission(gradedSubmission, targetParticipant?.id || '');
      if (res.success || res.queuedOffline || res.isQuotaError) {
        showToast(
          targetParticipant
            ? `Nilai ${gradedSubmission.totalScore} disahkan & otomatis masuk ke Rekap Utama (${targetParticipant.sekolah})!`
            : `Nilai ${gradedSubmission.totalScore} berhasil disahkan untuk ${activeSubmission.schoolName}!`,
          res.success ? 'success' : 'info'
        );
      } else {
        showToast(res.error || 'Gagal menyimpan penilaian.', 'error');
      }
    } finally {
      setIsSavingGrade(false);
    }
  };

  const handleResetSchoolSubmission = async (subId: string) => {
    if (!onDeleteSubmission) return;
    const res = await onDeleteSubmission(subId);
    if (res.success || res.queuedOffline || res.isQuotaError) {
      setConfirmResetId(null);
      setSelectedSubmissionId(null);
      showToast('Kiriman sekolah direset. Sekolah kini dapat mengirim jawaban ulang.', 'info');
    } else {
      showToast(res.error || 'Gagal mereset kiriman sekolah.', 'error');
    }
  };

  const totalSchoolAccounts = useMemo(
    () => usersList.filter(u => u.role === 'sekolah').length,
    [usersList]
  );
  const pendingCount = useMemo(
    () => submissionsList.filter(s => s.status === 'submitted').length,
    [submissionsList]
  );
  const gradedCount = useMemo(
    () => submissionsList.filter(s => s.status === 'graded').length,
    [submissionsList]
  );

  // ========================================================
  // RENDER MODE 1: AKUN SEKOLAH (FORM LOMBA CERDAS CERMAT)
  // ========================================================
  if (mode === 'school') {
    const isGraded = mySubmission?.status === 'graded';
    const isSubmittedWaiting = mySubmission?.status === 'submitted';

    return (
      <div className="space-y-6">
        {/* Top Hero Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-bold text-blue-700">
                Lomba Cerdas Cermat · Khusus Akun Sekolah
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {quizConfig.title || 'Lomba Cerdas Cermat PKS'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                {quizConfig.description}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{schoolDisplayName}</span>
                <span aria-hidden="true">·</span>
                <span>Jenjang {schoolLevel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {schoolApplicableQuestions.length} Soal
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Maks {schoolMaxPossibleScore} Poin
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-start lg:items-end gap-1.5">
              {isGraded ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sudah Dinilai Admin</span>
                </div>
              ) : isSubmittedWaiting ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Terkirim · Menunggu Penilaian Admin</span>
                </div>
              ) : quizConfig.isOpen ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                  <Unlock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Formulir Terbuka (Sekali Kirim)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Formulir Sedang Ditutup Admin</span>
                </div>
              )}
              {mySubmission && (
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Dikirim: {formatDateTimeId(mySubmission.submittedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Graded Score Summary for School */}
          {isGraded && mySubmission && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
              <div className="md:col-span-5 bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                    Nilai Resmi Cerdas Cermat
                  </span>
                  <div className="text-4xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                    {mySubmission.totalScore}
                    <span className="text-base font-bold text-emerald-600/80 ml-1">
                      / {mySubmission.maxPossibleScore || schoolMaxPossibleScore}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-800 mt-1 block">
                    Telah disahkan oleh {mySubmission.gradedBy || 'Admin Panitia'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
              </div>

              <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Pilihan Ganda
                    </span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                      {mySubmission.autoMcScore} poin
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Isian / Esai
                    </span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                      {mySubmission.essayScore} poin
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Waktu Penilaian
                    </span>
                    <span className="text-xs font-semibold text-slate-800 font-mono tabular-nums">
                      {formatDateTimeId(mySubmission.gradedAt)}
                    </span>
                  </div>
                </div>
                {mySubmission.adminNote && (
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <strong className="text-slate-900">Catatan Admin:</strong>{' '}
                    {mySubmission.adminNote}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Waiting Admin Grading Notice (Score Hidden!) */}
          {isSubmittedWaiting && mySubmission && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-amber-950">
                <p className="font-bold">
                  Jawaban Anda sudah tersimpan dan dikunci (aturan 1 kali kirim per sekolah).
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Nilai resmi akan tampil otomatis di halaman ini setelah Admin Panitia memeriksa dan mengesahkan penilaian. Di bawah ini adalah arsip jawaban yang telah Anda kirimkan.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Form Area or Read-only Answers */}
        {mySubmission ? (
          <div className="space-y-4">
            {schoolApplicableQuestions.map((q, idx) => {
              const ans = mySubmission.answers?.[q.id];
              const grade = mySubmission.questionGrades?.[q.id];
              const selectedOptObj =
                q.type === 'multiple_choice'
                  ? q.options?.find(o => o.key === ans?.selectedOption)
                  : null;

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-black text-slate-900">
                        Soal {idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {q.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian / Esai'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Bobot {q.maxPoints} poin</span>
                    </div>

                    {isGraded && (
                      <span className="font-mono tabular-nums text-xs font-black text-emerald-700">
                        Nilai: {grade?.score ?? 0} / {q.maxPoints}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                    {q.prompt}
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 space-y-1">
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">
                      Jawaban Sekolah:
                    </span>
                    {q.type === 'multiple_choice' ? (
                      <p className="font-semibold text-slate-900">
                        {ans?.selectedOption
                          ? `${ans.selectedOption}. ${selectedOptObj?.text || ''}`
                          : '(Tidak dijawab)'}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                        {ans?.textAnswer?.trim() ? ans.textAnswer : '(Tidak dijawab)'}
                      </p>
                    )}
                  </div>

                  {isGraded && grade?.comment && (
                    <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <strong>Catatan Koreksi:</strong> {grade.comment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !quizConfig.isOpen ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Formulir Lomba Cerdas Cermat Belum Dibuka
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Saat ini Admin Panitia belum membuka sesi pengerjaan Lomba Cerdas Cermat. Silakan hubungi panitia atau cek kembali sesuai jadwal perlombaan.
            </p>
          </div>
        ) : schoolApplicableQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Belum Ada Soal Tersedia Untuk Jenjang {schoolLevel}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Admin Panitia belum menambahkan butir soal untuk jenjang sekolah Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sticky Progress & Submit Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Progres Pengisian Jawaban</span>
                  <span className="font-mono tabular-nums text-blue-700">
                    {answeredCount} / {schoolApplicableQuestions.length} Soal Terisi
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-200"
                    style={{
                      width: `${
                        schoolApplicableQuestions.length > 0
                          ? (answeredCount / schoolApplicableQuestions.length) * 100
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Kirim Jawaban Final</span>
              </button>
            </div>

            {/* Question List */}
            {schoolApplicableQuestions.map((q, idx) => {
              const ans = schoolAnswers[q.id];
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-black text-slate-900 text-sm">
                        No. {idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {q.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian / Esai'}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-600">
                      Bobot Maks: {q.maxPoints} poin
                    </span>
                  </div>

                  <p className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-relaxed">
                    {q.prompt}
                  </p>

                  {q.type === 'multiple_choice' ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      {(q.options || []).map(opt => {
                        const isSelected = ans?.selectedOption === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleSchoolSelectOption(q.id, opt.key)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-slate-950'
                                : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <span className="text-xs sm:text-sm leading-relaxed pt-0.5">
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600">
                        Jawaban Isian / Esai Sekolah:
                      </label>
                      <textarea
                        rows={4}
                        value={ans?.textAnswer || ''}
                        onChange={e => handleSchoolEssayChange(q.id, e.target.value)}
                        placeholder="Tuliskan jawaban lengkap dan jelas di sini..."
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <div className="text-right text-[11px] font-mono tabular-nums text-slate-400">
                        {(ans?.textAnswer || '').length} karakter
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Submit Button */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Pastikan seluruh jawaban telah diperiksa. Pengiriman hanya dilakukan{' '}
                <strong className="text-slate-900">1 kali per akun sekolah</strong>.
              </div>
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Kirim Jawaban Final</span>
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmSubmitOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Konfirmasi Kirim Jawaban Final
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sekali kirim · Tidak dapat diubah setelah terkirim
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Anda akan mengirimkan jawaban Lomba Cerdas Cermat untuk{' '}
                  <strong className="text-slate-900">{schoolDisplayName}</strong> ({schoolLevel}).
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-mono tabular-nums">
                  <span>Soal terjawab:</span>
                  <strong className="text-slate-900">
                    {answeredCount} / {schoolApplicableQuestions.length}
                  </strong>
                </div>
                {answeredCount < schoolApplicableQuestions.length && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold">
                    Perhatian: Masih terdapat{' '}
                    {schoolApplicableQuestions.length - answeredCount} soal yang belum diisi.
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingSchool}
                  onClick={() => setConfirmSubmitOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Periksa Lagi
                </button>
                <button
                  type="button"
                  disabled={isSubmittingSchool}
                  onClick={() => void handleConfirmSchoolSubmit()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingSchool ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ya, Kirim Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // RENDER MODE 2: ADMIN (KELOLA SOAL & BERI NILAI)
  // ========================================================
  return (
    <div className="space-y-6">
      {/* Header & 4 KPI Cards */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <div className="text-xs font-bold text-blue-700">
              Panel Administrator · Lomba Cerdas Cermat
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Kelola Soal & Penilaian Lomba Cerdas Cermat
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Formulir soal hanya ditampilkan & dijawab pada akun Sekolah. Nilai yang disahkan otomatis masuk ke kategori Lomba Cerdas Cermat di Rekapitulasi Utama.
            </p>
          </div>

          {/* Segmented Sub-tab Control */}
          <div
            className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0 self-start lg:self-center"
            role="tablist"
            aria-label="Sub-menu Cerdas Cermat Admin"
          >
            <button
              type="button"
              onClick={() => setAdminSubTab('questions')}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'questions'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit className="w-3.5 h-3.5 shrink-0" />
              <span>Kelola & Edit Soal ({draftConfig.questions?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminSubTab('grading')}
              className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'grading'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Jawaban & Penilaian ({submissionsList.length})</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Butir Soal
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
                {draftConfig.questions?.length || 0}
              </div>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {(draftConfig.questions || []).filter(q => q.type === 'multiple_choice').length} PG ·{' '}
                {(draftConfig.questions || []).filter(q => q.type === 'essay').length} Esai
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Poin Paket
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
                {draftTotalPoints}
              </div>
              <span className="text-[11px] text-slate-500">
                Status:{' '}
                <strong className={draftConfig.isOpen ? 'text-emerald-700' : 'text-rose-700'}>
                  {draftConfig.isOpen ? 'Dibuka' : 'Ditutup'}
                </strong>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Kiriman Sekolah
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
                {submissionsList.length}
              </div>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                dari {totalSchoolAccounts} akun sekolah
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                Status Penilaian
              </span>
              <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-0.5">
                {gradedCount}
                <span className="text-sm font-bold text-slate-500"> / {submissionsList.length}</span>
              </div>
              <span className="text-[11px] text-amber-700 font-mono tabular-nums">
                {pendingCount} menunggu penilaian
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN SUB-TAB 1: KELOLA & EDIT SOAL */}
      {adminSubTab === 'questions' && (
        <div className="space-y-5">
          {/* Quiz Settings Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Pengaturan Paket Soal & Akses Sekolah
                </h3>
                <p className="text-xs text-slate-500">
                  Atur judul, petunjuk pengerjaan, dan status buka/tutup form untuk akun Sekolah.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasUnsavedConfigChanges && (
                  <span className="text-xs font-bold text-amber-700">
                    Perubahan belum disimpan
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={() => void handleSaveAdminQuizConfig()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isSavingConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Paket Soal</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Lomba Cerdas Cermat *
                  </label>
                  <input
                    type="text"
                    value={draftConfig.title}
                    onChange={e => handleUpdateDraftMeta({ title: e.target.value })}
                    placeholder="Contoh: Lomba Cerdas Cermat PKS Tingkat Polres 2026"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Petunjuk Pengerjaan (Tampil di Akun Sekolah)
                  </label>
                  <textarea
                    rows={2}
                    value={draftConfig.description}
                    onChange={e => handleUpdateDraftMeta({ description: e.target.value })}
                    placeholder="Tuliskan petunjuk pengerjaan untuk perwakilan sekolah..."
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">
                    Status Akses Form Sekolah
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Saat dibuka, seluruh akun Sekolah dapat membaca dan mengirim jawaban satu kali.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateDraftMeta({ isOpen: !draftConfig.isOpen })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                    draftConfig.isOpen
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  {draftConfig.isOpen ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Formulir Terbuka (Klik untuk Tutup)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Formulir Ditutup (Klik untuk Buka)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Question Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_choice')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Soal Pilihan Ganda</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('essay')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Soal Isian / Esai</span>
              </button>
              <button
                type="button"
                onClick={handleLoadStarterTemplate}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Muat Contoh Paket Soal PKS</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(['ALL', 'SLTP', 'SLTA'] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setQuestionLevelFilter(lvl)}
                  className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    questionLevelFilter === lvl
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'ALL' ? 'Semua Jenjang' : lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Question Editor Cards */}
          {filteredDraftQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Belum ada butir soal pada filter ini.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('multiple_choice')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Tambah Soal Pertama
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDraftQuestions.map(q => {
                const realIdx = (draftConfig.questions || []).findIndex(item => item.id === q.id);
                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono tabular-nums font-black text-sm text-slate-900">
                          Soal #{q.number}
                        </span>

                        <select
                          value={q.type}
                          onChange={e => {
                            const nextType = e.target.value as CerdasCermatQuestionType;
                            handleUpdateQuestion(q.id, cur => ({
                              ...cur,
                              type: nextType,
                              options:
                                nextType === 'multiple_choice' &&
                                (!cur.options || cur.options.length === 0)
                                  ? [
                                      { key: 'A', text: '' },
                                      { key: 'B', text: '' },
                                      { key: 'C', text: '' },
                                      { key: 'D', text: '' }
                                    ]
                                  : cur.options
                            }));
                          }}
                          className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                        >
                          <option value="multiple_choice">Pilihan Ganda (A–D)</option>
                          <option value="essay">Isian Singkat / Esai</option>
                        </select>

                        <select
                          value={q.targetLevel || 'ALL'}
                          onChange={e =>
                            handleUpdateQuestion(q.id, cur => ({
                              ...cur,
                              targetLevel: e.target.value as CerdasCermatTargetLevel
                            }))
                          }
                          className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                        >
                          <option value="ALL">Semua Jenjang (SLTP & SLTA)</option>
                          <option value="SLTP">Khusus SLTP</option>
                          <option value="SLTA">Khusus SLTA</option>
                        </select>

                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Bobot:</label>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={q.maxPoints}
                            onChange={e =>
                              handleUpdateQuestion(q.id, cur => ({
                                ...cur,
                                maxPoints: Math.max(1, Number(e.target.value) || 1)
                              }))
                            }
                            className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono tabular-nums font-bold text-center"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={realIdx <= 0}
                          onClick={() => handleMoveQuestion(realIdx, -1)}
                          title="Pindah ke atas"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={realIdx >= (draftConfig.questions?.length || 0) - 1}
                          onClick={() => handleMoveQuestion(realIdx, 1)}
                          title="Pindah ke bawah"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Hapus soal ini"
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Teks Pertanyaan *
                      </label>
                      <textarea
                        rows={2}
                        value={q.prompt}
                        onChange={e =>
                          handleUpdateQuestion(q.id, cur => ({ ...cur, prompt: e.target.value }))
                        }
                        placeholder="Tuliskan pertanyaan Lomba Cerdas Cermat..."
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {q.type === 'multiple_choice' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {(q.options || []).map(opt => (
                            <div key={opt.key} className="flex items-center gap-2">
                              <span
                                className={`w-7 h-7 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                                  q.correctOption === opt.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                                }`}
                              >
                                {opt.key}
                              </span>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={e =>
                                  handleUpdateQuestion(q.id, cur => ({
                                    ...cur,
                                    options: (cur.options || []).map(o =>
                                      o.key === opt.key ? { ...o, text: e.target.value } : o
                                    )
                                  }))
                                }
                                placeholder={`Pilihan jawaban ${opt.key}...`}
                                className="flex-1 border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-xs font-bold text-slate-700">Kunci Jawaban Benar:</span>
                          {(['A', 'B', 'C', 'D'] as const).map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                handleUpdateQuestion(q.id, cur => ({ ...cur, correctOption: k }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition-colors cursor-pointer ${
                                q.correctOption === k
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Pedoman / Referensi Jawaban (Hanya dilihat Admin saat mengoreksi)
                        </label>
                        <textarea
                          rows={2}
                          value={q.guideAnswer || ''}
                          onChange={e =>
                            handleUpdateQuestion(q.id, cur => ({
                              ...cur,
                              guideAnswer: e.target.value
                            }))
                          }
                          placeholder="Opsional: catat poin kunci jawaban untuk memudahkan koreksi esai..."
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Save Footer */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 font-mono tabular-nums">
              Total {draftConfig.questions?.length || 0} soal · Total Bobot {draftTotalPoints} poin
            </div>
            <button
              type="button"
              disabled={isSavingConfig}
              onClick={() => void handleSaveAdminQuizConfig()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Paket Soal</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ADMIN SUB-TAB 2: JAWABAN & PENILAIAN SEKOLAH */}
      {adminSubTab === 'grading' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 4 COLS: SUBMISSIONS DIRECTORY */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={gradeSearch}
                  onChange={e => setGradeSearch(e.target.value)}
                  placeholder="Cari nama sekolah..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                {(
                  [
                    { key: 'all', label: 'Semua' },
                    { key: 'submitted', label: 'Menunggu' },
                    { key: 'graded', label: 'Dinilai' }
                  ] as const
                ).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGradeStatusFilter(item.key)}
                    className={`flex-1 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      gradeStatusFilter === item.key
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {(['all', 'SLTP', 'SLTA'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setGradeLevelFilter(lvl)}
                    className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      gradeLevelFilter === lvl
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lvl === 'all' ? 'Semua Jenjang' : lvl}
                  </button>
                ))}
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  Belum ada kiriman jawaban sekolah yang sesuai filter.
                </p>
                <p className="text-[11px] text-slate-500">
                  Sekolah akan muncul di sini otomatis setelah mengirim jawaban dari akun Sekolah.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                {filteredSubmissions.map(sub => {
                  const isActive = sub.id === activeSubmission?.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmissionId(sub.id)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer space-y-1.5 ${
                        isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {sub.schoolName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            <span>{sub.schoolLevel}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono">@{sub.schoolUsername}</span>
                          </div>
                        </div>
                        {sub.status === 'graded' ? (
                          <span className="text-xs font-mono tabular-nums font-black text-emerald-700 shrink-0">
                            {sub.totalScore} pt
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 shrink-0">
                            Perlu Nilai
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                        Kirim: {formatDateTimeId(sub.submittedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 8 COLS: SELECTED SUBMISSION GRADING PANEL */}
          <div className="lg:col-span-8">
            {!activeSubmission ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-2">
                <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  Pilih Sekolah untuk Mengoreksi & Memberi Nilai
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih salah satu sekolah pada daftar di sebelah kiri untuk membuka lembar jawaban dan menyinkronkan nilainya ke Rekap Utama.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* School Header */}
                <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{activeSubmission.schoolLevel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">@{activeSubmission.schoolUsername}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Kirim {formatDateTimeId(activeSubmission.submittedAt)}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5 truncate">
                      {activeSubmission.schoolName}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRecalculateMcScores}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Hitung Otomatis PG
                    </button>
                    {onDeleteSubmission && (
                      confirmResetId === activeSubmission.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleResetSchoolSubmission(activeSubmission.id)}
                            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Konfirmasi Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmResetId(null)}
                            className="px-2.5 py-1.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmResetId(activeSubmission.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Reset Kiriman
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Participant Mapping for Rekap Utama */}
                <div className="p-5 border-b border-slate-200 bg-blue-50/40 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Peserta Tujuan Sinkronisasi Rekap Utama (Kategori: Lomba Cerdas Cermat)
                  </label>
                  <select
                    value={selectedParticipantId}
                    onChange={e => setSelectedParticipantId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Simpan nilai di modul Cerdas Cermat saja (belum ditautkan ke peserta) --</option>
                    {participantsList.map(p => (
                      <option key={p.id} value={p.id}>
                        No. {p.nomor} · {p.sekolah} ({p.jenjang || 'SLTP'})
                        {p.peleton ? ` — ${p.peleton}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-600">
                    Saat Anda klik <strong>Simpan &amp; Sahkan Nilai</strong>, total skor akan otomatis masuk ke kolom nilai kategori <strong>Lomba Cerdas Cermat</strong> milik peserta yang dipilih pada Rekapitulasi Utama.
                  </p>
                </div>

                {/* Question-by-Question Grading List */}
                <div className="divide-y divide-slate-200">
                  {activeSubmissionQuestions.map((q, idx) => {
                    const ans = activeSubmission.answers?.[q.id];
                    const grade = editingGrades[q.id] || { score: 0, comment: '' };
                    const selectedOptText =
                      q.type === 'multiple_choice'
                        ? q.options?.find(o => o.key === ans?.selectedOption)?.text || ''
                        : '';
                    const isMcCorrect =
                      q.type === 'multiple_choice' &&
                      Boolean(ans?.selectedOption) &&
                      String(ans?.selectedOption).toUpperCase() ===
                        String(q.correctOption).toUpperCase();

                    return (
                      <div key={q.id} className="p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-mono tabular-nums font-black text-slate-900">
                              Soal {idx + 1}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {q.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian / Esai'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">Maks {q.maxPoints} pt</span>
                          </div>

                          {q.type === 'multiple_choice' && (
                            <span
                              className={`text-xs font-bold ${
                                isMcCorrect ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isMcCorrect
                                ? `Benar (Kunci: ${q.correctOption})`
                                : `Salah (Kunci: ${q.correctOption})`}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                          {q.prompt}
                        </p>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">
                            Jawaban Sekolah:
                          </span>
                          {q.type === 'multiple_choice' ? (
                            <p className="font-semibold text-slate-900">
                              {ans?.selectedOption
                                ? `${ans.selectedOption}. ${selectedOptText}`
                                : '(Tidak dijawab)'}
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                              {ans?.textAnswer?.trim() ? ans.textAnswer : '(Tidak dijawab)'}
                            </p>
                          )}
                          {q.type === 'essay' && q.guideAnswer && (
                            <div className="pt-2 mt-2 border-t border-slate-200 text-[11px] text-slate-600">
                              <strong>Pedoman Jawaban:</strong> {q.guideAnswer}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
                          <div className="sm:col-span-5 flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Nilai:
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={q.maxPoints}
                              value={grade.score}
                              onChange={e => {
                                const raw = Number(e.target.value);
                                const clamped = Number.isNaN(raw)
                                  ? 0
                                  : Math.max(0, Math.min(q.maxPoints, raw));
                                setEditingGrades(prev => ({
                                  ...prev,
                                  [q.id]: { ...(prev[q.id] || { score: 0 }), score: clamped }
                                }));
                              }}
                              className="w-20 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold text-center"
                            />
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              / {q.maxPoints}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingGrades(prev => ({
                                  ...prev,
                                  [q.id]: { ...(prev[q.id] || { score: 0 }), score: q.maxPoints }
                                }))
                              }
                              className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer"
                            >
                              Maks
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingGrades(prev => ({
                                  ...prev,
                                  [q.id]: { ...(prev[q.id] || { score: 0 }), score: 0 }
                                }))
                              }
                              className="px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                            >
                              0
                            </button>
                          </div>

                          <div className="sm:col-span-7">
                            <input
                              type="text"
                              value={grade.comment || ''}
                              onChange={e =>
                                setEditingGrades(prev => ({
                                  ...prev,
                                  [q.id]: {
                                    ...(prev[q.id] || { score: 0 }),
                                    comment: e.target.value
                                  }
                                }))
                              }
                              placeholder="Catatan koreksi butir ini (opsional)..."
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary & Publish Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Catatan Umum Penilaian Admin (Tampil di Akun Sekolah setelah disahkan)
                    </label>
                    <input
                      type="text"
                      value={editingAdminNote}
                      onChange={e => setEditingAdminNote(e.target.value)}
                      placeholder="Contoh: Jawaban sangat baik dan sistematis..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-slate-500 block font-sans text-[11px]">
                          Pilihan Ganda
                        </span>
                        <strong className="text-slate-900">{gradingSummary.autoMcScore} pt</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans text-[11px]">
                          Isian / Esai
                        </span>
                        <strong className="text-slate-900">{gradingSummary.essayScore} pt</strong>
                      </div>
                      <div>
                        <span className="text-emerald-700 block font-sans text-[11px] font-bold">
                          Total Nilai Akhir
                        </span>
                        <strong className="text-lg font-black text-emerald-700">
                          {gradingSummary.totalScore} / {gradingSummary.maxScore}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingGrade}
                      onClick={() => void handleSaveAndPublishGrade()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isSavingGrade ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan &amp; Sinkron...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Simpan &amp; Sahkan Nilai ke Rekap Utama</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

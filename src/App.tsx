/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Shield,
  User,
  Lock,
  LogIn,
  LogOut,
  UserCheck,
  UserPlus,
  Users,
  Edit,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  Search,
  Trophy,
  Award,
  Medal,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Building2,
  Menu,
  ChevronUp,
  ListChecks,
  ChevronDown,
  X,
  Eye,
  Sliders,
  Footprints,
  Sparkles,
  Megaphone,
  LayoutDashboard,
  Check,
  Settings,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  FileText,
  Camera,
  Image as ImageIcon,
  Loader2,
  Clock,
  AlertCircle,
  Phone,
  Star,
  BarChart3,
  PieChart,
  Cloud,
  RefreshCw,
  Power,
  ShieldAlert,
  CreditCard
} from 'lucide-react';
import { RegistrationFormsView } from './components/RegistrationFormsView';
import { RegistrationSubmissionsAdminView } from './components/RegistrationSubmissionsAdminView';
import { PaymentGatewaySettingsModal } from './components/PaymentGatewaySettingsModal';
import { BlankoEditorModal } from './components/BlankoEditorModal';
import { LogoSettingModal } from './components/LogoSettingModal';
import { SchoolAccountManagerModal } from './components/SchoolAccountManagerModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { AppStatusModal } from './components/AppStatusModal';
import { AppMaintenanceView } from './components/AppMaintenanceView';
import {
  testConnection,
  subscribeToParticipants,
  saveParticipantToCloud,
  deleteParticipantFromCloud,
  subscribeToUsers,
  saveUserToCloud,
  deleteUserFromCloud,
  subscribeToConfig,
  saveConfigToCloud,
  subscribeToLogo,
  saveLogoToCloud,
  subscribeToAppStatus,
  saveAppStatusToCloud,
  AppStatusConfig,
  subscribeToPaymentConfig,
  savePaymentConfigToCloud,
  subscribeToRegistrations,
  saveRegistrationToCloud,
  PaymentConfig,
  DEFAULT_PAYMENT_CONFIG,
  RegistrationSubmission,
  subscribeToBlankoConfig,
  saveBlankoConfigToCloud,
  BlankoConfig,
  DEFAULT_BLANKO_CONFIG
} from './lib/firebase';

// ==========================================
// TYPES & CRITERIA DEFINITIONS
// ==========================================

export type UserRole = 'superadmin' | 'admin' | 'juri' | 'user' | 'sekolah';
export type SchoolLevel = 'SLTP' | 'SLTA';

export interface AppUser {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  isCustom?: boolean;
  schoolName?: string;
  schoolLevel?: SchoolLevel;
  pembinaName?: string;
  contactWa?: string;
}

export interface Criterion {
  no: number;
  name: string;
  weights: [number, number, number, number, number]; // [KS, K, C, B, A]
}

export type CategoryKey =
  | 'pbb'
  | 'variasi'
  | 'formasi'
  | 'danton'
  | 'devile'
  | 'gatur'
  | 'senam'
  | 'yelyel'
  | 'beladiri'
  | 'speaking'
  | 'tenda';

export interface CategoryConfig {
  key: CategoryKey;
  title: string;
  shortTitle: string;
  group: 'PBB & Variasi' | 'Lantas & Lapangan' | 'Kreasi & Khusus';
  maxPoints: number;
  isMandatory: boolean;
  criteria: Criterion[];
}

export interface ParticipantScores {
  pbb: Record<number, number>;
  variasi: Record<number, number>;
  formasi: Record<number, number>;
  danton: Record<number, number>;
  devile: Record<number, number>;
  gatur: Record<number, number>;
  senam: Record<number, number>;
  yelyel: Record<number, number>;
  beladiri: Record<number, number>;
  speaking: Record<number, number>;
  tenda: Record<number, number>;
}

export interface FormPhotoData {
  url: string;
  uploadTime: string;
  juriName?: string;
  fileName?: string;
  notes?: string;
}

export interface Participant {
  id: string;
  nomor: string;
  peleton?: string; // Opsional
  jenjang: SchoolLevel; // 'SLTP' | 'SLTA'
  sekolah: string;
  tanggal: string;
  juri: string;
  scores: ParticipantScores;
  formPhotos?: Partial<Record<CategoryKey, FormPhotoData>>;
}

export interface CategorySummary {
  key: CategoryKey;
  title: string;
  sum: number;
  maxPoints: number;
  count: number;
  totalCriteria: number;
  pct: number;
  isComplete: boolean;
  isMandatory: boolean;
}

export interface CalculatedScores {
  categorySummaries: Record<CategoryKey, CategorySummary>;
  grandTotal: number;
  maxGrandTotal: number;
  grandPct: number;
  completedCategoriesCount: number;
  totalCategoriesCount: number;
  mandatoryCompleted: boolean;
  isFullyCompleted: boolean;
}

// -------------------------------------------------------------
// DEFINISI RESMI SELURUH KRITERIA PENILAIAN LOMBA PBB & PKS
// -------------------------------------------------------------

// 1. GERAKAN DASAR PBB (20 KRITERIA - 500 POIN)
const PBB_CRITERIA: Criterion[] = [
  { no: 1, name: "Langkah biasa ke langkah tegap", weights: [5, 10, 15, 20, 25] },
  { no: 2, name: "Ganti Langkah", weights: [6, 10, 15, 20, 26] },
  { no: 3, name: "2x belok kanan", weights: [6, 12, 18, 24, 30] },
  { no: 4, name: "Hormat kanan", weights: [6, 12, 18, 23, 28] },
  { no: 5, name: "Langkah biasa", weights: [5, 10, 15, 20, 25] },
  { no: 6, name: "Belok kanan (2 kali)", weights: [6, 12, 18, 24, 30] },
  { no: 7, name: "Hadap kiri berhenti", weights: [5, 10, 15, 20, 25] },
  { no: 8, name: "Jalan di tempat", weights: [5, 10, 15, 20, 25] },
  { no: 9, name: "3 langkah ke belakang", weights: [5, 10, 15, 20, 25] },
  { no: 10, name: "2 langkah ke kanan", weights: [5, 10, 15, 20, 25] },
  { no: 11, name: "3 langkah ke depan", weights: [5, 10, 15, 20, 25] },
  { no: 12, name: "2 langkah ke kiri", weights: [5, 10, 15, 20, 25] },
  { no: 13, name: "Setengah Lengan lencang kanan", weights: [5, 10, 15, 20, 25] },
  { no: 14, name: "Lencang kanan", weights: [5, 10, 15, 20, 25] },
  { no: 15, name: "Serong kanan", weights: [4, 8, 12, 18, 22] },
  { no: 16, name: "Periksa kerapihan", weights: [6, 12, 18, 24, 30] },
  { no: 17, name: "Serong kiri", weights: [4, 8, 12, 18, 22] },
  { no: 18, name: "Parade istirahat di tempat", weights: [4, 8, 12, 16, 20] },
  { no: 19, name: "Hitung", weights: [4, 8, 12, 16, 20] },
  { no: 20, name: "Hormat", weights: [4, 8, 12, 18, 22] }
];

// 2. GERAKAN VARIASI (8 KRITERIA - 84 POIN)
const VARIASI_CRITERIA: Criterion[] = [
  { no: 1, name: "Opening Variasi", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Kerapihan Barisan", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Kekompakan Gerak", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Semangat dan Penjiwaan", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Kesesuaian Pesan dan Gerakan", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Penguasaan Lapangan", weights: [4, 6, 8, 10, 12] },
  { no: 7, name: "Kreativitas", weights: [2, 4, 6, 8, 10] },
  { no: 8, name: "Tingkat Kesulitan", weights: [4, 6, 8, 10, 12] }
];

// 3. GERAKAN FORMASI (11 KRITERIA - 114 POIN)
const FORMASI_CRITERIA: Criterion[] = [
  { no: 1, name: "Proses Membuka Formasi", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Kerapihan Barisan", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Kekompakan Gerak", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Semangat dan Penjiwaan", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Penguasaan Lapangan", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Dinamis Struktur", weights: [4, 6, 8, 10, 12] },
  { no: 7, name: "Bentuk Akhir Formasi", weights: [2, 4, 6, 8, 10] },
  { no: 8, name: "Kreativitas", weights: [2, 4, 6, 8, 10] },
  { no: 9, name: "Tingkat Kesulitan", weights: [4, 6, 8, 10, 12] },
  { no: 10, name: "Proses Menutup Formasi", weights: [2, 4, 6, 8, 10] },
  { no: 11, name: "Ending Celebration", weights: [2, 4, 6, 8, 10] }
];

// 4. DANTON (6 KRITERIA - 50 POIN)
const DANTON_CRITERIA: Criterion[] = [
  { no: 1, name: "Penilaian Khusus", weights: [3, 4, 5, 6, 7] },
  { no: 2, name: "Suara (Intonasi)", weights: [3, 4, 5, 6, 7] },
  { no: 3, name: "CMI (Cara Memberikan Instruksi)", weights: [3, 4, 5, 6, 7] },
  { no: 4, name: "Sikap PBB", weights: [3, 4, 5, 6, 7] },
  { no: 5, name: "Penguasaan Lapangan", weights: [3, 5, 7, 9, 11] },
  { no: 6, name: "Penguasaan Materi Lomba", weights: [3, 5, 7, 9, 11] }
];

// 5. DEVILE DAN UNIFORM (7 KRITERIA - MAKS 60 POIN)
const DEVILE_CRITERIA: Criterion[] = [
  { no: 1, name: "Kekompakan Gerakan", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Cara Penghormatan", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Keserasian Gerakan", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Langkah Tegap", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Kelengkapan Atribut", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Keserasian", weights: [2, 4, 6, 8, 10] },
  { no: 7, name: "Kerapihan", weights: [2, 4, 6, 8, 10] }
];

// 6. GATUR LANTAS (15 KRITERIA @ MAKS 10 POIN = 150 POIN)
const GATUR_CRITERIA: Criterion[] = [
  { no: 1, name: "Stop Semua Jurusan", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Stop Arah Tertentu", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Stop Arah Depan", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Stop Arah Belakang", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Stop Arah Depan Belakang", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Jalan Arah Kanan", weights: [2, 4, 6, 8, 10] },
  { no: 7, name: "Jalan Arah Kiri", weights: [2, 4, 6, 8, 10] },
  { no: 8, name: "Jalan Arah Kanan Kiri", weights: [2, 4, 6, 8, 10] },
  { no: 9, name: "Percepat Arah Kanan", weights: [2, 4, 6, 8, 10] },
  { no: 10, name: "Percepat Arah Kiri", weights: [2, 4, 6, 8, 10] },
  { no: 11, name: "Perlambat Arah Kanan", weights: [2, 4, 6, 8, 10] },
  { no: 12, name: "Perlambat Arah Kiri", weights: [2, 4, 6, 8, 10] },
  { no: 13, name: "Kekompakan", weights: [2, 4, 6, 8, 10] },
  { no: 14, name: "Kerapihan", weights: [2, 4, 6, 8, 10] },
  { no: 15, name: "Keindahan", weights: [2, 4, 6, 8, 10] }
];

// 7. SENAM LANTAS (6 KRITERIA - 60 POIN)
const SENAM_CRITERIA: Criterion[] = [
  { no: 1, name: "Ketepatan Gerakan", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Kekompakan dan Keseragaman", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Kesesuaian Gerakan dengan Irama", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Kreativitas Koreografi dan Formasi", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Semangat dan Ekspresi", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Penyampaian Pesan Keselamatan Lalu Lintas", weights: [2, 4, 6, 8, 10] }
];

// 8. YEL-YEL (4 KRITERIA - 100 POIN)
const YELYEL_CRITERIA: Criterion[] = [
  { no: 1, name: "Kreativitas dan Orisinalitas", weights: [5, 10, 15, 20, 25] },
  { no: 2, name: "Kekompakan Suara dan Gerakan", weights: [5, 10, 15, 20, 25] },
  { no: 3, name: "Semangat, Intonasi, dan Ekspresi", weights: [5, 10, 15, 20, 25] },
  { no: 4, name: "Kesesuaian Tema dan Daya Tarik Penampilan", weights: [5, 10, 15, 20, 25] }
];

// 9. BELADIRI (8 KRITERIA - 60 / 80 POIN)
const BELADIRI_CRITERIA: Criterion[] = [
  { no: 1, name: "Penghormatan", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Sikap Kuda-Kuda", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Pukulan Atas / Tengah / Bawah", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Tangkisan Atas / Tengah / Bawah", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Pegangan 1 (Wajib)", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Pegangan 2", weights: [2, 4, 6, 8, 10] },
  { no: 7, name: "Cara Bawa Tahanan 1 (Wajib)", weights: [2, 4, 6, 8, 10] },
  { no: 8, name: "Cara Bawa Tahanan 2", weights: [2, 4, 6, 8, 10] }
];

// 10. PUBLIC SPEAKING (5 KRITERIA - 100 POIN)
const SPEAKING_CRITERIA: Criterion[] = [
  { no: 1, name: "Intonasi", weights: [5, 10, 15, 20, 25] },
  { no: 2, name: "Vocal atau Volume", weights: [5, 10, 15, 20, 25] },
  { no: 3, name: "Pemilihan Diksi", weights: [5, 10, 15, 20, 25] },
  { no: 4, name: "Gestur", weights: [5, 10, 15, 20, 25] },
  { no: 5, name: "Mimik Muka", weights: [5, 10, 15, 20, 25] }
];

// 11. KELENGKAPAN TENDA (6 KRITERIA - 60 POIN)
const TENDA_CRITERIA: Criterion[] = [
  { no: 1, name: "Aksesoris", weights: [2, 4, 6, 8, 10] },
  { no: 2, name: "Kebersihan", weights: [2, 4, 6, 8, 10] },
  { no: 3, name: "Pembatas", weights: [2, 4, 6, 8, 10] },
  { no: 4, name: "Gada - Gada", weights: [2, 4, 6, 8, 10] },
  { no: 5, name: "Keamanan", weights: [2, 4, 6, 8, 10] },
  { no: 6, name: "Kelengkapan Peralatan Wajib", weights: [2, 4, 6, 8, 10] }
];

// KONFIGURASI DEFAULT KATEGORI
const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    key: 'pbb',
    title: 'Gerakan Dasar PBB',
    shortTitle: 'PBB',
    group: 'PBB & Variasi',
    maxPoints: 500,
    isMandatory: true,
    criteria: PBB_CRITERIA
  },
  {
    key: 'variasi',
    title: 'Gerakan Variasi',
    shortTitle: 'Variasi',
    group: 'PBB & Variasi',
    maxPoints: 84,
    isMandatory: true,
    criteria: VARIASI_CRITERIA
  },
  {
    key: 'formasi',
    title: 'Gerakan Formasi',
    shortTitle: 'Formasi',
    group: 'PBB & Variasi',
    maxPoints: 114,
    isMandatory: true,
    criteria: FORMASI_CRITERIA
  },
  {
    key: 'danton',
    title: 'Komandan Peleton (Danton)',
    shortTitle: 'Danton',
    group: 'PBB & Variasi',
    maxPoints: 50,
    isMandatory: true,
    criteria: DANTON_CRITERIA
  },
  {
    key: 'devile',
    title: 'Devile dan Uniform',
    shortTitle: 'Devile',
    group: 'Lantas & Lapangan',
    maxPoints: 60,
    isMandatory: true,
    criteria: DEVILE_CRITERIA
  },
  {
    key: 'gatur',
    title: 'Gatur Lantas',
    shortTitle: 'Gatur Lantas',
    group: 'Lantas & Lapangan',
    maxPoints: 150,
    isMandatory: true,
    criteria: GATUR_CRITERIA
  },
  {
    key: 'senam',
    title: 'Senam Lantas',
    shortTitle: 'Senam Lantas',
    group: 'Lantas & Lapangan',
    maxPoints: 60,
    isMandatory: true,
    criteria: SENAM_CRITERIA
  },
  {
    key: 'beladiri',
    title: 'Beladiri PKS / Polri',
    shortTitle: 'Beladiri',
    group: 'Lantas & Lapangan',
    maxPoints: 60,
    isMandatory: true,
    criteria: BELADIRI_CRITERIA
  },
  {
    key: 'yelyel',
    title: 'Yel-Yel Kreativitas',
    shortTitle: 'Yel-Yel',
    group: 'Kreasi & Khusus',
    maxPoints: 100,
    isMandatory: true,
    criteria: YELYEL_CRITERIA
  },
  {
    key: 'speaking',
    title: 'Public Speaking',
    shortTitle: 'Public Speaking',
    group: 'Kreasi & Khusus',
    maxPoints: 100,
    isMandatory: true,
    criteria: SPEAKING_CRITERIA
  },
  {
    key: 'tenda',
    title: 'Kelengkapan Tenda',
    shortTitle: 'Tenda',
    group: 'Kreasi & Khusus',
    maxPoints: 60,
    isMandatory: true,
    criteria: TENDA_CRITERIA
  }
];

// DEFAULT SYSTEM USERS
const DEFAULT_SYSTEM_USERS: AppUser[] = [
  { username: 'admin', password: 'admin123', name: 'Administrator Utama (Super Admin)', role: 'superadmin', isCustom: false },
  { username: 'administrator', password: 'administrator123', name: 'Administrator Utama (Super Admin)', role: 'superadmin', isCustom: false },
  { username: 'panitia', password: 'panitia123', name: 'Admin Panitia (Akses Terbatas)', role: 'admin', isCustom: false },
  { username: 'juri1', password: 'juri123', name: 'Aiptu Budi Santoso (Juri Lapangan)', role: 'juri', isCustom: false },
  { username: 'user1', password: 'user123', name: 'Kontingen / Tamu Resmi', role: 'user', isCustom: false }
];

const STORAGE_KEY = 'PBB_PKS_REKAP_APP_V4_DATA';
const CONFIG_STORAGE_KEY = 'PBB_PKS_CONFIG_V4_DATA';
const USERS_STORAGE_KEY = 'PBB_PKS_USERS_V4_DATA';
const AUTH_KEY = 'PBB_AUTH_CURRENT_USER';
const LOGO_STORAGE_KEY = 'PBB_PKS_APP_CUSTOM_LOGO';
const STATUS_STORAGE_KEY = 'PBB_PKS_APP_STATUS_V4';

const DEFAULT_APP_STATUS: AppStatusConfig = {
  id: 'app_status',
  isActive: true,
  title: 'Aplikasi Sedang Dinonaktifkan Sementara',
  message:
    'Sistem E-Rekapitulasi Lomba PBB & PKS sedang ditutup sementara oleh Panitia Pelaksana. Harap hubungi administrator untuk informasi lebih lanjut.',
  estimateTime: '',
  contactInfo: '',
  updatedAt: new Date().toISOString(),
  updatedBy: 'admin'
};

// CONTOH DATA AWAL PESERTA
const INITIAL_PESERTA: Participant[] = [
  {
    id: "p-01",
    nomor: "01",
    peleton: "Peleton Garuda Sakti",
    jenjang: "SLTP",
    sekolah: "SMPN 1 Majalengka",
    tanggal: "2026-03-20",
    juri: "Aiptu Budi Santoso (Juri Lapangan)",
    scores: {
      pbb: { 1:25, 2:26, 3:30, 4:28, 5:25, 6:30, 7:25, 8:25, 9:25, 10:25, 11:25, 12:25, 13:25, 14:25, 15:22, 16:30, 17:22, 18:20, 19:20, 20:22 },
      variasi: { 1:10, 2:10, 3:8, 4:10, 5:10, 6:12, 7:10, 8:12 },
      formasi: { 1:10, 2:10, 3:10, 4:10, 5:10, 6:12, 7:10, 8:10, 9:12, 10:10, 11:10 },
      danton: { 1:7, 2:7, 3:7, 4:7, 5:11, 6:11 },
      devile: { 1:10, 2:8, 3:10, 4:10, 5:8, 6:10, 7:10 },
      gatur: { 1:10, 2:10, 3:10, 4:10, 5:10, 6:10, 7:8, 8:10, 9:10, 10:8, 11:10, 12:10, 13:10, 14:10, 15:10 },
      senam: { 1:10, 2:10, 3:8, 4:10, 5:10, 6:10 },
      yelyel: { 1:25, 2:25, 3:20, 4:25 },
      beladiri: { 1:10, 2:8, 3:10, 4:10, 5:10, 6:8, 7:10, 8:8 },
      speaking: { 1:25, 2:20, 3:25, 4:20, 5:25 },
      tenda: { 1:10, 2:10, 3:8, 4:10, 5:10, 6:10 }
    }
  },
  {
    id: "p-02",
    nomor: "02",
    peleton: "", // Tidak mewajibkan nama regu
    jenjang: "SLTA",
    sekolah: "SMAN 1 Majalengka",
    tanggal: "2026-03-20",
    juri: "Aiptu Hendra Wijaya",
    scores: {
      pbb: { 1:20, 2:20, 3:24, 4:23, 5:20, 6:24, 7:20, 8:20, 9:20, 10:20, 11:20, 12:20, 13:20, 14:20, 15:18, 16:24, 17:18, 18:16, 19:16, 20:18 },
      variasi: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:10, 7:8, 8:10 },
      formasi: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:10, 7:8, 8:8, 9:10, 10:8, 11:8 },
      danton: { 1:6, 2:6, 3:6, 4:6, 5:9, 6:9 },
      devile: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:8, 7:8 },
      gatur: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:8, 7:8, 8:8, 9:8, 10:8, 11:8, 12:8, 13:8, 14:8, 15:8 },
      senam: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:8 },
      yelyel: { 1:20, 2:20, 3:20, 4:20 },
      beladiri: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:8, 7:8, 8:8 },
      speaking: { 1:20, 2:20, 3:20, 4:20, 5:20 },
      tenda: { 1:8, 2:8, 3:8, 4:8, 5:8, 6:8 }
    }
  }
];

// FUNGSI PERHITUNGAN NILAI OTOMATIS
export function calculateAllCategories(
  p: Participant | null | undefined,
  categories: CategoryConfig[]
): CalculatedScores | null {
  if (!p) return null;
  const sc = p.scores || ({} as ParticipantScores);

  const summaries = {} as Record<CategoryKey, CategorySummary>;
  let grandTotal = 0;
  let maxGrandTotal = 0;
  let completedCount = 0;
  let allMandatoryDone = true;

  categories.forEach(cat => {
    const catScores = sc[cat.key] || {};
    let sum = 0;
    let count = 0;

    cat.criteria.forEach(c => {
      if (catScores[c.no] !== undefined && catScores[c.no] !== null) {
        sum += Number(catScores[c.no]);
        count++;
      }
    });

    const cappedSum = Math.min(cat.maxPoints, sum);
    const isComplete = count === cat.criteria.length;
    const pct = cat.maxPoints > 0 ? (cappedSum / cat.maxPoints) * 100 : 0;

    summaries[cat.key] = {
      key: cat.key,
      title: cat.title,
      sum: cappedSum,
      maxPoints: cat.maxPoints,
      count,
      totalCriteria: cat.criteria.length,
      pct,
      isComplete,
      isMandatory: cat.isMandatory
    };

    grandTotal += cappedSum;
    maxGrandTotal += cat.maxPoints;

    if (isComplete) {
      completedCount++;
    } else if (cat.isMandatory) {
      allMandatoryDone = false;
    }
  });

  const grandPct = maxGrandTotal > 0 ? (grandTotal / maxGrandTotal) * 100 : 0;
  const isFullyCompleted = allMandatoryDone && completedCount === categories.length;

  return {
    categorySummaries: summaries,
    grandTotal,
    maxGrandTotal,
    grandPct,
    completedCategoriesCount: completedCount,
    totalCategoriesCount: categories.length,
    mandatoryCompleted: allMandatoryDone,
    isFullyCompleted
  };
}

export default function App() {
  // Authentication & User State
  const [usersList, setUsersList] = useState<AppUser[]>(() => {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed: AppUser[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some(u => u.username.toLowerCase() === 'administrator')) {
            parsed.push({
              username: 'administrator',
              password: 'administrator123',
              name: 'Administrator Utama (Super Admin)',
              role: 'superadmin',
              isCustom: false
            });
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_SYSTEM_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Role Access Hierarchy: Super Admin (Utama) vs Admin Panitia (Akses Terbatas) vs Juri vs Sekolah vs Tamu
  const isSuperAdmin = Boolean(
    currentUser &&
      (currentUser.role === 'superadmin' ||
        (currentUser.role === 'admin' &&
          (currentUser.username.toLowerCase() === 'admin' ||
            currentUser.username.toLowerCase() === 'administrator')))
  );
  const isAdminRole = Boolean(currentUser && (isSuperAdmin || currentUser.role === 'admin'));
  const isUserRole = Boolean(currentUser && currentUser.role === 'user');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStepText, setLoginStepText] = useState('Memverifikasi kredensial akun...');
  const [isRegisteringSchool, setIsRegisteringSchool] = useState(false);

  // Category Configuration
  const [categories, setCategories] = useState<CategoryConfig[]>(() => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORIES;
  });

  // Participant Data State
  const [pesertaList, setPesertaList] = useState<Participant[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.pesertaList)) return parsed.pesertaList;
      }
    } catch {
      // fallback
    }
    return INITIAL_PESERTA;
  });

  const [activePesertaId, setActivePesertaId] = useState<string | null>(() => {
    return pesertaList.length > 0 ? pesertaList[0].id : null;
  });

  // Active Navigation Tab: 'dashboard' | 'rekap' | CategoryKey
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [jenjangFilter, setJenjangFilter] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Rekapitulasi View Mode: 'umum' (Juara Umum) | 'kategori' (Per Kategori Lomba) | 'ringkasan' (Podium Semua Kategori)
  const [rekapViewMode, setRekapViewMode] = useState<'umum' | 'kategori' | 'ringkasan'>('umum');
  const [rekapSelectedCategoryKey, setRekapSelectedCategoryKey] = useState<CategoryKey>('pbb');

  // Dropdown Filter for Criteria in Assessment View
  const [criteriaFilter, setCriteriaFilter] = useState<'all' | 'unscored' | 'scored'>('all');

  // Modals
  const [modalPesertaOpen, setModalPesertaOpen] = useState(false);
  const [editingPesertaId, setEditingPesertaId] = useState<string | null>(null);
  const [pesertaFormData, setPesertaFormData] = useState<{
    nomor: string;
    peleton: string;
    jenjang: SchoolLevel;
    sekolah: string;
    tanggal: string;
    juri: string;
  }>({
    nomor: '',
    peleton: '',
    jenjang: 'SLTP',
    sekolah: '',
    tanggal: new Date().toISOString().split('T')[0],
    juri: ''
  });

  // User Management Modal State (Tambah User, Edit User & List User)
  const [modalUserOpen, setModalUserOpen] = useState(false);
  const [modalSchoolAccountsOpen, setModalSchoolAccountsOpen] = useState(false);
  const [userFormTab, setUserFormTab] = useState<'list' | 'add' | 'edit'>('list');
  const [editingUserOriginalUsername, setEditingUserOriginalUsername] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState<{
    username: string;
    password: string;
    name: string;
    role: UserRole;
    schoolName?: string;
    schoolLevel?: SchoolLevel;
    pembinaName?: string;
    contactWa?: string;
  }>({
    username: '',
    password: '',
    name: '',
    role: 'juri',
    schoolName: '',
    schoolLevel: 'SLTP',
    pembinaName: '',
    contactWa: ''
  });

  // Modal Pratinjau & Cetak Format Blanko Lembar Penilaian Juri
  const [modalBlankSheetOpen, setModalBlankSheetOpen] = useState(false);
  const [blankSheetCatKey, setBlankSheetCatKey] = useState<CategoryKey>('pbb');

  // Modal Daftar Nama Peserta & Sekolah (Siap Unduh & Cetak)
  const [modalDaftarPesertaOpen, setModalDaftarPesertaOpen] = useState(false);
  const [daftarPesertaFilterJenjang, setDaftarPesertaFilterJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [daftarPesertaSearch, setDaftarPesertaSearch] = useState('');

  const [modalPrintOpen, setModalPrintOpen] = useState(false);
  const [printPesertaId, setPrintPesertaId] = useState<string | null>(null);

  // Admin Category Config Modal
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
  const [tempCategoriesConfig, setTempCategoriesConfig] = useState<CategoryConfig[]>(categories);

  // Modal Upload & Scan Foto Form Penilaian (AI Gemini)
  const [modalScanOpen, setModalScanOpen] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanFileName, setScanFileName] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{
    detectedNomor?: string;
    detectedSekolah?: string;
    detectedJuri?: string;
    scores: Array<{ criterionNo: number; score: number; label: string; confidence?: string }>;
    notes?: string;
  } | null>(null);

  // Modal Lihat Bukti Foto Form Penilaian Juri
  const [modalViewPhotoOpen, setModalViewPhotoOpen] = useState(false);
  const [viewingPhotoData, setViewingPhotoData] = useState<{
    url: string;
    categoryTitle: string;
    participantName: string;
    participantNomor: string;
    uploadTime?: string;
    juriName?: string;
  } | null>(null);

  // Sidebar Navigation & Collapsible Dropdown Accordions
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarCatDropdownOpen, setSidebarCatDropdownOpen] = useState(false);
  const [sidebarPesertaDropdownOpen, setSidebarPesertaDropdownOpen] = useState(false);
  const [sidebarFormDropdownOpen, setSidebarFormDropdownOpen] = useState(false);
  const [sidebarRekapDropdownOpen, setSidebarRekapDropdownOpen] = useState(false);
  const [sidebarPesertaSearch, setSidebarPesertaSearch] = useState('');
  const [sidebarPesertaJenjang, setSidebarPesertaJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const sidebarNavRef = useRef<HTMLDivElement>(null);

  // Toggle one dropdown and auto-close others
  const toggleSidebarDropdown = (menu: 'cat' | 'peserta' | 'rekap' | 'form') => {
    setSidebarCatDropdownOpen(prev => (menu === 'cat' ? !prev : false));
    setSidebarPesertaDropdownOpen(prev => (menu === 'peserta' ? !prev : false));
    setSidebarRekapDropdownOpen(prev => (menu === 'rekap' ? !prev : false));
    setSidebarFormDropdownOpen(prev => (menu === 'form' ? !prev : false));
  };

  const closeAllSidebarDropdowns = () => {
    setSidebarCatDropdownOpen(false);
    setSidebarPesertaDropdownOpen(false);
    setSidebarRekapDropdownOpen(false);
    setSidebarFormDropdownOpen(false);
  };

  // Close dropdowns when clicking outside without selecting
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      if (sidebarNavRef.current && !sidebarNavRef.current.contains(e.target as Node)) {
        closeAllSidebarDropdowns();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, []);

  // Custom Application Logo State
  const [appLogo, setAppLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOGO_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [modalLogoOpen, setModalLogoOpen] = useState(false);
  const [tempLogoUrl, setTempLogoUrl] = useState('');

  // App Operational Status State (Aktivasi / Nonaktifkan Aplikasi dengan Kustom Teks)
  const [appStatus, setAppStatus] = useState<AppStatusConfig>(() => {
    try {
      const stored = localStorage.getItem(STATUS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.isActive === 'boolean') return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_APP_STATUS;
  });
  const [modalStatusOpen, setModalStatusOpen] = useState(false);

  // Payment Gateway & School Registration Submissions State
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [registrationsList, setRegistrationsList] = useState<RegistrationSubmission[]>([]);
  const [modalPaymentSettingsOpen, setModalPaymentSettingsOpen] = useState(false);

  // Blanko Template Customization State
  const [blankoConfig, setBlankoConfig] = useState<BlankoConfig>(DEFAULT_BLANKO_CONFIG);
  const [modalBlankoEditorOpen, setModalBlankoEditorOpen] = useState(false);

  // School Self-Registration State (Layar Login)
  const [authViewTab, setAuthViewTab] = useState<'login' | 'register_sekolah'>('login');
  const [regJenjang, setRegJenjang] = useState<SchoolLevel>('SLTP');
  const [regSekolah, setRegSekolah] = useState('');
  const [regPembina, setRegPembina] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');

  // Dashboard School Progress Filter States
  const [dashFilterJenjang, setDashFilterJenjang] = useState<'all' | 'SLTP' | 'SLTA'>('all');
  const [dashSearchSekolah, setDashSearchSekolah] = useState('');

  // State 4 Kerangka Form Pendaftaran Resmi PKS & Polisi Pelajar
  const [formPolisiPelajar, setFormPolisiPelajar] = useState({
    nama: 'Bintang Pratama',
    nisn: '0089123456',
    sekolah: 'SMP Negeri 1 Majalengka',
    jenjang: 'SLTP' as SchoolLevel,
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
    alasan: 'Ingin mengabdi dan menegakkan ketertiban dan keselamatan di lingkungan sekolah.'
  });

  const [formCalonPks, setFormCalonPks] = useState({
    nama: 'Aisyah Putri Rahmadani',
    nisn: '0078129845',
    sekolah: 'SMA Negeri 1 Majalengka',
    jenjang: 'SLTA' as SchoolLevel,
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

  const [formBalok1, setFormBalok1] = useState({
    namaRegu: 'Regu Elang Sakti',
    sekolah: 'SMP Negeri 1 Majalengka',
    jenjang: 'SLTP' as SchoolLevel,
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

  const [formBalok2, setFormBalok2] = useState({
    namaPeserta: 'Rizky Ramadhan',
    sekolah: 'SMA Negeri 1 Majalengka',
    jenjang: 'SLTA' as SchoolLevel,
    kelas: 'XI-IPS 1',
    noSertifikatBalok1: 'PKS-B1/POLRES-MJL/2025/084',
    tahunKelulusanBalok1: '2025',
    jabatanPleton: 'Komandan Pleton (Danton)',
    namaPembina: 'Iptu Agus Salim',
    materiUji: 'Penguasaan 12 Gerakan Gatur Lantas, PBB Tongkat, Senam Lantas, Bela Diri Praktis Polri',
    rekomendasiSatlantas: 'Memenuhi Syarat Kualifikasi Instruktur PKS Balok 2'
  });

  // Proteksi Hak Akses Akun Tamu: Hanya bisa melihat data mentah, otomatis dialihkan dari tab rekap
  useEffect(() => {
    if (currentUser?.role === 'user' && currentTab === 'rekap') {
      setCurrentTab('dashboard');
    }
  }, [currentUser, currentTab]);

  // In-app Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Konfirmasi',
    isDanger: false
  });

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud Firestore Sync State
  const [cloudStatus, setCloudStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [cloudLastSynced, setCloudLastSynced] = useState<Date | null>(null);
  const [modalCloudInfoOpen, setModalCloudInfoOpen] = useState(false);
  const isInitialCloudSyncDone = useRef(false);

  // Real-time Cloud Listeners & Auto-Sync
  useEffect(() => {
    let unsubParticipants: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubConfig: (() => void) | undefined;
    let unsubLogo: (() => void) | undefined;
    let unsubStatus: (() => void) | undefined;
    let unsubPayment: (() => void) | undefined;
    let unsubRegistrations: (() => void) | undefined;
    let unsubBlanko: (() => void) | undefined;

    const initCloud = async () => {
      try {
        const isOk = await testConnection();
        if (isOk) {
          setCloudStatus('connected');
          setCloudLastSynced(new Date());
        } else {
          setCloudStatus('offline');
        }

        // 1. Subscribe to Participants
        unsubParticipants = subscribeToParticipants(
          cloudPeserta => {
            setCloudStatus('connected');
            setCloudLastSynced(new Date());
            if (cloudPeserta && cloudPeserta.length > 0) {
              setPesertaList(cloudPeserta);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList: cloudPeserta }));
              } catch {
                // ignore
              }
            } else if (!isInitialCloudSyncDone.current && pesertaList.length > 0) {
              // Seed cloud if cloud is newly created & empty
              pesertaList.forEach(p => saveParticipantToCloud(p));
            }
          },
          err => {
            console.error('Cloud participants sync error:', err);
            setCloudStatus('error');
          }
        );

        // 2. Subscribe to Users
        unsubUsers = subscribeToUsers(
          cloudUsers => {
            setCloudStatus('connected');
            setCloudLastSynced(new Date());
            if (cloudUsers && cloudUsers.length > 0) {
              const hasAdministrator = cloudUsers.some(u => u.username?.toLowerCase() === 'administrator');
              if (!hasAdministrator) {
                const adminAccount: AppUser = {
                  username: 'administrator',
                  password: 'administrator123',
                  name: 'Administrator Utama (Super Admin)',
                  role: 'superadmin',
                  isCustom: false
                };
                saveUserToCloud(adminAccount);
                cloudUsers = [...cloudUsers, adminAccount];
              }
              setUsersList(cloudUsers);
              try {
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(cloudUsers));
              } catch {
                // ignore
              }
            } else if (!isInitialCloudSyncDone.current && usersList.length > 0) {
              // Seed cloud users
              usersList.forEach(u => saveUserToCloud(u));
            }
          },
          err => {
            console.error('Cloud users sync error:', err);
            setCloudStatus('error');
          }
        );

        // 3. Subscribe to Config
        unsubConfig = subscribeToConfig(
          cloudConfig => {
            if (cloudConfig && Array.isArray(cloudConfig) && cloudConfig.length > 0) {
              setCategories(cloudConfig);
              try {
                localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cloudConfig));
              } catch {
                // ignore
              }
            } else if (!isInitialCloudSyncDone.current && categories.length > 0) {
              saveConfigToCloud(categories);
            }
          },
          err => console.error('Cloud config sync error:', err)
        );

        // 4. Subscribe to Logo
        unsubLogo = subscribeToLogo(
          cloudLogo => {
            if (cloudLogo) {
              setAppLogo(cloudLogo);
              try {
                localStorage.setItem(LOGO_STORAGE_KEY, cloudLogo);
              } catch {
                // ignore
              }
            }
          },
          err => console.error('Cloud logo sync error:', err)
        );

        // 5. Subscribe to App Status (Aktif / Nonaktif dengan Kustom Teks)
        unsubStatus = subscribeToAppStatus(
          cloudStatusConfig => {
            if (cloudStatusConfig) {
              setAppStatus(cloudStatusConfig);
              try {
                localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(cloudStatusConfig));
              } catch {
                // ignore
              }
            } else if (!isInitialCloudSyncDone.current) {
              saveAppStatusToCloud(appStatus);
            }
          },
          err => console.error('Cloud app status sync error:', err)
        );

        // 6. Subscribe to Payment Configuration & Gateways
        unsubPayment = subscribeToPaymentConfig(
          cloudPaymentConfig => {
            if (cloudPaymentConfig) {
              setPaymentConfig(cloudPaymentConfig);
            }
          },
          err => console.error('Cloud payment config sync error:', err)
        );

        // 7. Subscribe to School Registration Submissions
        unsubRegistrations = subscribeToRegistrations(
          cloudSubmissions => {
            if (cloudSubmissions) {
              setRegistrationsList(cloudSubmissions);
            }
          },
          err => console.error('Cloud registrations sync error:', err)
        );

        // 8. Subscribe to Blanko Template Customization
        unsubBlanko = subscribeToBlankoConfig(
          cloudBlanko => {
            if (cloudBlanko) {
              setBlankoConfig(cloudBlanko);
            }
          },
          err => console.error('Cloud blanko config sync error:', err)
        );

        isInitialCloudSyncDone.current = true;
      } catch (err) {
        console.error('Cloud initialization failed:', err);
        setCloudStatus('offline');
      }
    };

    initCloud();

    return () => {
      if (unsubParticipants) unsubParticipants();
      if (unsubUsers) unsubUsers();
      if (unsubConfig) unsubConfig();
      if (unsubLogo) unsubLogo();
      if (unsubStatus) unsubStatus();
      if (unsubPayment) unsubPayment();
      if (unsubRegistrations) unsubRegistrations();
      if (unsubBlanko) unsubBlanko();
    };
  }, []);

  // Manual Force Push to Cloud
  const handleForceSyncAll = async () => {
    setCloudStatus('connecting');
    try {
      for (const p of pesertaList) {
        await saveParticipantToCloud(p);
      }
      for (const u of usersList) {
        await saveUserToCloud(u);
      }
      await saveConfigToCloud(categories);
      if (appLogo) {
        await saveLogoToCloud(appLogo);
      }
      await saveAppStatusToCloud(appStatus);
      setCloudStatus('connected');
      setCloudLastSynced(new Date());
    } catch (e) {
      console.error('Force sync error:', e);
      setCloudStatus('error');
      throw e;
    }
  };

  // Save App Status to Cloud & Local
  const handleSaveAppStatus = async (newStatus: AppStatusConfig) => {
    setAppStatus(newStatus);
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(newStatus));
    } catch (e) {
      console.error('Storage error', e);
    }
    await saveAppStatusToCloud(newStatus);
  };

  // Save Users Data (Local Backup)
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersList));
    } catch (e) {
      console.error("Gagal menyimpan users ke localStorage", e);
    }
  }, [usersList]);

  // Save Participant Data (Local Backup)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList }));
    } catch (e) {
      console.error("Gagal menyimpan data ke localStorage", e);
    }
  }, [pesertaList]);

  // Save Categories Config (Local Backup)
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {
      console.error("Gagal menyimpan config ke localStorage", e);
    }
  }, [categories]);

  // Ensure activePesertaId is valid
  useEffect(() => {
    if (pesertaList.length > 0) {
      if (!activePesertaId || !pesertaList.some(p => p.id === activePesertaId)) {
        setActivePesertaId(pesertaList[0].id);
      }
    } else {
      setActivePesertaId(null);
    }
  }, [pesertaList, activePesertaId]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 2800);
  };

  // Auth Handlers
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const uname = loginUsername.trim().toLowerCase();
    const pwd = loginPassword;

    setIsLoggingIn(true);
    setLoginStepText('Memverifikasi kredensial akun...');
    setLoginError(false);

    // Animasi bertahap untuk verifikasi akun dan inisialisasi sesi
    setTimeout(() => {
      const found = usersList.find(
        u => u.username.toLowerCase() === uname && u.password === pwd
      );

      if (found) {
        const isSuper =
          found.role === 'superadmin' ||
          found.username.toLowerCase() === 'admin' ||
          found.username.toLowerCase() === 'administrator';
        const roleLabel = isSuper
          ? 'Administrator Utama'
          : found.role === 'admin'
          ? 'Admin Panitia'
          : found.role === 'juri'
          ? 'Juri Lapangan'
          : found.role === 'sekolah'
          ? 'Perwakilan Sekolah'
          : 'Tamu / Peninjau';

        setLoginStepText(`Kredensial cocok! Menyiapkan sesi ${roleLabel}...`);

        setTimeout(() => {
          setIsLoggingIn(false);
          setCurrentUser(found);
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(found));
          showToast(`Selamat datang, ${found.name}!`);
        }, 550);
      } else {
        setIsLoggingIn(false);
        setLoginError(true);
      }
    }, 450);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(AUTH_KEY);
    showToast('Berhasil keluar dari akun.', 'info');
  };

  // School Self-Registration Handler
  const handleRegisterSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisteringSchool) return;
    setRegError('');

    if (!regSekolah.trim()) {
      setRegError('Nama lengkap sekolah wajib diisi!');
      return;
    }
    if (!regUsername.trim()) {
      setRegError('Username wajib diisi!');
      return;
    }
    if (regPassword.length < 4) {
      setRegError('Password minimal 4 karakter!');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Konfirmasi password tidak sesuai!');
      return;
    }

    const usernameLower = regUsername.trim().toLowerCase();
    if (usersList.some(u => u.username.toLowerCase() === usernameLower)) {
      setRegError(`Username "${regUsername}" sudah digunakan oleh akun lain. Silakan pilih username lain.`);
      return;
    }

    setIsRegisteringSchool(true);

    setTimeout(() => {
      const newSchoolUser: AppUser = {
        username: usernameLower,
        password: regPassword,
        name: `${regSekolah.trim()}`,
        role: 'sekolah',
        schoolName: regSekolah.trim(),
        schoolLevel: regJenjang,
        pembinaName: regPembina.trim(),
        contactWa: regWa.trim(),
        isCustom: true
      };

      const updatedUsers = [...usersList, newSchoolUser];
      setUsersList(updatedUsers);
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
      } catch {
        // ignore
      }
      // Sync new school user to Cloud
      saveUserToCloud(newSchoolUser);

      // Auto-create or link a participant profile for this school
      const schoolExists = pesertaList.some(
        p => p.sekolah.toLowerCase().trim() === regSekolah.trim().toLowerCase()
      );
      if (!schoolExists) {
        const nextNomor = String(pesertaList.length + 1).padStart(2, '0');
        const newParticipant: Participant = {
          id: `p-${Date.now()}`,
          nomor: nextNomor,
          peleton: `Peleton ${regSekolah.trim()}`,
          jenjang: regJenjang,
          sekolah: regSekolah.trim(),
          tanggal: new Date().toISOString().split('T')[0],
          juri: 'Belum Ditentukan',
          scores: {
            pbb: {}, variasi: {}, formasi: {}, danton: {},
            devile: {}, gatur: {}, senam: {}, yelyel: {},
            beladiri: {}, speaking: {}, tenda: {}
          }
        };
        const updatedPeserta = [...pesertaList, newParticipant];
        setPesertaList(updatedPeserta);
        setActivePesertaId(newParticipant.id);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList: updatedPeserta, history: [] }));
        } catch {
          // ignore
        }
        // Sync initial participant to Cloud
        saveParticipantToCloud(newParticipant);
      }

      setIsRegisteringSchool(false);
      setCurrentUser(newSchoolUser);
      try {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(newSchoolUser));
      } catch {
        // ignore
      }
      showToast(`Registrasi Akun Sekolah ${regSekolah} berhasil! Selamat datang.`, 'success');
    }, 600);
  };

  // Logo Handlers (Super Admin Only)
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama yang berhak mengubah logo aplikasi!', 'error');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih file gambar (PNG, JPG, SVG, atau WebP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAppLogo(dataUrl);
      try {
        localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
      } catch (err) {
        console.error('Storage error', err);
      }
      saveLogoToCloud(dataUrl);
      showToast('Logo aplikasi berhasil diperbarui!', 'success');
      setModalLogoOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama yang berhak mereset logo!', 'error');
      return;
    }
    setAppLogo(null);
    try {
      localStorage.removeItem(LOGO_STORAGE_KEY);
    } catch {
      // ignore
    }
    saveLogoToCloud(null);
    showToast('Logo dikembalikan ke lambang default PKS.', 'info');
    setModalLogoOpen(false);
  };

  const handleSaveLogoUrl = (customLogo?: string) => {
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama yang berhak mengubah logo aplikasi!', 'error');
      return;
    }
    const logoToSave = customLogo || tempLogoUrl.trim();
    if (!logoToSave) return;
    setAppLogo(logoToSave);
    try {
      localStorage.setItem(LOGO_STORAGE_KEY, logoToSave);
    } catch {
      // ignore
    }
    saveLogoToCloud(logoToSave);
    showToast('Logo aplikasi berhasil diperbarui!', 'success');
    setTempLogoUrl('');
    setModalLogoOpen(false);
  };

  // Export 4 Registration Forms to Excel (.xlsx)
  const handleExportFormPolisiPelajarExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['FORMULIR PENDAFTARAN RESMI POLISI PELAJAR (POLJAR) TAHUN 2026'],
      ['DINAS PENDIDIKAN & KEBUDAYAAN KABUPATEN BEKERJASAMA DENGAN SATLANTAS POLRES'],
      [''],
      ['A. IDENTITAS PRIBADI SISWA'],
      ['1. Nama Lengkap', formPolisiPelajar.nama],
      ['2. NISN', formPolisiPelajar.nisn],
      ['3. Asal Sekolah', formPolisiPelajar.sekolah],
      ['4. Jenjang / Tingkat', formPolisiPelajar.jenjang],
      ['5. Kelas', formPolisiPelajar.kelas],
      ['6. Tempat, Tanggal Lahir', formPolisiPelajar.ttl],
      ['7. Jenis Kelamin', formPolisiPelajar.jk],
      ['8. Agama', formPolisiPelajar.agama],
      ['9. Alamat Lengkap Siswa', formPolisiPelajar.alamat],
      ['10. No. Handphone / WhatsApp', formPolisiPelajar.noHp],
      ['11. Nama Orang Tua / Wali', formPolisiPelajar.namaOrtu],
      ['12. Pekerjaan Orang Tua', formPolisiPelajar.pekerjaanOrtu],
      [''],
      ['B. DATA FISIK & KESEHATAN'],
      ['1. Tinggi Badan (cm)', formPolisiPelajar.tinggiBadan],
      ['2. Berat Badan (kg)', formPolisiPelajar.beratBadan],
      ['3. Golongan Darah', formPolisiPelajar.golDarah],
      ['4. Riwayat Penyakit / Alergi', formPolisiPelajar.riwayatPenyakit],
      [''],
      ['C. MOTIVASI & PRESTASI'],
      ['1. Prestasi yang Pernah Diraih', formPolisiPelajar.prestasi],
      ['2. Alasan Mengikuti Poljar', formPolisiPelajar.alasan],
      [''],
      ['Mengetahui,', '', 'Majalengka, ' + new Date().toLocaleDateString('id-ID')],
      ['Orang Tua / Wali Siswa', '', 'Calon Siswa Polisi Pelajar'],
      [''],
      [''],
      [`(${formPolisiPelajar.namaOrtu})`, '', `(${formPolisiPelajar.nama})`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftaran_Poljar');
    XLSX.writeFile(wb, `Form_Pendaftaran_Polisi_Pelajar_${formPolisiPelajar.nama.replace(/\s+/g, '_')}.xlsx`);
    showToast('Form Pendaftaran Polisi Pelajar berhasil diunduh (.xlsx)', 'success');
  };

  const handleExportFormCalonPksExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['FORMULIR PENDAFTARAN CALON ANGGOTA PATROLI KEAMANAN SEKOLAH (PKS)'],
      ['KORPS PKS TINGKAT SLTP & SLTA TAHUN AJARAN 2026/2027'],
      [''],
      ['A. IDENTITAS CALON ANGGOTA'],
      ['1. Nama Lengkap', formCalonPks.nama],
      ['2. NISN', formCalonPks.nisn],
      ['3. Pangkalan Sekolah', formCalonPks.sekolah],
      ['4. Jenjang', formCalonPks.jenjang],
      ['5. Kelas', formCalonPks.kelas],
      ['6. Tempat, Tanggal Lahir', formCalonPks.ttl],
      ['7. Jenis Kelamin', formCalonPks.jk],
      ['8. Agama', formCalonPks.agama],
      ['9. Alamat Lengkap', formCalonPks.alamat],
      ['10. No. Handphone', formCalonPks.noHp],
      ['11. Pembina PKS Sekolah', formCalonPks.namaPembina],
      ['12. Pilihan Divisi Peminatan', formCalonPks.divisiMinat],
      [''],
      ['B. FISIK & PENGALAMAN'],
      ['1. Tinggi / Berat Badan', `${formCalonPks.tinggiBadan} cm / ${formCalonPks.beratBadan} kg`],
      ['2. Golongan Darah', formCalonPks.golDarah],
      ['3. Riwayat Organisasi', formCalonPks.riwayatOrganisasi],
      ['4. Izin Orang Tua', formCalonPks.izinOrtu ? 'Sudah Mendapatkan Izin' : 'Belum'],
      [''],
      ['Mengetahui,', '', 'Majalengka, ' + new Date().toLocaleDateString('id-ID')],
      ['Pembina PKS Sekolah', '', 'Calon Anggota PKS'],
      [''],
      [''],
      [`(${formCalonPks.namaPembina})`, '', `(${formCalonPks.nama})`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftaran_PKS');
    XLSX.writeFile(wb, `Form_Calon_Anggota_PKS_${formCalonPks.nama.replace(/\s+/g, '_')}.xlsx`);
    showToast('Form Pendaftaran Calon PKS berhasil diunduh (.xlsx)', 'success');
  };

  const handleExportFormBalok1Excel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['FORMULIR PENDAFTARAN PERKEMAHAN PELANTIKAN PKS TINGKAT DASAR (BALOK 1)'],
      ['DIKLAT DASAR KEPEMIMPINAN DAN KELALULINTASAN PELAJAR TAHUN 2026'],
      [''],
      ['A. DATA REGU / KONTINGEN SEKOLAH'],
      ['1. Nama Regu / Peleton', formBalok1.namaRegu],
      ['2. Pangkalan Sekolah', formBalok1.sekolah],
      ['3. Tingkat / Jenjang', formBalok1.jenjang],
      ['4. Nama Ketua Regu', formBalok1.namaKetua],
      ['5. Jumlah Anggota Regu', formBalok1.jumlahAnggota],
      ['6. Pembina Pendamping', formBalok1.namaPembina],
      ['7. No. Kontak Pembina', formBalok1.noHpPembina],
      [''],
      ['B. DETAIL KEGIATAN PERKEMAHAN'],
      ['1. Tingkat Pelantikan', formBalok1.kategoriKemah],
      ['2. Lokasi Perkemahan', formBalok1.lokasiPerkemahan],
      ['3. Waktu Pelaksanaan', formBalok1.tanggalKegiatan],
      ['4. Status Kesehatan Regu', formBalok1.statusKesehatan],
      ['5. Surat Rekomendasi Kepala Sekolah', formBalok1.suratIzinKepsek],
      [''],
      ['Mengetahui,', '', 'Didaftarkan Oleh,'],
      ['Kepala Sekolah / Pangkalan', '', 'Pembina Pendamping PKS'],
      [''],
      [''],
      ['(....................................)', '', `(${formBalok1.namaPembina})`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Perkemahan_Balok1');
    XLSX.writeFile(wb, `Form_Perkemahan_Balok1_${formBalok1.sekolah.replace(/\s+/g, '_')}.xlsx`);
    showToast('Form Perkemahan PKS Balok 1 berhasil diunduh (.xlsx)', 'success');
  };

  const handleExportFormBalok2Excel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['FORMULIR PENDAFTARAN PERKEMAHAN TINGKAT LANJUTAN (BALOK 2)'],
      ['DIKLAT KEPEMIMPINAN KOMANDAN REGU & INSTRUKTUR PKS TAHUN 2026'],
      [''],
      ['A. DATA CALON KADER BALOK 2'],
      ['1. Nama Lengkap Peserta', formBalok2.namaPeserta],
      ['2. Pangkalan Sekolah', formBalok2.sekolah],
      ['3. Jenjang / Tingkat', formBalok2.jenjang],
      ['4. Kelas', formBalok2.kelas],
      ['5. No. Sertifikat Balok 1', formBalok2.noSertifikatBalok1],
      ['6. Tahun Kelulusan Balok 1', formBalok2.tahunKelulusanBalok1],
      ['7. Jabatan Saat Ini', formBalok2.jabatanPleton],
      ['8. Pembina Rekomendasi', formBalok2.namaPembina],
      [''],
      ['B. MATERI UJI KOMPETENSI PRASYARAT'],
      ['1. Materi Pengujian', formBalok2.materiUji],
      ['2. Rekomendasi Satlantas/Polres', formBalok2.rekomendasiSatlantas],
      [''],
      ['Mengetahui,', '', 'Pemohon Calon Balok 2,'],
      ['Instruktur Satlantas / Pembina', '', 'Peserta Diklat Lanjutan'],
      [''],
      [''],
      [`(${formBalok2.namaPembina})`, '', `(${formBalok2.namaPeserta})`]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftaran_Balok2');
    XLSX.writeFile(wb, `Form_Pendaftaran_PKS_Balok2_${formBalok2.namaPeserta.replace(/\s+/g, '_')}.xlsx`);
    showToast('Form Pendaftaran PKS Balok 2 berhasil diunduh (.xlsx)', 'success');
  };

  // User Management Handlers (Admin Only)
  const handleStartEditUser = (u: AppUser) => {
    const isTargetSuper = u.role === 'superadmin' || u.username === 'admin' || u.username === 'administrator';
    if (!isSuperAdmin && isTargetSuper) {
      showToast('Admin terbatas tidak diizinkan mengubah akun Administrator Utama!', 'error');
      return;
    }
    setEditingUserOriginalUsername(u.username);
    setUserFormData({
      username: u.username,
      password: u.password || '',
      name: u.name,
      role: u.role,
      schoolName: u.schoolName || (u.role === 'sekolah' ? u.name : ''),
      schoolLevel: u.schoolLevel || 'SLTP',
      pembinaName: u.pembinaName || '',
      contactWa: u.contactWa || ''
    });
    setUserFormTab('edit');
  };

  const handleCancelEditUser = () => {
    setEditingUserOriginalUsername(null);
    setUserFormData({
      username: '',
      password: '',
      name: '',
      role: 'juri',
      schoolName: '',
      schoolLevel: 'SLTP',
      pembinaName: '',
      contactWa: ''
    });
    setUserFormTab('list');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserOriginalUsername) return;

    const uname = userFormData.username.trim().toLowerCase().replace(/\s+/g, '');
    const pwd = userFormData.password.trim();
    const dname = userFormData.name.trim();

    if (!uname || !dname) {
      showToast('Username dan Nama Lengkap wajib diisi!', 'error');
      return;
    }

    // Periksa jika username diubah dan apakah bentrok dengan user lain
    if (
      uname !== editingUserOriginalUsername.toLowerCase() &&
      usersList.some(u => u.username.toLowerCase() === uname)
    ) {
      showToast(`Username "${uname}" sudah digunakan akun lain!`, 'error');
      return;
    }

    const originalUser = usersList.find(u => u.username === editingUserOriginalUsername);
    const finalPassword = pwd || originalUser?.password || '123456';
    const isTargetSuper = originalUser?.role === 'superadmin' || originalUser?.username === 'admin' || originalUser?.username === 'administrator';

    let finalRole: UserRole = userFormData.role;
    if (isTargetSuper) {
      finalRole = originalUser?.role || 'superadmin';
    } else if (!isSuperAdmin && userFormData.role === 'superadmin') {
      finalRole = originalUser?.role || 'admin';
    }

    const updatedUser: AppUser = {
      username: uname,
      password: finalPassword,
      name: dname,
      role: finalRole,
      isCustom: originalUser?.isCustom ?? true,
      schoolName: finalRole === 'sekolah' ? (userFormData.schoolName?.trim() || dname) : (originalUser?.schoolName || ''),
      schoolLevel: finalRole === 'sekolah' ? (userFormData.schoolLevel || 'SLTP') : (originalUser?.schoolLevel || 'SLTP'),
      pembinaName: finalRole === 'sekolah' ? (userFormData.pembinaName?.trim() || '') : (originalUser?.pembinaName || ''),
      contactWa: finalRole === 'sekolah' ? (userFormData.contactWa?.trim() || '') : (originalUser?.contactWa || '')
    };

    const newUsersList = usersList.map(u => (u.username === editingUserOriginalUsername ? updatedUser : u));
    setUsersList(newUsersList);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(newUsersList));
    } catch {
      // ignore
    }

    // Jika username berubah, hapus dokumen lama di cloud
    if (uname !== editingUserOriginalUsername.toLowerCase()) {
      deleteUserFromCloud(editingUserOriginalUsername);
    }
    const syncRes = await saveUserToCloud(updatedUser);
    if (syncRes.success) {
      setCloudLastSynced(new Date());
    }

    // Jika akun yang sedang login saat ini diubah, sinkronkan ke currentUser dan sessionStorage
    if (currentUser && currentUser.username === editingUserOriginalUsername) {
      setCurrentUser(updatedUser);
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
    }

    setEditingUserOriginalUsername(null);
    setUserFormData({
      username: '',
      password: '',
      name: '',
      role: 'juri',
      schoolName: '',
      schoolLevel: 'SLTP',
      pembinaName: '',
      contactWa: ''
    });
    setUserFormTab('list');
    showToast(`Akun "${dname}" berhasil diperbarui & tersinkron ke Cloud!`, 'success');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = userFormData.username.trim().toLowerCase().replace(/\s+/g, '');
    const pwd = userFormData.password.trim();
    const dname = userFormData.name.trim();

    if (!uname || !pwd || !dname) {
      showToast('Seluruh kolom data pengguna wajib diisi!', 'error');
      return;
    }

    if (usersList.some(u => u.username.toLowerCase() === uname)) {
      showToast(`Username "${uname}" sudah digunakan! Silakan pilih username lain.`, 'error');
      return;
    }

    const requestedRole: UserRole = (!isSuperAdmin && userFormData.role === 'superadmin') ? 'admin' : userFormData.role;

    const newUser: AppUser = {
      username: uname,
      password: pwd,
      name: dname,
      role: requestedRole,
      isCustom: true,
      schoolName: requestedRole === 'sekolah' ? (userFormData.schoolName?.trim() || dname) : '',
      schoolLevel: requestedRole === 'sekolah' ? (userFormData.schoolLevel || 'SLTP') : 'SLTP',
      pembinaName: requestedRole === 'sekolah' ? (userFormData.pembinaName?.trim() || '') : '',
      contactWa: requestedRole === 'sekolah' ? (userFormData.contactWa?.trim() || '') : ''
    };

    const newUsersList = [...usersList, newUser];
    setUsersList(newUsersList);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(newUsersList));
    } catch {
      // ignore
    }

    const syncRes = await saveUserToCloud(newUser);
    if (syncRes.success) {
      setCloudLastSynced(new Date());
      showToast(`Pengguna baru "${dname}" (${newUser.role.toUpperCase()}) berhasil dibuat & tersinkron ke Cloud!`, 'success');
    } else {
      showToast(`Pengguna dibuat lokal. Sinkron Cloud: ${syncRes.error || 'cek koneksi'}`, 'info');
    }

    setUserFormData({
      username: '',
      password: '',
      name: '',
      role: 'juri',
      schoolName: '',
      schoolLevel: 'SLTP',
      pembinaName: '',
      contactWa: ''
    });
    setUserFormTab('list');
  };

  const handleDeleteUser = (usernameToDelete: string) => {
    if (currentUser && currentUser.username === usernameToDelete) {
      showToast('Tidak dapat menghapus akun yang sedang Anda gunakan!', 'error');
      return;
    }
    const target = usersList.find(u => u.username === usernameToDelete);
    const isTargetSuper = target ? (target.role === 'superadmin' || target.username === 'admin' || target.username === 'administrator') : (usernameToDelete === 'admin' || usernameToDelete === 'administrator');
    if (isTargetSuper) {
      showToast('Akun Administrator Utama tidak dapat dihapus!', 'error');
      return;
    }
    if (!isSuperAdmin && target && target.role === 'admin') {
      showToast('Admin terbatas tidak memiliki wewenang menghapus akun admin lain!', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Akun Pengguna?',
      message: `Yakin ingin menghapus akun pengguna "${usernameToDelete}"? Pengguna ini tidak akan bisa login lagi.`,
      confirmText: 'Hapus Pengguna',
      isDanger: true,
      onConfirm: async () => {
        const filtered = usersList.filter(u => u.username !== usernameToDelete);
        setUsersList(filtered);
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
        } catch {
          // ignore
        }
        await deleteUserFromCloud(usernameToDelete);
        setCloudLastSynced(new Date());
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Akun pengguna berhasil dihapus dari Cloud & lokal.', 'info');
      }
    });
  };

  const activePeserta = useMemo(() => {
    return pesertaList.find(p => p.id === activePesertaId) || null;
  }, [pesertaList, activePesertaId]);

  const activeCalc = useMemo(() => {
    return calculateAllCategories(activePeserta, categories);
  }, [activePeserta, categories]);

  // Active Category (if current tab is one of the category keys)
  const activeCategory = useMemo(() => {
    return categories.find(c => c.key === currentTab) || null;
  }, [categories, currentTab]);

  // Live Map of Participant Totals & Completed Categories for Sidebar Badges
  const pesertaSummariesMap = useMemo(() => {
    const map: Record<string, { totalPoints: number; isComplete: boolean; completedCats: number }> = {};
    pesertaList.forEach(p => {
      const calc = calculateAllCategories(p, categories);
      map[p.id] = {
        totalPoints: calc ? calc.grandTotal : 0,
        isComplete: calc ? calc.isFullyCompleted : false,
        completedCats: calc ? calc.completedCategoriesCount : 0
      };
    });
    return map;
  }, [pesertaList, categories]);

  // Filtered Participants specifically for Sidebar Dropdown
  const filteredSidebarPeserta = useMemo(() => {
    return pesertaList.filter(p => {
      const matchSchool =
        currentUser?.role === 'sekolah' && currentUser.schoolName
          ? p.sekolah.toLowerCase().trim() === currentUser.schoolName.toLowerCase().trim()
          : true;

      const matchSearch =
        sidebarPesertaSearch.trim() === '' ||
        p.nomor.toLowerCase().includes(sidebarPesertaSearch.toLowerCase()) ||
        p.sekolah.toLowerCase().includes(sidebarPesertaSearch.toLowerCase()) ||
        (p.peleton && p.peleton.toLowerCase().includes(sidebarPesertaSearch.toLowerCase()));

      const matchJenjang =
        sidebarPesertaJenjang === 'all' || p.jenjang === sidebarPesertaJenjang;

      return matchSchool && matchSearch && matchJenjang;
    });
  }, [pesertaList, sidebarPesertaSearch, sidebarPesertaJenjang, currentUser]);

  // Calculation of School Assessment Progress for the Dashboard Chart
  const dashboardProgressStats = useMemo(() => {
    const list = pesertaList.filter(p => {
      const matchSchool =
        currentUser?.role === 'sekolah' && currentUser.schoolName
          ? p.sekolah.toLowerCase().trim() === currentUser.schoolName.toLowerCase().trim()
          : true;
      const matchJenjang = dashFilterJenjang === 'all' || p.jenjang === dashFilterJenjang;
      const matchSearch = dashSearchSekolah.trim() === '' ||
        p.sekolah.toLowerCase().includes(dashSearchSekolah.toLowerCase()) ||
        (p.peleton && p.peleton.toLowerCase().includes(dashSearchSekolah.toLowerCase()));
      return matchSchool && matchJenjang && matchSearch;
    });

    const totalRegistered = list.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let unscoredCount = 0;
    let totalCompletedCats = 0;

    const schoolProgressList = list.map(p => {
      const calc = calculateAllCategories(p, categories);
      const isComplete = calc ? calc.isFullyCompleted : false;
      const completedCats = calc ? calc.completedCategoriesCount : 0;
      const grandTotal = calc ? calc.grandTotal : 0;
      const maxGrandTotal = calc ? calc.maxGrandTotal : 0;
      const pct = maxGrandTotal > 0 ? (grandTotal / maxGrandTotal) * 100 : 0;

      totalCompletedCats += completedCats;
      if (isComplete) {
        completedCount++;
      } else if (completedCats > 0) {
        inProgressCount++;
      } else {
        unscoredCount++;
      }

      return {
        participant: p,
        calc,
        isComplete,
        completedCats,
        grandTotal,
        maxGrandTotal,
        pct
      };
    });

    const completionRate = totalRegistered > 0 ? Math.round((completedCount / totalRegistered) * 100) : 0;
    const avgCompletedCats = totalRegistered > 0 ? (totalCompletedCats / totalRegistered) : 0;

    return {
      totalRegistered,
      completedCount,
      inProgressCount,
      unscoredCount,
      completionRate,
      avgCompletedCats,
      schoolProgressList
    };
  }, [pesertaList, categories, dashFilterJenjang, dashSearchSekolah, currentUser]);

  // Quick navigation to previous / next participant
  const handlePrevPeserta = () => {
    if (pesertaList.length === 0) return;
    const currentIndex = pesertaList.findIndex(p => p.id === activePesertaId);
    if (currentIndex > 0) {
      setActivePesertaId(pesertaList[currentIndex - 1].id);
    } else {
      setActivePesertaId(pesertaList[pesertaList.length - 1].id);
    }
  };

  const handleNextPeserta = () => {
    if (pesertaList.length === 0) return;
    const currentIndex = pesertaList.findIndex(p => p.id === activePesertaId);
    if (currentIndex >= 0 && currentIndex < pesertaList.length - 1) {
      setActivePesertaId(pesertaList[currentIndex + 1].id);
    } else {
      setActivePesertaId(pesertaList[0].id);
    }
  };

  // Handle Score Selection
  const handleScoreSelect = (categoryKey: CategoryKey, criterionNo: number, val: number | null) => {
    if (!currentUser || currentUser.role === 'user' || currentUser.role === 'sekolah') {
      showToast('Akses ditolak: Penginputan nilai hanya dapat dilakukan oleh Panitia / Juri!', 'error');
      return;
    }
    if (!activePesertaId) return;

    setPesertaList(prev =>
      prev.map(p => {
        if (p.id !== activePesertaId) return p;
        const currentCatScores = { ...(p.scores[categoryKey] || {}) };
        if (val === null) {
          delete currentCatScores[criterionNo];
        } else {
          currentCatScores[criterionNo] = val;
        }
        const updatedJudge = currentUser.role === 'juri' ? currentUser.name : p.juri;
        const updatedP = {
          ...p,
          juri: updatedJudge,
          scores: {
            ...p.scores,
            [categoryKey]: currentCatScores
          }
        };
        saveParticipantToCloud(updatedP);
        return updatedP;
      })
    );
    setCloudLastSynced(new Date());
    showToast('Nilai tersimpan & tersinkron otomatis ke Cloud');
  };

  // Reset a Category's Scores
  const handleResetCategory = (catKey: CategoryKey) => {
    if (!currentUser || currentUser.role === 'user') return;
    if (!activePeserta) return;

    const cat = categories.find(c => c.key === catKey);
    const catName = cat?.title || catKey;

    setConfirmModal({
      isOpen: true,
      title: `Reset Nilai ${catName}?`,
      message: `Semua nilai yang telah diinput untuk kategori ${catName} pada peserta "${activePeserta.peleton || activePeserta.sekolah}" akan dikosongkan.`,
      confirmText: 'Kosongkan Nilai',
      isDanger: true,
      onConfirm: () => {
        setPesertaList(prev =>
          prev.map(p => {
            if (p.id !== activePeserta.id) return p;
            const updatedScores = { ...p.scores };
            updatedScores[catKey] = {};
            const updatedP = { ...p, scores: updatedScores };
            saveParticipantToCloud(updatedP);
            return updatedP;
          })
        );
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast(`Nilai ${catName} telah dikosongkan.`, 'info');
      }
    });
  };

  // ============================================================
  // UPLOAD & SCAN FOTO FORM PENILAIAN JURI (AI GEMINI VISION)
  // ============================================================
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih berkas foto gambar (JPG, PNG, atau WEBP)!', 'error');
      return;
    }

    setScanFileName(file.name);
    setScanError(null);
    setScannedResult(null);

    const reader = new FileReader();
    reader.onload = event => {
      setScanPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanPhotoWithAI = async () => {
    if (!scanPreviewUrl) {
      showToast('Silakan pilih atau ambil foto lembar penilaian terlebih dahulu!', 'error');
      return;
    }
    if (!activeCategory) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/scan-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: scanPreviewUrl,
          categoryTitle: activeCategory.title,
          criteriaList: activeCategory.criteria
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Gagal membaca format lembar penilaian.');
      }

      setScannedResult(resData.data);
      showToast('Berhasil membaca nilai dari foto lembar penilaian!');
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err.message || 'Gagal menganalisis gambar dengan server.');
    } finally {
      setIsScanning(false);
    }
  };

  // Mode Fallback / Simulasi Pembacaan Foto Form Penilaian (jika offline/tanpa API key)
  const handleSimulateScan = () => {
    if (!activeCategory || !scanPreviewUrl) return;

    const simulatedScores = activeCategory.criteria.map((c, idx) => {
      // Pilih bobot realistis (B=index 3, A=index 4, C=index 2)
      const wIdx = idx % 3 === 0 ? 4 : (idx % 2 === 0 ? 3 : 2);
      const labels = ['KS', 'K', 'C', 'B', 'A'];
      return {
        criterionNo: c.no,
        score: c.weights[wIdx],
        label: labels[wIdx],
        confidence: 'high'
      };
    });

    setScannedResult({
      detectedNomor: activePeserta?.nomor || '01',
      detectedSekolah: activePeserta?.sekolah || 'SMP/SMA Terdeteksi',
      detectedJuri: currentUser?.name || 'Juri Lapangan',
      scores: simulatedScores,
      notes: 'Hasil deteksi format lembar penilaian siap diverifikasi dan diterapkan.'
    });
    setScanError(null);
    showToast('Mode ekstraksi form aktif, silakan periksa dan terapkan.');
  };

  const handleAdjustScannedScore = (criterionNo: number, score: number, label: string) => {
    if (!scannedResult) return;
    setScannedResult(prev => {
      if (!prev) return null;
      const updatedScores = prev.scores.map(s =>
        s.criterionNo === criterionNo ? { ...s, score, label } : s
      );
      return { ...prev, scores: updatedScores };
    });
  };

  const handleApplyScannedScores = () => {
    if (!activePesertaId || !scannedResult || !activeCategory) return;

    setPesertaList(prev =>
      prev.map(p => {
        if (p.id !== activePesertaId) return p;

        const currentCatScores = { ...(p.scores[activeCategory.key] || {}) };
        scannedResult.scores.forEach(s => {
          currentCatScores[s.criterionNo] = s.score;
        });

        const updatedJudge = currentUser?.role === 'juri' ? currentUser.name : (scannedResult.detectedJuri || p.juri);

        const updatedPhotos: Partial<Record<CategoryKey, FormPhotoData>> = {
          ...(p.formPhotos || {}),
          [activeCategory.key]: {
            url: scanPreviewUrl || '',
            uploadTime: new Date().toLocaleString('id-ID'),
            juriName: updatedJudge,
            fileName: scanFileName,
            notes: scannedResult.notes
          }
        };

        const updatedP = {
          ...p,
          juri: updatedJudge,
          scores: {
            ...p.scores,
            [activeCategory.key]: currentCatScores
          },
          formPhotos: updatedPhotos
        };
        saveParticipantToCloud(updatedP);
        return updatedP;
      })
    );

    setModalScanOpen(false);
    setScanPreviewUrl(null);
    setScannedResult(null);
    showToast(`Nilai ${activeCategory.title} dari foto berhasil diterapkan!`);
  };

  const handleOpenViewPhoto = (catKey: CategoryKey) => {
    if (!activePeserta) return;
    const photoData = activePeserta.formPhotos?.[catKey];
    if (!photoData || !photoData.url) {
      showToast('Belum ada foto form penilaian yang diunggah untuk kategori ini.', 'info');
      return;
    }
    const targetCat = categories.find(c => c.key === catKey);
    setViewingPhotoData({
      url: photoData.url,
      categoryTitle: targetCat?.title || catKey,
      participantName: activePeserta.sekolah,
      participantNomor: activePeserta.nomor,
      uploadTime: photoData.uploadTime,
      juriName: photoData.juriName
    });
    setModalViewPhotoOpen(true);
  };

  // Participant Form Handlers
  const openNewPesertaModal = () => {
    if (!currentUser || currentUser.role === 'user') return;
    const nextNo = (pesertaList.length + 1).toString().padStart(2, '0');
    setPesertaFormData({
      nomor: nextNo,
      peleton: '', // Opsional
      jenjang: currentUser.role === 'sekolah' && currentUser.schoolLevel ? currentUser.schoolLevel : 'SLTP',
      sekolah: currentUser.role === 'sekolah' && currentUser.schoolName ? currentUser.schoolName : '',
      tanggal: new Date().toISOString().split('T')[0],
      juri: currentUser.role === 'juri' ? currentUser.name : 'Aiptu Budi Santoso (Juri Lapangan)'
    });
    setEditingPesertaId(null);
    setModalPesertaOpen(true);
  };

  const openEditPesertaModal = (p: Participant) => {
    if (!currentUser || currentUser.role === 'user') return;
    if (currentUser.role === 'sekolah' && currentUser.schoolName && p.sekolah.toLowerCase().trim() !== currentUser.schoolName.toLowerCase().trim()) {
      showToast('Akses ditolak: Anda hanya dapat mengelola peserta sekolah Anda sendiri!', 'error');
      return;
    }
    setPesertaFormData({
      nomor: p.nomor,
      peleton: p.peleton || '',
      jenjang: p.jenjang || 'SLTP',
      sekolah: p.sekolah,
      tanggal: p.tanggal,
      juri: p.juri
    });
    setEditingPesertaId(p.id);
    setModalPesertaOpen(true);
  };

  const handleSavePeserta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesertaFormData.nomor.trim() || !pesertaFormData.sekolah.trim()) {
      showToast('Nomor Peserta dan Nama Sekolah wajib diisi!', 'error');
      return;
    }

    if (editingPesertaId) {
      const existing = pesertaList.find(p => p.id === editingPesertaId);
      const updatedParticipant: Participant = {
        ...(existing || ({} as Participant)),
        id: editingPesertaId,
        nomor: pesertaFormData.nomor.trim(),
        peleton: pesertaFormData.peleton.trim(),
        jenjang: pesertaFormData.jenjang,
        sekolah: pesertaFormData.sekolah.trim(),
        tanggal: pesertaFormData.tanggal,
        juri: pesertaFormData.juri.trim(),
        scores: existing?.scores || {
          pbb: {}, variasi: {}, formasi: {}, danton: {},
          devile: {}, gatur: {}, senam: {}, yelyel: {},
          beladiri: {}, speaking: {}, tenda: {}
        }
      };
      const updatedList = pesertaList.map(p => (p.id === editingPesertaId ? updatedParticipant : p));
      setPesertaList(updatedList);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList: updatedList }));
      } catch {
        // ignore
      }
      const syncRes = await saveParticipantToCloud(updatedParticipant);
      if (syncRes.success) {
        setCloudLastSynced(new Date());
      }
      showToast('Data peserta berhasil diperbarui & tersinkron otomatis ke Cloud!', 'success');
    } else {
      const newId = 'p-' + Date.now();
      const newParticipant: Participant = {
        id: newId,
        nomor: pesertaFormData.nomor.trim(),
        peleton: pesertaFormData.peleton.trim(),
        jenjang: pesertaFormData.jenjang,
        sekolah: pesertaFormData.sekolah.trim(),
        tanggal: pesertaFormData.tanggal,
        juri: pesertaFormData.juri.trim(),
        scores: {
          pbb: {},
          variasi: {},
          formasi: {},
          danton: {},
          devile: {},
          gatur: {},
          senam: {},
          yelyel: {},
          beladiri: {},
          speaking: {},
          tenda: {}
        }
      };
      const updatedList = [...pesertaList, newParticipant];
      setPesertaList(updatedList);
      setActivePesertaId(newId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList: updatedList }));
      } catch {
        // ignore
      }
      const syncRes = await saveParticipantToCloud(newParticipant);
      if (syncRes.success) {
        setCloudLastSynced(new Date());
      }
      showToast(`Peserta baru "${newParticipant.peleton || newParticipant.sekolah}" berhasil ditambahkan & tersinkron otomatis ke Cloud!`, 'success');
    }
    setModalPesertaOpen(false);
  };

  const handleDeletePeserta = (id: string) => {
    if (!currentUser || !isAdminRole) {
      showToast('Hanya Administrator yang berhak menghapus peserta!', 'error');
      return;
    }
    const target = pesertaList.find(p => p.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Peserta?',
      message: `Yakin ingin menghapus peserta "${target.peleton || target.sekolah}" (No. ${target.nomor}) beserta seluruh rekap nilainya? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus Peserta',
      isDanger: true,
      onConfirm: async () => {
        const filtered = pesertaList.filter(p => p.id !== id);
        setPesertaList(filtered);
        if (activePesertaId === id) {
          setActivePesertaId(filtered.length > 0 ? filtered[0].id : null);
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ pesertaList: filtered }));
        } catch {
          // ignore
        }
        await deleteParticipantFromCloud(id);
        setCloudLastSynced(new Date());
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Peserta berhasil dihapus dari Cloud & lokal.', 'error');
      }
    });
  };

  // Reset All System Data (Super Admin Only)
  const handleResetAllData = () => {
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama (Super Admin) yang berhak mereset seluruh data sistem!', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Reset Semua Data Sistem?',
      message: 'PERINGATAN: Seluruh daftar peserta dan nilai yang telah diinput akan dihapus dan dikembalikan ke data awal demo. Tindakan ini permanen.',
      confirmText: 'Reset Total Data',
      isDanger: true,
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY);
        setPesertaList(INITIAL_PESERTA);
        setActivePesertaId(INITIAL_PESERTA[0].id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showToast('Basis data telah direset ke setelan awal.', 'info');
      }
    });
  };

  // Backup & Restore
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify({ pesertaList, categories, usersList }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Cadangan_Lomba_PBB_PKS_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('File cadangan JSON berhasil diunduh.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama (Super Admin) yang berhak memulihkan data sistem!', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.pesertaList)) {
          setPesertaList(parsed.pesertaList);
          parsed.pesertaList.forEach((p: Participant) => saveParticipantToCloud(p));
          if (Array.isArray(parsed.categories)) {
            setCategories(parsed.categories);
            saveConfigToCloud(parsed.categories);
          }
          if (Array.isArray(parsed.usersList)) {
            setUsersList(parsed.usersList);
            parsed.usersList.forEach((u: AppUser) => saveUserToCloud(u));
          }
          if (parsed.pesertaList.length > 0) {
            setActivePesertaId(parsed.pesertaList[0].id);
          }
          showToast('Data cadangan berhasil dipulihkan dan disinkronkan ke Cloud!');
        } else {
          showToast('Format file JSON tidak sesuai struktur aplikasi!', 'error');
        }
      } catch {
        showToast('Gagal membaca file JSON!', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Administrator Configuration Save (Super Admin Only)
  const handleSaveCategoriesConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama yang berhak mengubah ketentuan juknis!', 'error');
      return;
    }
    setCategories(tempCategoriesConfig);
    saveConfigToCloud(tempCategoriesConfig);
    setModalConfigOpen(false);
    showToast('Ketentuan nilai maksimal juknis berhasil diperbarui!');
  };

  const handleResetCategoriesToDefault = () => {
    if (!isSuperAdmin) {
      showToast('Hanya Administrator Utama yang berhak mengembalikan juknis standar!', 'error');
      return;
    }
    setTempCategoriesConfig(DEFAULT_CATEGORIES);
    setCategories(DEFAULT_CATEGORIES);
    saveConfigToCloud(DEFAULT_CATEGORIES);
    showToast('Konfigurasi dikembalikan ke standar awal.');
  };

  // ============================================================
  // STANDINGS COMPUTATION (JUARA UMUM & PER-KATEGORI LOMBA)
  // ============================================================

  // ============================================================
  // STANDINGS COMPUTATION (JUARA UMUM & PER-KATEGORI LOMBA)
  // ============================================================

  // 1. Perhitungan Peringkat Mandiri untuk SETIAP Kategori Perlombaan (PBB, Danton, Yel-Yel, dll)
  const allCategoriesRankings = useMemo(() => {
    const result: Record<
      CategoryKey,
      {
        category: CategoryConfig;
        leaderboard: Array<{
          id: string;
          nomor: string;
          jenjang: SchoolLevel;
          sekolah: string;
          peleton: string;
          tanggal: string;
          juri: string;
          calc: CalculatedScores;
          catSummary: CategorySummary;
          catScores: Record<number, number>;
          catRank: number | null;
          jenjangCatRank: number | null;
          participantObj?: Participant;
        }>;
        leaderboardSLTP: Array<{
          id: string;
          nomor: string;
          jenjang: SchoolLevel;
          sekolah: string;
          peleton: string;
          tanggal: string;
          juri: string;
          calc: CalculatedScores;
          catSummary: CategorySummary;
          catScores: Record<number, number>;
          catRank: number | null;
          jenjangCatRank: number | null;
          participantObj?: Participant;
        }>;
        leaderboardSLTA: Array<{
          id: string;
          nomor: string;
          jenjang: SchoolLevel;
          sekolah: string;
          peleton: string;
          tanggal: string;
          juri: string;
          calc: CalculatedScores;
          catSummary: CategorySummary;
          catScores: Record<number, number>;
          catRank: number | null;
          jenjangCatRank: number | null;
          participantObj?: Participant;
        }>;
        rankMap: Map<string, number>;
        jenjangRankMap: Map<string, number>;
        topThreeSLTP: Array<{
          participant: Participant;
          rank: number;
          score: number;
          pct: number;
        }>;
        topThreeSLTA: Array<{
          participant: Participant;
          rank: number;
          score: number;
          pct: number;
        }>;
        topThree: Array<{
          participant: Participant;
          rank: number;
          score: number;
          pct: number;
        }>;
      }
    > = {} as any;

    categories.forEach(cat => {
      const list = pesertaList.map(p => {
        const calc = calculateAllCategories(p, categories)!;
        const catSummary = calc.categorySummaries[cat.key];
        const catScores = p.scores[cat.key] || {};
        return {
          id: p.id,
          nomor: p.nomor,
          jenjang: p.jenjang || 'SLTP',
          sekolah: p.sekolah,
          peleton: p.peleton || '',
          tanggal: p.tanggal,
          juri: p.juri,
          participantObj: p,
          calc,
          catSummary,
          catScores,
          catRank: null as number | null,
          jenjangCatRank: null as number | null
        };
      });

      // Peringkat Kategori Umum (Gabungan SLTP & SLTA)
      const qualified = list
        .filter(item => item.catSummary.isComplete)
        .sort((a, b) => b.catSummary.sum - a.catSummary.sum);

      let rCounter = 1;
      for (let i = 0; i < qualified.length; i++) {
        if (i > 0 && qualified[i].catSummary.sum < qualified[i - 1].catSummary.sum) {
          rCounter = i + 1;
        }
        qualified[i].catRank = rCounter;
      }

      const rankMap = new Map<string, number>();
      qualified.forEach(item => rankMap.set(item.id, item.catRank!));

      // Peringkat Kategori Berdasarkan Jenjang (SLTP dan SLTA Mandiri)
      const sltpQualified = qualified.filter(item => item.jenjang === 'SLTP');
      let sltpCounter = 1;
      for (let i = 0; i < sltpQualified.length; i++) {
        if (i > 0 && sltpQualified[i].catSummary.sum < sltpQualified[i - 1].catSummary.sum) {
          sltpCounter = i + 1;
        }
        sltpQualified[i].jenjangCatRank = sltpCounter;
      }

      const sltaQualified = qualified.filter(item => item.jenjang === 'SLTA');
      let sltaCounter = 1;
      for (let i = 0; i < sltaQualified.length; i++) {
        if (i > 0 && sltaQualified[i].catSummary.sum < sltaQualified[i - 1].catSummary.sum) {
          sltaCounter = i + 1;
        }
        sltaQualified[i].jenjangCatRank = sltaCounter;
      }

      const jenjangRankMap = new Map<string, number>();
      sltpQualified.forEach(item => jenjangRankMap.set(item.id, item.jenjangCatRank!));
      sltaQualified.forEach(item => jenjangRankMap.set(item.id, item.jenjangCatRank!));

      const fullLeaderboard = list.map(item => ({
        id: item.id,
        nomor: item.nomor,
        jenjang: item.jenjang,
        sekolah: item.sekolah,
        peleton: item.peleton,
        tanggal: item.tanggal,
        juri: item.juri,
        participantObj: item.participantObj,
        calc: item.calc,
        catSummary: item.catSummary,
        catScores: item.catScores,
        catRank: rankMap.get(item.id) || null,
        jenjangCatRank: jenjangRankMap.get(item.id) || null
      }));

      // Urutkan leaderboard: yang lengkap di atas sesuai peringkat nilai, sisanya di bawah
      fullLeaderboard.sort((a, b) => {
        if (a.catSummary.isComplete && b.catSummary.isComplete) {
          return (a.catRank || 999) - (b.catRank || 999);
        }
        if (a.catSummary.isComplete) return -1;
        if (b.catSummary.isComplete) return 1;
        return (a.nomor || '').localeCompare(b.nomor || '');
      });

      // Top 3 Podium Kategori SLTP (Mandiri)
      const topThreeSLTP = fullLeaderboard
        .filter(item => (item.jenjang || 'SLTP') === 'SLTP' && item.catSummary.isComplete && item.jenjangCatRank !== null && item.jenjangCatRank <= 3)
        .sort((a, b) => (a.jenjangCatRank || 99) - (b.jenjangCatRank || 99))
        .slice(0, 3)
        .map(item => ({
          participant: item.participantObj,
          rank: item.jenjangCatRank!,
          score: item.catSummary.sum,
          pct: item.catSummary.pct
        }));

      // Top 3 Podium Kategori SLTA (Mandiri)
      const topThreeSLTA = fullLeaderboard
        .filter(item => item.jenjang === 'SLTA' && item.catSummary.isComplete && item.jenjangCatRank !== null && item.jenjangCatRank <= 3)
        .sort((a, b) => (a.jenjangCatRank || 99) - (b.jenjangCatRank || 99))
        .slice(0, 3)
        .map(item => ({
          participant: item.participantObj,
          rank: item.jenjangCatRank!,
          score: item.catSummary.sum,
          pct: item.catSummary.pct
        }));

      // Separate sorted leaderboards for SLTP and SLTA
      const leaderboardSLTP = fullLeaderboard
        .filter(item => (item.jenjang || 'SLTP') === 'SLTP')
        .sort((a, b) => {
          if (a.catSummary.isComplete && b.catSummary.isComplete) {
            return (a.jenjangCatRank || 999) - (b.jenjangCatRank || 999);
          }
          if (a.catSummary.isComplete) return -1;
          if (b.catSummary.isComplete) return 1;
          return (a.nomor || '').localeCompare(b.nomor || '');
        });

      const leaderboardSLTA = fullLeaderboard
        .filter(item => item.jenjang === 'SLTA')
        .sort((a, b) => {
          if (a.catSummary.isComplete && b.catSummary.isComplete) {
            return (a.jenjangCatRank || 999) - (b.jenjangCatRank || 999);
          }
          if (a.catSummary.isComplete) return -1;
          if (b.catSummary.isComplete) return 1;
          return (a.nomor || '').localeCompare(b.nomor || '');
        });

      result[cat.key] = {
        category: cat,
        leaderboard: fullLeaderboard,
        leaderboardSLTP,
        leaderboardSLTA,
        rankMap,
        jenjangRankMap,
        topThreeSLTP,
        topThreeSLTA,
        topThree: topThreeSLTP
      };
    });

    return result;
  }, [pesertaList, categories]);

  // 2. Klasemen Juara Umum (Akumulasi Semua Kategori) + Rincian Peringkat Tiap Kategori
  const overallStandingsData = useMemo(() => {
    const list = pesertaList.map(p => {
      const calc = calculateAllCategories(p, categories)!;
      // Ambil peringkat mandiri peserta ini di setiap kategori
      const catRanks: Record<CategoryKey, { rank: number | null; jenjangRank: number | null; sum: number; isComplete: boolean }> = {} as any;
      categories.forEach(cat => {
        const catInfo = allCategoriesRankings[cat.key];
        const r = catInfo?.rankMap.get(p.id) || null;
        const jr = catInfo?.jenjangRankMap.get(p.id) || null;
        const sum = calc.categorySummaries[cat.key]?.sum || 0;
        const isComplete = calc.categorySummaries[cat.key]?.isComplete || false;
        catRanks[cat.key] = { rank: r, jenjangRank: jr, sum, isComplete };
      });

      return {
        ...p,
        calc,
        catRanks,
        rank: null as number | null,
        jenjangRank: null as number | null
      };
    });

    // Peringkat Juara Umum (Gabungan)
    const qualifiedList = list
      .filter(item => item.calc.mandatoryCompleted)
      .sort((a, b) => b.calc.grandTotal - a.calc.grandTotal);

    let rankCounter = 1;
    for (let i = 0; i < qualifiedList.length; i++) {
      if (i > 0 && qualifiedList[i].calc.grandTotal < qualifiedList[i - 1].calc.grandTotal) {
        rankCounter = i + 1;
      }
      qualifiedList[i].rank = rankCounter;
    }

    const rankMap = new Map<string, number>();
    qualifiedList.forEach((c: any) => rankMap.set(c.id, c.rank));

    // Peringkat Juara Umum Khusus Jenjang (SLTP dan SLTA Mandiri)
    const sltpQualified = qualifiedList.filter(item => (item.jenjang || 'SLTP') === 'SLTP');
    let sltpR = 1;
    for (let i = 0; i < sltpQualified.length; i++) {
      if (i > 0 && sltpQualified[i].calc.grandTotal < sltpQualified[i - 1].calc.grandTotal) {
        sltpR = i + 1;
      }
      sltpQualified[i].jenjangRank = sltpR;
    }

    const sltaQualified = qualifiedList.filter(item => item.jenjang === 'SLTA');
    let sltaR = 1;
    for (let i = 0; i < sltaQualified.length; i++) {
      if (i > 0 && sltaQualified[i].calc.grandTotal < sltaQualified[i - 1].calc.grandTotal) {
        sltaR = i + 1;
      }
      sltaQualified[i].jenjangRank = sltaR;
    }

    const jenjangRankMap = new Map<string, number>();
    sltpQualified.forEach(item => jenjangRankMap.set(item.id, item.jenjangRank!));
    sltaQualified.forEach(item => jenjangRankMap.set(item.id, item.jenjangRank!));

    const withRank = list.map(item => ({
      ...item,
      rank: rankMap.get(item.id) || null,
      jenjangRank: jenjangRankMap.get(item.id) || null
    }));

    withRank.sort((a, b) => {
      if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
        if (jenjangFilter !== 'all') {
          return (a.jenjangRank || 999) - (b.jenjangRank || 999);
        }
        if ((a.jenjang || 'SLTP') !== (b.jenjang || 'SLTP')) {
          return (a.jenjang || 'SLTP') === 'SLTP' ? -1 : 1;
        }
        return (a.jenjangRank || 999) - (b.jenjangRank || 999);
      }
      if (a.calc.mandatoryCompleted) return -1;
      if (b.calc.mandatoryCompleted) return 1;
      return (a.nomor || '').localeCompare(b.nomor || '');
    });

    return withRank.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        item.nomor.toLowerCase().includes(q) ||
        (item.peleton || '').toLowerCase().includes(q) ||
        item.sekolah.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (jenjangFilter !== 'all' && item.jenjang !== jenjangFilter) return false;
      if (statusFilter === 'completed') return item.calc.mandatoryCompleted;
      if (statusFilter === 'pending') return !item.calc.mandatoryCompleted;
      return true;
    });
  }, [pesertaList, categories, allCategoriesRankings, searchQuery, jenjangFilter, statusFilter]);

  // 3. Standings Khusus Kategori yang Sedang Dipilih (Filterable)
  const categorySpecificStandingsData = useMemo(() => {
    const targetCat = categories.find(c => c.key === rekapSelectedCategoryKey);
    if (!targetCat) return [];

    const catData = allCategoriesRankings[targetCat.key];
    if (!catData) return [];

    const source =
      jenjangFilter === 'SLTP'
        ? catData.leaderboardSLTP
        : jenjangFilter === 'SLTA'
        ? catData.leaderboardSLTA
        : catData.leaderboard;

    return source.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        item.nomor.toLowerCase().includes(q) ||
        (item.peleton || '').toLowerCase().includes(q) ||
        item.sekolah.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (jenjangFilter !== 'all' && item.jenjang !== jenjangFilter) return false;
      if (statusFilter === 'completed') return item.catSummary.isComplete;
      if (statusFilter === 'pending') return !item.catSummary.isComplete;
      return true;
    });
  }, [allCategoriesRankings, rekapSelectedCategoryKey, searchQuery, jenjangFilter, statusFilter]);

  // ============================================================
  // EXPORT EXCEL FUNCTIONS (JUARA UMUM & PER-KATEGORI LOMBA)
  // ============================================================

  // Helper Pembuat Baris Excel Klasemen Juara Umum
  const buildJuaraUmumExcelRows = (items: typeof overallStandingsData, jenjangLabel: string) => {
    return items.map((item, index) => {
      const rowObj: Record<string, any> = {
        'No': index + 1,
        'Peringkat Juara Umum': item.jenjangRank ? `Juara ${item.jenjangRank} ${jenjangLabel}` : 'Belum Lengkap',
        'No. Peserta': item.nomor,
        'Tingkat': item.jenjang || 'SLTP',
        'Nama Peleton': item.peleton || '-',
        'Nama Sekolah': item.sekolah,
        'Hari / Tanggal': item.tanggal,
        'Nama Juri': item.juri
      };

      categories.forEach(cat => {
        const sum = item.calc.categorySummaries[cat.key]?.sum || 0;
        const cRank = item.catRanks[cat.key]?.jenjangRank;
        rowObj[`${cat.title} (${cat.maxPoints})`] = sum;
        rowObj[`Peringkat ${cat.shortTitle}`] = cRank ? `Rank ${cRank}` : '-';
      });

      rowObj[`TOTAL NILAI AKHIR (Max ${item.calc.maxGrandTotal})`] = item.calc.grandTotal;
      rowObj['Pencapaian (%)'] = Number(item.calc.grandPct.toFixed(2));
      rowObj['Status Kelayakan Juara'] = item.calc.mandatoryCompleted
        ? 'Memenuhi Syarat Juara (Lengkap)'
        : `Belum Lengkap (${item.calc.completedCategoriesCount}/${item.calc.totalCategoriesCount} Selesai)`;

      return rowObj;
    });
  };

  // 1. Ekspor Rekap Juara Umum (Multi-Sheet: Sheet SLTP dan Sheet SLTA Terpisah)
  const handleExportExcelJuaraUmum = () => {
    if (pesertaList.length === 0) {
      showToast('Belum ada data peserta untuk diekspor!', 'error');
      return;
    }

    const sltpItems = overallStandingsData
      .filter(item => (item.jenjang || 'SLTP') === 'SLTP')
      .sort((a, b) => {
        if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
          return (a.jenjangRank || 999) - (b.jenjangRank || 999);
        }
        if (a.calc.mandatoryCompleted) return -1;
        if (b.calc.mandatoryCompleted) return 1;
        return (a.nomor || '').localeCompare(b.nomor || '');
      });

    const sltaItems = overallStandingsData
      .filter(item => item.jenjang === 'SLTA')
      .sort((a, b) => {
        if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
          return (a.jenjangRank || 999) - (b.jenjangRank || 999);
        }
        if (a.calc.mandatoryCompleted) return -1;
        if (b.calc.mandatoryCompleted) return 1;
        return (a.nomor || '').localeCompare(b.nomor || '');
      });

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Juara Umum SLTP
    const wsSltp = XLSX.utils.json_to_sheet(buildJuaraUmumExcelRows(sltpItems, 'SLTP'));
    XLSX.utils.book_append_sheet(workbook, wsSltp, 'Juara Umum SLTP');

    // Sheet 2: Juara Umum SLTA
    const wsSlta = XLSX.utils.json_to_sheet(buildJuaraUmumExcelRows(sltaItems, 'SLTA'));
    XLSX.utils.book_append_sheet(workbook, wsSlta, 'Juara Umum SLTA');

    XLSX.writeFile(workbook, `Rekap_Juara_Umum_SLTP_dan_SLTA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Laporan Juara Umum Excel (Sheet SLTP & SLTA terpisah) berhasil diunduh.');
  };

  // Helper Pembuat Baris Excel Kategori
  const buildKategoriExcelRows = (items: any[], targetCat: any, jenjangLabel: string) => {
    return items.map((item, index) => {
      const activeRank = item.jenjangCatRank;
      const rowObj: Record<string, any> = {
        'No': index + 1,
        'Peringkat Kategori': activeRank ? `Juara ${activeRank} (${jenjangLabel})` : 'Belum Lengkap',
        'No. Peserta': item.nomor,
        'Tingkat': item.jenjang || 'SLTP',
        'Nama Peleton': item.peleton || '-',
        'Nama Sekolah': item.sekolah,
        'Hari / Tanggal': item.tanggal,
        'Juri Penilai': item.juri
      };

      targetCat.criteria.forEach((crit: any) => {
        const val = item.catScores[crit.no];
        rowObj[`K${crit.no}. ${crit.name} (Max ${crit.weights[4]})`] = val !== undefined && val !== null ? val : '-';
      });

      rowObj[`TOTAL NILAI ${targetCat.shortTitle.toUpperCase()} (Max ${targetCat.maxPoints})`] = item.catSummary.sum;
      rowObj['Pencapaian (%)'] = Number(item.catSummary.pct.toFixed(2));
      rowObj['Status Kategori'] = item.catSummary.isComplete ? 'Selesai Dinilai' : 'Belum Lengkap';

      return rowObj;
    });
  };

  // 2. Ekspor Rekap Peringkat Kategori Spesifik (Multi-Sheet: Sheet SLTP dan Sheet SLTA Terpisah)
  const handleExportExcelKategoriSpesifik = (catKey: CategoryKey) => {
    const targetCat = categories.find(c => c.key === catKey);
    if (!targetCat || pesertaList.length === 0) return;

    const catData = allCategoriesRankings[targetCat.key];
    const sltpList = catData ? catData.leaderboardSLTP : [];
    const sltaList = catData ? catData.leaderboardSLTA : [];

    const workbook = XLSX.utils.book_new();

    const wsSltp = XLSX.utils.json_to_sheet(buildKategoriExcelRows(sltpList, targetCat, 'SLTP'));
    XLSX.utils.book_append_sheet(workbook, wsSltp, `${targetCat.shortTitle} SLTP`.slice(0, 30));

    const wsSlta = XLSX.utils.json_to_sheet(buildKategoriExcelRows(sltaList, targetCat, 'SLTA'));
    XLSX.utils.book_append_sheet(workbook, wsSlta, `${targetCat.shortTitle} SLTA`.slice(0, 30));

    XLSX.writeFile(workbook, `Rekap_Juara_${targetCat.shortTitle.replace(/\s+/g, '_')}_SLTP_SLTA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Laporan Peringkat ${targetCat.title} (Sheet SLTP & SLTA) berhasil diunduh.`);
  };

  // 3. Ekspor Buku Rekap Lengkap (Multi-Sheet: Sheet Juara Umum SLTP & SLTA + Podium SLTP & SLTA + Kategori)
  const handleExportExcelMasterWorkbook = () => {
    if (pesertaList.length === 0) {
      showToast('Belum ada data peserta untuk diekspor!', 'error');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // 1. Sheet Juara Umum SLTP
    const sltpOverall = overallStandingsData
      .filter(item => (item.jenjang || 'SLTP') === 'SLTP')
      .sort((a, b) => {
        if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
          return (a.jenjangRank || 999) - (b.jenjangRank || 999);
        }
        if (a.calc.mandatoryCompleted) return -1;
        if (b.calc.mandatoryCompleted) return 1;
        return (a.nomor || '').localeCompare(b.nomor || '');
      });
    const wsUmumSltp = XLSX.utils.json_to_sheet(buildJuaraUmumExcelRows(sltpOverall, 'SLTP'));
    XLSX.utils.book_append_sheet(workbook, wsUmumSltp, 'Juara Umum SLTP');

    // 2. Sheet Juara Umum SLTA
    const sltaOverall = overallStandingsData
      .filter(item => item.jenjang === 'SLTA')
      .sort((a, b) => {
        if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
          return (a.jenjangRank || 999) - (b.jenjangRank || 999);
        }
        if (a.calc.mandatoryCompleted) return -1;
        if (b.calc.mandatoryCompleted) return 1;
        return (a.nomor || '').localeCompare(b.nomor || '');
      });
    const wsUmumSlta = XLSX.utils.json_to_sheet(buildJuaraUmumExcelRows(sltaOverall, 'SLTA'));
    XLSX.utils.book_append_sheet(workbook, wsUmumSlta, 'Juara Umum SLTA');

    // 3. Sheet Podium Juara Kategori SLTP
    const rowsPodiumSltp = categories.map((cat, idx) => {
      const catData = allCategoriesRankings[cat.key];
      const j1 = catData?.topThreeSLTP.find(t => t.rank === 1);
      const j2 = catData?.topThreeSLTP.find(t => t.rank === 2);
      const j3 = catData?.topThreeSLTP.find(t => t.rank === 3);

      return {
        'No': idx + 1,
        'Tingkat': 'SLTP',
        'Kategori Mata Lomba': cat.title,
        'Nama Singkat': cat.shortTitle,
        'Nilai Maksimal': `${cat.maxPoints} Poin`,
        'Juara 1 SLTP (Emas)': j1 ? `${j1.participant.sekolah} (${j1.score} Poin - ${j1.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 1': j1?.participant.peleton || '-',
        'Juara 2 SLTP (Perak)': j2 ? `${j2.participant.sekolah} (${j2.score} Poin - ${j2.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 2': j2?.participant.peleton || '-',
        'Juara 3 SLTP (Perunggu)': j3 ? `${j3.participant.sekolah} (${j3.score} Poin - ${j3.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 3': j3?.participant.peleton || '-'
      };
    });
    const wsPodiumSltp = XLSX.utils.json_to_sheet(rowsPodiumSltp);
    XLSX.utils.book_append_sheet(workbook, wsPodiumSltp, 'Podium Kategori SLTP');

    // 4. Sheet Podium Juara Kategori SLTA
    const rowsPodiumSlta = categories.map((cat, idx) => {
      const catData = allCategoriesRankings[cat.key];
      const j1 = catData?.topThreeSLTA.find(t => t.rank === 1);
      const j2 = catData?.topThreeSLTA.find(t => t.rank === 2);
      const j3 = catData?.topThreeSLTA.find(t => t.rank === 3);

      return {
        'No': idx + 1,
        'Tingkat': 'SLTA',
        'Kategori Mata Lomba': cat.title,
        'Nama Singkat': cat.shortTitle,
        'Nilai Maksimal': `${cat.maxPoints} Poin`,
        'Juara 1 SLTA (Emas)': j1 ? `${j1.participant.sekolah} (${j1.score} Poin - ${j1.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 1': j1?.participant.peleton || '-',
        'Juara 2 SLTA (Perak)': j2 ? `${j2.participant.sekolah} (${j2.score} Poin - ${j2.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 2': j2?.participant.peleton || '-',
        'Juara 3 SLTA (Perunggu)': j3 ? `${j3.participant.sekolah} (${j3.score} Poin - ${j3.pct.toFixed(1)}%)` : 'Belum Ada',
        'Peleton Juara 3': j3?.participant.peleton || '-'
      };
    });
    const wsPodiumSlta = XLSX.utils.json_to_sheet(rowsPodiumSlta);
    XLSX.utils.book_append_sheet(workbook, wsPodiumSlta, 'Podium Kategori SLTA');

    // 5. Masing-masing kategori di sheet terpisah untuk SLTP dan SLTA
    categories.forEach(cat => {
      const catData = allCategoriesRankings[cat.key];
      if (catData) {
        if (catData.leaderboardSLTP.length > 0) {
          const wsCatSltp = XLSX.utils.json_to_sheet(buildKategoriExcelRows(catData.leaderboardSLTP, cat, 'SLTP'));
          XLSX.utils.book_append_sheet(workbook, wsCatSltp, `${cat.shortTitle} SLTP`.slice(0, 30));
        }
        if (catData.leaderboardSLTA.length > 0) {
          const wsCatSlta = XLSX.utils.json_to_sheet(buildKategoriExcelRows(catData.leaderboardSLTA, cat, 'SLTA'));
          XLSX.utils.book_append_sheet(workbook, wsCatSlta, `${cat.shortTitle} SLTA`.slice(0, 30));
        }
      }
    });

    XLSX.writeFile(workbook, `Buku_Rekap_Lengkap_Lomba_PBB_PKS_SLTP_SLTA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Buku Rekap Master Lengkap (Multi-Sheet SLTP & SLTA Terpisah) berhasil diunduh.');
  };

  // 4. Unduh Format Blanko Lembar Penilaian Juri Per-Kategori (.xlsx)
  const handleDownloadBlankScoreSheet = (catKey: CategoryKey) => {
    const targetCat = categories.find(c => c.key === catKey);
    if (!targetCat) return;

    const rows: (string | number)[][] = [
      ['PANITIA PELAKSANA LOMBA TINGKAT SLTP & SLTA'],
      ['LEMBAR FORMAT PENILAIAN JURI LAPANGAN'],
      ['LOMBA BARIS-BERBARIS (PBB) & PATROLI KEAMANAN SEKOLAH (PKS)'],
      [`MATA LOMBA: ${targetCat.title.toUpperCase()} (KODE: ${targetCat.shortTitle.toUpperCase()})`],
      [`Kelompok: ${targetCat.group} | Nilai Maksimal: ${targetCat.maxPoints} Poin | Jumlah Kriteria: ${targetCat.criteria.length} Butir`],
      [''],
      ['DATA IDENTITAS PESERTA (Diisi oleh Juri / Panitia di Lapangan):'],
      ['Nomor Urut Peserta', ': [ ....................................... ]', '', 'Hari / Tanggal', ': [ ....................................... ]'],
      ['Nama Sekolah', ': [ ....................................... ]', '', 'Jenjang Pendidikan', ': [  ] SLTP       [  ] SLTA'],
      ['Nama Peleton / Regu', ': [ ....................................... ]', '', 'Nama Juri Penilai', ': [ ....................................... ]'],
      [''],
      [
        'No.',
        'Kriteria Penilaian',
        'KS (Kurang Sekali)',
        'K (Kurang)',
        'C (Cukup)',
        'B (Baik)',
        'A (Sangat Baik / Max)',
        'PILIHAN NILAI JURI (Ceklis / Tulis Angka)',
        'CATATAN / EVALUASI JURI'
      ]
    ];

    targetCat.criteria.forEach(crit => {
      rows.push([
        crit.no,
        crit.name,
        crit.weights[0],
        crit.weights[1],
        crit.weights[2],
        crit.weights[3],
        crit.weights[4],
        '',
        ''
      ]);
    });

    rows.push([
      '',
      `TOTAL NILAI AKHIR (Maksimal: ${targetCat.maxPoints} Poin)`,
      '',
      '',
      '',
      '',
      '',
      `....... / ${targetCat.maxPoints}`,
      ''
    ]);

    rows.push(['']);
    rows.push(['PETUNJUK PENILAIAN JURI:']);
    rows.push(['1. Berikan tanda centang (✓) atau lingkari salah satu kolom nilai (KS, K, C, B, A) pada setiap butir kriteria.']);
    rows.push(['2. Bobot Nilai: KS = Kurang Sekali, K = Kurang, C = Cukup, B = Baik, A = Sangat Baik / Maksimal.']);
    rows.push(['3. Tuliskan catatan jika terdapat koreksi gerakan, keistimewaan formasi, atau pelanggaran ketentuan lapangan.']);
    rows.push(['4. Setelah lembar fisik selesai diisi dan ditandatangani, juri dapat memotret form ini untuk otomatis diekstraksi ke sistem via fitur "Upload Foto Form".']);
    rows.push(['']);
    rows.push(['', '', '', '', '', '', 'Tanda Tangan Juri Penilai:']);
    rows.push(['']);
    rows.push(['']);
    rows.push(['', '', '', '', '', '', '( ............................................................ )']);
    rows.push(['', '', '', '', '', '', 'Nama Terang & NIP / NRP Juri']);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 45 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 22 },
      { wch: 26 },
      { wch: 35 }
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = `Blanko ${targetCat.shortTitle}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(
      workbook,
      `Format_Penilaian_Blanko_${targetCat.shortTitle.replace(/\s+/g, '_')}.xlsx`
    );
    showToast(`Format blanko penilaian ${targetCat.title} (.xlsx) berhasil diunduh!`);
  };

  // 5. Unduh Master Workbook Blanko Seluruh 11 Kriteria Mata Lomba (.xlsx)
  const handleDownloadMasterBlankWorkbook = () => {
    const workbook = XLSX.utils.book_new();

    // COVER SHEET / DAFTAR MATA LOMBA
    const coverRows = [
      ['MASTER FORMAT BLANKO LEMBAR PENILAIAN JURI LAPANGAN'],
      ['LOMBA BARIS-BERBARIS (PBB) & PATROLI KEAMANAN SEKOLAH (PKS) TINGKAT SLTP & SLTA'],
      [''],
      ['Petunjuk: File ini berisi seluruh 11 lembar form blanko kriteria penilaian resmi untuk panitia & juri lapangan.'],
      ['Setiap mata lomba tersedia pada sheet terpisah dan siap langsung dicetak atau diisi.'],
      [''],
      ['DAFTAR MATA LOMBA & BOBOT MAKSIMAL:'],
      ['No.', 'Nama Mata Lomba', 'Kelompok Lomba', 'Jumlah Kriteria', 'Nilai Maksimal', 'Nama Sheet'],
      ...categories.map((c, i) => [
        i + 1,
        c.title,
        c.group,
        `${c.criteria.length} Butir`,
        `${c.maxPoints} Poin`,
        `Blanko ${c.shortTitle}`.slice(0, 31)
      ])
    ];

    const coverWs = XLSX.utils.aoa_to_sheet(coverRows);
    coverWs['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, coverWs, 'Daftar Mata Lomba');

    // SHEETS UNTUK SETIAP KATEGORI LOMBA
    categories.forEach(cat => {
      const rows: (string | number)[][] = [
        ['PANITIA PELAKSANA LOMBA TINGKAT SLTP & SLTA'],
        ['LEMBAR FORMAT PENILAIAN JURI LAPANGAN'],
        ['LOMBA BARIS-BERBARIS (PBB) & PATROLI KEAMANAN SEKOLAH (PKS)'],
        [`MATA LOMBA: ${cat.title.toUpperCase()} (NILAI MAKSIMAL: ${cat.maxPoints} POIN)`],
        [`Kelompok: ${cat.group} | Jumlah Kriteria: ${cat.criteria.length} Butir`],
        [''],
        ['Nomor Peserta', ': [ ..................... ]', '', 'Hari / Tanggal', ': [ ..................... ]'],
        ['Nama Sekolah', ': [ ..................... ]', '', 'Jenjang', ': [  ] SLTP    [  ] SLTA'],
        ['Regu / Peleton', ': [ ..................... ]', '', 'Nama Juri', ': [ ..................... ]'],
        [''],
        [
          'No.',
          'Kriteria Penilaian',
          'KS (Kurang Sekali)',
          'K (Kurang)',
          'C (Cukup)',
          'B (Baik)',
          'A (Sangat Baik / Max)',
          'PILIHAN NILAI JURI',
          'CATATAN JURI'
        ]
      ];

      cat.criteria.forEach(crit => {
        rows.push([
          crit.no,
          crit.name,
          crit.weights[0],
          crit.weights[1],
          crit.weights[2],
          crit.weights[3],
          crit.weights[4],
          '',
          ''
        ]);
      });

      rows.push([
        '',
        `TOTAL NILAI AKHIR (Maks. ${cat.maxPoints})`,
        '',
        '',
        '',
        '',
        '',
        `....... / ${cat.maxPoints}`,
        ''
      ]);

      rows.push(['']);
      rows.push(['', '', '', '', '', '', 'Tanda Tangan Juri:']);
      rows.push(['']);
      rows.push(['']);
      rows.push(['', '', '', '', '', '', '( ................................................ )']);

      const catWs = XLSX.utils.aoa_to_sheet(rows);
      catWs['!cols'] = [
        { wch: 6 },
        { wch: 42 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 22 },
        { wch: 20 },
        { wch: 30 }
      ];
      const sName = `Blanko ${cat.shortTitle}`.slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, catWs, sName);
    });

    XLSX.writeFile(
      workbook,
      `Master_Format_Blanko_Semua_11_Kriteria_Lomba_PBB_PKS_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast('Master format blanko seluruh 11 kriteria penilaian berhasil diunduh!');
  };

  // 6. Unduh Daftar Nama Peserta & Sekolah Terdaftar (.xlsx)
  const handleExportDaftarPesertaExcel = (filterJenjang: 'all' | 'SLTP' | 'SLTA' = 'all') => {
    if (pesertaList.length === 0) {
      showToast('Belum ada data peserta untuk diunduh!', 'error');
      return;
    }

    const filtered = pesertaList.filter(p => {
      if (filterJenjang === 'all') return true;
      return (p.jenjang || 'SLTP') === filterJenjang;
    });

    const rows: (string | number)[][] = [
      ['PANITIA PELAKSANA LOMBA PATROLI KEAMANAN SEKOLAH (PKS) TAHUN 2026'],
      ['DAFTAR RESMI NAMA PESERTA & KONTINGEN SEKOLAH TERDAFTAR'],
      [`Tingkat / Jenjang: ${filterJenjang === 'all' ? 'SEMUA TINGKAT (SLTP & SLTA)' : filterJenjang}`],
      [`Jumlah Kontingen: ${filtered.length} Peserta | Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`],
      [''],
      [
        'No.',
        'No. Peserta',
        'Jenjang / Tingkat',
        'Nama Sekolah / Instansi',
        'Nama Peleton / Regu',
        'Hari / Tanggal Tampil',
        'Nama Juri Penilai',
        'Kelengkapan Penilaian',
        'Total Nilai Sementara',
        'Persentase (%)',
        'Status Penilaian'
      ]
    ];

    filtered.forEach((p, idx) => {
      const calc = calculateAllCategories(p, categories);
      const isComplete = calc?.mandatoryCompleted;
      const count = calc?.completedCategoriesCount || 0;
      const total = categories.length;
      const grandTotal = calc?.grandTotal || 0;
      const pct = calc?.grandPct || 0;

      rows.push([
        idx + 1,
        p.nomor,
        p.jenjang || 'SLTP',
        p.sekolah,
        p.peleton || '-',
        p.tanggal,
        p.juri,
        `${count} / ${total} Kategori`,
        grandTotal,
        Number(pct.toFixed(2)),
        isComplete ? 'Selesai Dinilai (Lengkap)' : (count > 0 ? 'Sedang Berjalan' : 'Belum Dinilai')
      ]);
    });

    rows.push(['']);
    rows.push([
      '',
      '',
      '',
      `TOTAL KONTINGEN TERDAFTAR: ${filtered.length} SEKOLAH / REGU`,
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
    rows.push(['']);
    rows.push(['', '', '', '', '', '', '', '', 'Mengetahui,']);
    rows.push(['', '', '', '', '', '', '', '', 'Ketua Panitia Pelaksana']);
    rows.push(['']);
    rows.push(['']);
    rows.push(['', '', '', '', '', '', '', '', '( .................................................... )']);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },   // No
      { wch: 14 },  // No Peserta
      { wch: 18 },  // Jenjang
      { wch: 38 },  // Sekolah
      { wch: 25 },  // Peleton
      { wch: 22 },  // Tanggal
      { wch: 30 },  // Juri
      { wch: 24 },  // Kelengkapan
      { wch: 22 },  // Nilai
      { wch: 16 },  // Pct
      { wch: 28 }   // Status
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = filterJenjang === 'all' ? 'Daftar Peserta & Sekolah' : `Peserta ${filterJenjang}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

    XLSX.writeFile(
      workbook,
      `Daftar_Nama_Peserta_Sekolah_Lomba_PKS_${filterJenjang}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast(`Daftar ${filtered.length} nama peserta & sekolah (${filterJenjang.toUpperCase()}) berhasil diunduh!`);
  };

  // Selected participant for Print Modal
  const printTargetParticipant = useMemo(() => {
    if (!printPesertaId) return null;
    const target = pesertaList.find(p => p.id === printPesertaId);
    if (!target) return null;
    const calc = calculateAllCategories(target, categories);
    const itemInTable = overallStandingsData.find(t => t.id === target.id);
    return {
      ...target,
      calc,
      rank: itemInTable?.rank || null
    };
  }, [printPesertaId, pesertaList, categories, overallStandingsData]);

  // Navigate between categories (Next / Prev)
  const currentCategoryIndex = useMemo(() => {
    return categories.findIndex(c => c.key === currentTab);
  }, [categories, currentTab]);

  const handlePrevCategory = () => {
    if (currentCategoryIndex > 0) {
      setCurrentTab(categories[currentCategoryIndex - 1].key);
    }
  };

  const handleNextCategory = () => {
    if (currentCategoryIndex >= 0 && currentCategoryIndex < categories.length - 1) {
      setCurrentTab(categories[currentCategoryIndex + 1].key);
    }
  };

  // Selected Category Object in Rekap Kategori
  const rekapActiveCategoryObj = useMemo(() => {
    return categories.find(c => c.key === rekapSelectedCategoryKey) || categories[0];
  }, [categories, rekapSelectedCategoryKey]);

  // ==========================================
  // RENDER: APP MAINTENANCE / DEACTIVATED VIEW (IF APP IS DEACTIVATED & NOT SUPER ADMIN)
  // ==========================================
  if (!appStatus.isActive && !isSuperAdmin) {
    return (
      <AppMaintenanceView
        appStatus={appStatus}
        appLogo={appLogo}
        usersList={usersList}
        onAdminLoginSuccess={adminUser => {
          setCurrentUser(adminUser);
          try {
            sessionStorage.setItem(AUTH_KEY, JSON.stringify(adminUser));
          } catch {
            // ignore
          }
          setModalStatusOpen(true);
        }}
        showToast={showToast}
      />
    );
  }

  // ==========================================
  // RENDER: LOGIN & REGISTRATION SCREEN (IF NOT LOGGED IN)
  // ==========================================
  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-700/30 my-8">
          {/* Header Card with Custom Logo / Shield */}
          <div className="bg-slate-900 text-white text-center p-6 border-b border-slate-800 relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-white shadow-lg mb-3 p-2">
              {appLogo ? (
                <img src={appLogo} alt="Logo Aplikasi" className="w-full h-full object-contain" />
              ) : (
                <Shield className="w-8 h-8 text-blue-400" />
              )}
            </div>
            <h2 className="text-xl font-extrabold tracking-tight uppercase">Sistem Rekapitulasi Lomba PBB & PKS</h2>
            <p className="text-xs text-blue-300 font-medium mt-0.5">Penilaian Terpadu & Administrasi PKS (SLTP / SLTA)</p>

            {/* Segmented Tab: Masuk vs Daftar Sekolah */}
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl mt-4 max-w-xs mx-auto border border-slate-800">
              <button
                type="button"
                onClick={() => setAuthViewTab('login')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authViewTab === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> Masuk Akun
              </button>
              <button
                type="button"
                onClick={() => setAuthViewTab('register_sekolah')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  authViewTab === 'register_sekolah'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Daftar Sekolah
              </button>
            </div>
          </div>

          {isLoggingIn ? (
            /* ANIMASI LOADING KETIKA MASUK LOGIN */
            <div className="p-8 py-12 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Animated Avatar / Shield with Pulse Rings */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-blue-500/30 flex items-center justify-center shadow-xl shadow-blue-500/10">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-12 h-12 object-contain" />
                  ) : (
                    <Shield className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                {/* Rotating Spinner Rings */}
                <div className="absolute -inset-2.5 border-2 border-blue-600/20 border-t-blue-600 rounded-3xl animate-spin" />
                <div className="absolute -inset-1 border border-indigo-500/30 rounded-2xl animate-ping opacity-25" />
              </div>

              {/* Text Information */}
              <div className="space-y-2 max-w-xs">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span>Otentikasi Pengguna</span>
                </div>
                <h3 className="font-black text-slate-900 text-lg">
                  Memproses Masuk ke Sistem
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {loginStepText}
                </p>
              </div>

              {/* Animated Glowing Progress Bar */}
              <div className="w-56 h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full animate-pulse w-full transition-all duration-500" />
              </div>

              {/* Status Note */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Menghubungkan sesi & database lomba...</span>
              </div>
            </div>
          ) : authViewTab === 'login' ? (
            /* TAB 1: FORM LOGIN */
            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
              {loginError && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Username atau password tidak cocok! Silakan periksa kembali.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    disabled={isLoggingIn}
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    disabled={isLoggingIn}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{loginStepText}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Masuk ke Aplikasi
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthViewTab('register_sekolah')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  Belum punya akun? Daftarkan Sekolah Anda secara mandiri di sini →
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: FORM REGISTRASI MANDIRI SEKOLAH */
            <form onSubmit={handleRegisterSchool} className="p-6 space-y-3.5">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800">
                <p className="font-bold">Pendaftaran Akun Mandiri Perwakilan Sekolah</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Akun ini dapat digunakan untuk mengelola data peserta, kontingen, dan mengisi formulir pendaftaran resmi PKS untuk sekolah Anda.
                </p>
              </div>

              {regError && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-2.5 rounded-r text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Jenjang */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tingkat / Jenjang Sekolah</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegJenjang('SLTP')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      regJenjang === 'SLTP'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTP (SMP / MTs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegJenjang('SLTA')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      regJenjang === 'SLTA'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>SLTA (SMA / SMK / MA)</span>
                  </button>
                </div>
              </div>

              {/* Nama Lengkap Sekolah */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap Sekolah <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regSekolah}
                    onChange={e => setRegSekolah(e.target.value)}
                    placeholder="Contoh: SMP Negeri 2 Majalengka"
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Nama Pembina & Kontak WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Pembina / Pendamping</label>
                  <input
                    type="text"
                    value={regPembina}
                    onChange={e => setRegPembina(e.target.value)}
                    placeholder="Contoh: Hariyadi, S.Pd"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">No. WhatsApp / HP</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={regWa}
                      onChange={e => setRegWa(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Username Akun Sekolah <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="Gunakan huruf kecil tanpa spasi, contoh: smpn2majalengka"
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Password & Konfirmasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Konfirmasi Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegisteringSchool}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isRegisteringSchool ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Mendaftarkan & Menyiapkan Akun Sekolah...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" /> Daftarkan Akun Sekolah Sekarang
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthViewTab('login')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Sudah memiliki akun? Kembali ke menu Masuk →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }


  // ==========================================
  // RENDER: MAIN APPLICATION
  // ==========================================

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 animate-in fade-in duration-300">
      {/* 1. TOP NAVBAR */}
      <header className="bg-slate-900 text-white shadow sticky top-0 z-40 no-print border-b border-slate-800">
        <div className="px-3 sm:px-6 py-2.5">
          <div className="flex justify-between items-center gap-3">
            {/* Left: Mobile Toggle & Brand */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer lg:hidden"
                title="Buka Menu Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="hidden lg:flex p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer"
                title={sidebarCollapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                className="flex items-center space-x-2.5 cursor-pointer"
                onClick={() => setCurrentTab('dashboard')}
              >
                {appLogo ? (
                  <img
                    src={appLogo}
                    alt="Logo Aplikasi"
                    className="w-9 h-9 object-contain rounded-lg p-0.5 bg-white shrink-0 shadow"
                  />
                ) : (
                  <div className="bg-blue-600 p-2 rounded-lg text-white shadow shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h1 className="font-black text-sm sm:text-base tracking-tight leading-none text-white whitespace-nowrap">
                    E-REKAP LOMBA PBB & PKS
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-blue-300 font-medium tracking-wider mt-0.5 whitespace-nowrap">
                    SLTP & SLTA • REKAP JUARA & PENILAIAN JURI
                  </p>
                </div>
              </div>
            </div>

            {/* Center: Quick Active Participant Bar */}
            {activePeserta && (
              <div className="hidden md:flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs max-w-md truncate">
                <span className="text-slate-400 font-semibold text-[11px] shrink-0">Peserta:</span>
                <span className={`px-1.5 py-0.2 rounded font-black text-[10px] shrink-0 ${
                  activePeserta.jenjang === 'SLTA' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {activePeserta.jenjang || 'SLTP'}
                </span>
                <span className="font-bold text-white truncate">
                  No. {activePeserta.nomor} - {activePeserta.peleton ? `${activePeserta.peleton} (${activePeserta.sekolah})` : activePeserta.sekolah}
                </span>
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  <button
                    onClick={handlePrevPeserta}
                    title="Peserta Sebelumnya"
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextPeserta}
                    title="Peserta Berikutnya"
                    className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Right: User Profile & Actions */}
            <div className="flex items-center space-x-2">
              {/* Cloud Real-Time Sync Indicator */}
              <button
                type="button"
                onClick={() => setModalCloudInfoOpen(true)}
                title="Status Sinkronisasi Cloud Firestore Multi-Perangkat"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer shrink-0 ${
                  cloudStatus === 'connected'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                    : cloudStatus === 'connecting'
                    ? 'bg-amber-950/70 border-amber-500/40 text-amber-300 animate-pulse'
                    : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  cloudStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : cloudStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <Cloud className="w-3.5 h-3.5 text-current shrink-0" />
                <span className="hidden md:inline">
                  {cloudStatus === 'connected' ? 'Cloud Aktif' : cloudStatus === 'connecting' ? 'Menghubungkan...' : 'Offline'}
                </span>
              </button>

              {/* Admin App Status Toggle Button (Khusus Administrator Utama) */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setModalStatusOpen(true)}
                  title="Kontrol Status Operasional Aplikasi (Aktivasi / Nonaktifkan)"
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer shrink-0 ${
                    appStatus.isActive
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-md'
                  }`}
                >
                  <Power className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {appStatus.isActive ? 'Aplikasi Aktif' : 'DINONAKTIFKAN'}
                  </span>
                </button>
              )}

              <div className="hidden sm:flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-xs">
                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="text-left">
                  <span className="font-bold text-white block leading-tight text-xs truncate max-w-[140px]">{currentUser.name}</span>
                  <span className="text-[9px] uppercase font-bold text-blue-300 tracking-wider">
                    {isSuperAdmin
                      ? 'ADMINISTRATOR UTAMA'
                      : currentUser.role === 'admin'
                      ? 'ADMIN PANITIA (TERBATAS)'
                      : currentUser.role === 'juri'
                      ? 'JURI LAPANGAN'
                      : currentUser.role === 'sekolah'
                      ? (currentUser.schoolName ? `SEKOLAH: ${currentUser.schoolName}` : 'AKUN SEKOLAH')
                      : 'TAMU (READ-ONLY)'}
                  </span>
                </div>
              </div>

              {!isUserRole && (
                <button
                  onClick={openNewPesertaModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition cursor-pointer shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tambah Peserta</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                title="Keluar Akun"
                className="bg-rose-600/80 hover:bg-rose-600 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Prominent Admin Warning Strip when app is deactivated */}
      {!appStatus.isActive && isSuperAdmin && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-lg border-b border-rose-700 z-30 no-print">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300 animate-bounce" />
            <span>
              <strong>PERINGATAN ADMINISTRATOR:</strong> Aplikasi saat ini sedang <u>DINONAKTIFKAN</u> untuk umum, juri, dan sekolah. Hanya Anda (Administrator) yang dapat mengakses sistem ini.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveAppStatus({ ...appStatus, isActive: true })}
              className="bg-white text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-lg text-[11px] font-black uppercase transition cursor-pointer shadow-xs"
            >
              Aktifkan Sekarang
            </button>
            <button
              type="button"
              onClick={() => setModalStatusOpen(true)}
              className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border border-rose-400"
            >
              Atur Pesan Kustom
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN LAYOUT: SIDEBAR + CONTENT VIEWPORT */}
      <div className="flex-1 flex min-h-[calc(100vh-4rem)] relative">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden no-print"
          />
        )}

        {/* SIDEBAR NAVIGATION */}
        <aside
          ref={sidebarNavRef}
          className={`no-print bg-slate-900 border-r border-slate-800 text-slate-200 transition-all duration-200 z-40 flex flex-col shrink-0 ${
            sidebarOpen
              ? 'fixed inset-y-0 left-0 w-72 sm:w-80 shadow-2xl flex h-full pt-0 z-50'
              : 'hidden lg:flex'
          } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72 xl:w-80'}`}
        >
          {/* Mobile Sidebar Close Button Header */}
          <div className="flex lg:hidden items-center justify-between p-3 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black uppercase text-white">Menu Navigasi Lomba</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar">
            {/* Top Shortcut: Dashboard Ringkasan */}
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setSidebarOpen(false);
                closeAllSidebarDropdowns();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate">{isUserRole ? 'Data Mentah Peserta' : 'Dashboard Ringkasan'}</span>
              )}
            </button>

            {/* ---------------------------------------------------- */}
            {/* DROPDOWN 1: PILIHAN KATEGORI PENILAIAN */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleSidebarDropdown('cat')}
                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="text-left truncate">
                      <span className="block font-bold text-white text-xs">Kategori Penilaian</span>
                      <span className="text-[10px] text-slate-400 font-normal">11 Mata Lomba</span>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded">
                      {activeCalc?.completedCategoriesCount || 0}/11
                    </span>
                    {sidebarCatDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                )}
              </button>

              {(!sidebarCollapsed && sidebarCatDropdownOpen) && (
                <div className="p-2 pt-0 space-y-3 border-t border-slate-800/60">
                  {(['PBB & Variasi', 'Lantas & Lapangan', 'Kreasi & Khusus'] as const).map(groupName => (
                    <div key={groupName} className="space-y-1">
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-500 px-2 pt-2">
                        {groupName}
                      </div>
                      {categories.filter(c => c.group === groupName).map(cat => {
                        const isDone = activeCalc?.categorySummaries[cat.key]?.isComplete;
                        const score = activeCalc?.categorySummaries[cat.key]?.sum || 0;
                        const isCurrent = currentTab === cat.key;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => {
                              setCurrentTab(cat.key);
                              setSidebarOpen(false);
                              closeAllSidebarDropdowns();
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                              isCurrent
                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isDone ? (
                                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-400'}`} />
                              ) : (
                                <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-white' : 'bg-slate-600'}`} />
                              )}
                              <span className="truncate">{cat.shortTitle || cat.title}</span>
                            </div>
                            <span className={`text-[10px] tabular-nums shrink-0 ml-1 ${isCurrent ? 'text-blue-100 font-bold' : 'text-slate-400'}`}>
                              {score}/{cat.maxPoints}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* DROPDOWN 2: NAMA-NAMA PESERTA & SEKOLAH */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleSidebarDropdown('peserta')}
                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="text-left truncate">
                      <span className="block font-bold text-white text-xs">Nama-Nama Peserta</span>
                      <span className="text-[10px] text-slate-400 font-normal">Daftar Kontingen</span>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded">
                      {pesertaList.length}
                    </span>
                    {sidebarPesertaDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                )}
              </button>

              {(!sidebarCollapsed && sidebarPesertaDropdownOpen) && (
                <div className="p-2.5 pt-0 space-y-2 border-t border-slate-800/60">
                  {/* Search Input */}
                  <div className="relative mt-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={sidebarPesertaSearch}
                      onChange={e => setSidebarPesertaSearch(e.target.value)}
                      placeholder="Cari nomor / sekolah..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {sidebarPesertaSearch && (
                      <button
                        onClick={() => setSidebarPesertaSearch('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Jenjang Segmented Filter */}
                  <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg text-[10px]">
                    {(['all', 'SLTP', 'SLTA'] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setSidebarPesertaJenjang(lvl)}
                        className={`flex-1 py-1 rounded font-bold transition cursor-pointer ${
                          sidebarPesertaJenjang === lvl
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lvl === 'all' ? 'Semua' : lvl}
                      </button>
                    ))}
                  </div>

                  {/* List Peserta */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {filteredSidebarPeserta.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500">
                        Tidak ada peserta sesuai filter
                      </div>
                    ) : (
                      filteredSidebarPeserta.map(p => {
                        const isCurrentActive = p.id === activePesertaId;
                        const summary = pesertaSummariesMap[p.id];
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setActivePesertaId(p.id);
                              setSidebarOpen(false);
                              closeAllSidebarDropdowns();
                            }}
                            className={`w-full text-left p-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-between gap-2 border ${
                              isCurrentActive
                                ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                                : 'border-slate-800/80 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                  p.jenjang === 'SLTA' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
                                }`}>
                                  {p.jenjang || 'SLTP'}
                                </span>
                                <span className="font-bold text-slate-100">No. {p.nomor}</span>
                              </div>
                              <div className="truncate text-[11px] text-slate-300">
                                {p.peleton ? `${p.peleton} - ${p.sekolah}` : p.sekolah}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-bold block tabular-nums text-amber-300">
                                {summary?.totalPoints || 0} pts
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {summary?.completedCats || 0}/11
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Actions inside Peserta dropdown */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    {!isUserRole && (
                      <button
                        onClick={() => {
                          openNewPesertaModal();
                          closeAllSidebarDropdowns();
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> + Tambah Peserta Baru
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleExportDaftarPesertaExcel('all');
                        closeAllSidebarDropdowns();
                      }}
                      className="w-full bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> Unduh Daftar Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => {
                        setModalDaftarPesertaOpen(true);
                        closeAllSidebarDropdowns();
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-400" /> Kelola Tabel Peserta
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* DROPDOWN 3: REKAPITULASI & PERINGKAT */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleSidebarDropdown('rekap')}
                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="text-left truncate">
                      <span className="block font-bold text-white text-xs">Rekapitulasi</span>
                      <span className="text-[10px] text-slate-400 font-normal">Juara & Peringkat</span>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      Podium
                    </span>
                    {sidebarRekapDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                )}
              </button>

              {(!sidebarCollapsed && sidebarRekapDropdownOpen) && (
                <div className="p-2 pt-0 space-y-1 border-t border-slate-800/60 mt-1">
                  {isUserRole ? (
                    <div className="p-2.5 bg-slate-900 rounded-lg text-[11px] text-amber-300 leading-relaxed border border-slate-800">
                      <Eye className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                      Mode Tamu: Rekapitulasi juara hanya dapat diakses oleh Panitia & Juri.
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setCurrentTab('rekap');
                          setRekapViewMode('umum');
                          setSidebarOpen(false);
                          closeAllSidebarDropdowns();
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                          currentTab === 'rekap' && rekapViewMode === 'umum'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Klasemen Juara Umum</span>
                      </button>

                      <button
                        onClick={() => {
                          setCurrentTab('rekap');
                          setRekapViewMode('kategori');
                          setSidebarOpen(false);
                          closeAllSidebarDropdowns();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                          currentTab === 'rekap' && rekapViewMode === 'kategori'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Medal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">Peringkat Per Kategori</span>
                        </div>
                      </button>

                      {currentTab === 'rekap' && rekapViewMode === 'kategori' && (
                        <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-amber-500/40 ml-3">
                          {categories.map(c => (
                            <button
                              key={c.key}
                              onClick={() => {
                                setRekapSelectedCategoryKey(c.key);
                                closeAllSidebarDropdowns();
                              }}
                              className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition cursor-pointer ${
                                rekapSelectedCategoryKey === c.key
                                  ? 'bg-amber-500/25 text-amber-300 font-bold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              • {c.shortTitle || c.title}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setCurrentTab('rekap');
                          setRekapViewMode('ringkasan');
                          setSidebarOpen(false);
                          closeAllSidebarDropdowns();
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                          currentTab === 'rekap' && rekapViewMode === 'ringkasan'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Podium Juara 1-2-3</span>
                      </button>

                      <button
                        onClick={() => {
                          handleExportExcelMasterWorkbook();
                          closeAllSidebarDropdowns();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200 border border-emerald-700/40 transition cursor-pointer font-bold mt-1"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Ekspor Multi-Sheet (.xlsx)</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* DROPDOWN 4: FORMULIR PENDAFTARAN RESMI PKS */}
            {/* ---------------------------------------------------- */}
            <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleSidebarDropdown('form')}
                className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="text-left truncate">
                      <span className="block font-bold text-white text-xs">Form Pendaftaran PKS</span>
                      <span className="text-[10px] text-slate-400 font-normal">Blanko & Pendaftaran</span>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                      4 Form
                    </span>
                    {sidebarFormDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                )}
              </button>

              {(!sidebarCollapsed && sidebarFormDropdownOpen) && (
                <div className="p-2 pt-0 space-y-1 border-t border-slate-800/60 mt-1">
                  <button
                    onClick={() => {
                      setCurrentTab('form_polisi_pelajar');
                      setSidebarOpen(false);
                      closeAllSidebarDropdowns();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                      currentTab === 'form_polisi_pelajar'
                        ? 'bg-indigo-600 text-white font-black shadow'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">1. Polisi Pelajar (Poljar)</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTab('form_calon_pks');
                      setSidebarOpen(false);
                      closeAllSidebarDropdowns();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                      currentTab === 'form_calon_pks'
                        ? 'bg-indigo-600 text-white font-black shadow'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">2. Calon Anggota PKS</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTab('form_perkemahan_balok1');
                      setSidebarOpen(false);
                      closeAllSidebarDropdowns();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                      currentTab === 'form_perkemahan_balok1'
                        ? 'bg-indigo-600 text-white font-black shadow'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">3. Perkemahan PKS Balok 1</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTab('form_perkemahan_balok2');
                      setSidebarOpen(false);
                      closeAllSidebarDropdowns();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                      currentTab === 'form_perkemahan_balok2'
                        ? 'bg-indigo-600 text-white font-black shadow'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">4. Pendaftaran PKS Balok 2</span>
                  </button>
                </div>
              )}
            </div>

            {/* Menu Alat & Master Blanko Juri */}
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <button
                onClick={() => {
                  setBlankSheetCatKey('pbb');
                  setModalBlankSheetOpen(true);
                  closeAllSidebarDropdowns();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Format Blanko Juri Penilaian</span>}
              </button>

              {/* Menu Operasional Admin (Dapat diakses Super Admin & Admin Panitia) */}
              {isAdminRole && (
                <>
                  <button
                    onClick={() => {
                      setCurrentTab('rekap_pendaftaran');
                      setSidebarOpen(false);
                      closeAllSidebarDropdowns();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer font-bold ${
                      currentTab === 'rekap_pendaftaran'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-blue-400 hover:text-blue-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">Rekap Pendaftaran Sekolah</span>}
                    </div>
                    {!sidebarCollapsed && registrationsList.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/30 text-blue-200">
                        {registrationsList.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setModalPaymentSettingsOpen(true);
                      closeAllSidebarDropdowns();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer font-bold"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Tarif Biaya & Payment Gateway</span>}
                  </button>

                  <button
                    onClick={() => {
                      setModalBlankoEditorOpen(true);
                      closeAllSidebarDropdowns();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer font-bold"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Edit Format Blangko</span>}
                  </button>

                  <button
                    onClick={() => {
                      setModalSchoolAccountsOpen(true);
                      closeAllSidebarDropdowns();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition cursor-pointer font-bold"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Kelola Akun Sekolah</span>}
                  </button>

                  <button
                    onClick={() => {
                      setUserFormTab('list');
                      setModalUserOpen(true);
                      closeAllSidebarDropdowns();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Kelola User & Password</span>}
                  </button>

                  <button
                    onClick={handleExportJson}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Cadangkan Data (JSON)</span>}
                  </button>
                </>
              )}

              {/* Menu Khusus Administrator Utama (Super Admin Master Controls) */}
              {isSuperAdmin && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  {!sidebarCollapsed && (
                    <div className="px-2 pb-0.5 text-[9px] font-black uppercase text-amber-400/90 tracking-wider flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5 text-amber-400" />
                      <span>Kontrol Master Administrator</span>
                    </div>
                  )}

                  <button
                    onClick={() => setModalStatusOpen(true)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      appStatus.isActive
                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800'
                        : 'text-rose-400 bg-rose-950/40 hover:bg-rose-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Power className={`w-3.5 h-3.5 shrink-0 ${appStatus.isActive ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`} />
                      {!sidebarCollapsed && <span className="truncate">Status Operasional Aplikasi</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        appStatus.isActive ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-600 text-white'
                      }`}>
                        {appStatus.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setModalLogoOpen(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-amber-300 hover:text-amber-200 hover:bg-slate-800 transition cursor-pointer font-semibold"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Ubah Logo Aplikasi</span>}
                  </button>

                  <button
                    onClick={() => {
                      setTempCategoriesConfig([...categories]);
                      setModalConfigOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Atur Juknis Nilai Maksimal</span>}
                  </button>

                  <label className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer font-medium">
                    <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Pulihkan Data (JSON)</span>}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".json"
                      onChange={handleImportJson}
                    />
                  </label>

                  <button
                    onClick={handleResetAllData}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 transition cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Reset Semua Data</span>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Footer: Active User & Logout */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300 font-bold text-xs shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 truncate">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] uppercase font-semibold text-blue-400">
                    {isSuperAdmin
                      ? 'SUPER ADMIN'
                      : currentUser.role === 'admin'
                      ? 'ADMIN TERBATAS'
                      : currentUser.role}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* CONTENT VIEWPORT WRAPPER */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Read-Only Notice for User Role */}
          {isUserRole && (
            <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs text-center border-b border-amber-600 no-print flex items-center justify-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" /> Anda masuk sebagai Akun Tamu / User (Mode Hanya Lihat). Perubahan data dan penginputan nilai dinonaktifkan.
            </div>
          )}

          {/* Context sub-bar for Active Participant & Quick Details */}
          {activePeserta && (
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 shadow-2xs no-print flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Peserta Aktif:</span>
                <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                  activePeserta.jenjang === 'SLTA' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {activePeserta.jenjang || 'SLTP'}
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  No. {activePeserta.nomor} - {activePeserta.peleton ? `${activePeserta.peleton} (${activePeserta.sekolah})` : activePeserta.sekolah}
                </span>
                {!isUserRole && (
                  <button
                    onClick={() => openEditPesertaModal(activePeserta)}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Data
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" /> {activePeserta.tanggal}
                </span>
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Juri: {activePeserta.juri}
                </span>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setModalDaftarPesertaOpen(true)}
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" /> Semua Peserta
                </button>
                <button
                  onClick={() => handleExportDaftarPesertaExcel('all')}
                  className="font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Excel
                </button>
              </div>
            </div>
          )}

          {/* 3. MAIN CONTENT CONTAINER */}
          <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full ${(modalPrintOpen || modalBlankSheetOpen || modalDaftarPesertaOpen) ? 'no-print' : ''}`}>

        {/* ==================================================== */}
        {/* TAB 1: DASHBOARD DENGAN SAMBUTAN PENGGUNA & CHART PROGRES PENILAIAN */}
        {/* ==================================================== */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 1. SAMBUTAN PENGGUNA YANG LOGIN */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-8">
                <Shield className="w-64 h-64 text-blue-400" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {isSuperAdmin
                        ? 'Administrator Utama (Super Admin)'
                        : currentUser.role === 'admin'
                        ? 'Admin Panitia (Akses Terbatas)'
                        : currentUser.role === 'juri'
                        ? 'Juri Lapangan'
                        : currentUser.role === 'sekolah'
                        ? 'Perwakilan Resmi Sekolah'
                        : 'Akun Tamu / Peninjau'}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-full text-xs font-semibold">
                      Sistem Aktif
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Selamat Datang, {currentUser.name}!
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Sistem Rekapitulasi & Penilaian Digital Lomba Baris-Berbaris (PBB) dan Patroli Keamanan Sekolah (PKS) Tingkat SLTP & SLTA.
                    {currentUser.role === 'sekolah' && currentUser.schoolName && (
                      <span className="block mt-1 text-blue-200 font-semibold">
                        Kontingen Sekolah Terdaftar: <strong>{currentUser.schoolName}</strong> ({currentUser.schoolLevel || 'SLTP'}).
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/80 p-4 rounded-xl text-xs space-y-2 shrink-0 md:min-w-[240px]">
                  <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    Informasi Sesi Login
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-200">
                    <span className="text-slate-400">Pengguna:</span>
                    <strong className="text-white truncate">{currentUser.username}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-200">
                    <span className="text-slate-400">Waktu:</span>
                    <span className="font-medium text-slate-300">
                      {new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }).format(new Date())}
                    </span>
                  </div>
                  {currentUser.role === 'sekolah' && currentUser.contactWa && (
                    <div className="flex items-center justify-between gap-3 text-slate-200">
                      <span className="text-slate-400">Kontak WA:</span>
                      <span className="font-mono text-emerald-400">{currentUser.contactWa}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 4 KARTU STATISTIK RINGKASAN PENILAIAN SEKOLAH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Sekolah Terdaftar */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Sekolah Terdaftar
                  </span>
                  <div className="text-3xl font-black text-slate-900 tabular-nums">
                    {dashboardProgressStats.totalRegistered}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Kontingen dalam basis data
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Sudah Selesai 100% */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                    Selesai Dinilai
                  </span>
                  <div className="text-3xl font-black text-emerald-700 tabular-nums">
                    {dashboardProgressStats.completedCount}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {dashboardProgressStats.totalRegistered > 0
                      ? `${Math.round((dashboardProgressStats.completedCount / dashboardProgressStats.totalRegistered) * 100)}% dari total sekolah`
                      : 'Belum ada data'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Belum Selesai / Belum Dinilai */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block mb-1">
                    Belum Selesai
                  </span>
                  <div className="text-3xl font-black text-amber-600 tabular-nums">
                    {dashboardProgressStats.inProgressCount + dashboardProgressStats.unscoredCount}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {dashboardProgressStats.inProgressCount} proses, {dashboardProgressStats.unscoredCount} kosong
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Persentase Progres */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                    Progres Penilaian
                  </span>
                  <div className="text-3xl font-black text-indigo-700 tabular-nums">
                    {dashboardProgressStats.completionRate}%
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dashboardProgressStats.completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* 3. CHART PROGRES PENILAIAN SEKOLAH (DONUT + MULTI-SEGMENT BAR) */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-blue-600" />
                    Grafik Progres Penilaian Berdasarkan Sekolah Terdaftar
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visualisasi sekolah yang sudah selesai (11/11 kategori), sedang berjalan, dan belum diisi nilai
                  </p>
                </div>

                {/* Filter Jenjang & Pencarian */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                    {(['all', 'SLTP', 'SLTA'] as const).map(j => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setDashFilterJenjang(j)}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          dashFilterJenjang === j
                            ? 'bg-white text-blue-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {j === 'all' ? 'Semua Jenjang' : j}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={dashSearchSekolah}
                      onChange={e => setDashSearchSekolah(e.target.value)}
                      placeholder="Cari sekolah..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-44"
                    />
                  </div>
                </div>
              </div>

              {/* Chart Visualizations Container */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* SVG Donut Chart (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-4">
                  <div className="relative w-48 h-48">
                    {(() => {
                      const total = dashboardProgressStats.totalRegistered || 1;
                      const cPct = dashboardProgressStats.completedCount / total;
                      const pPct = dashboardProgressStats.inProgressCount / total;
                      const uPct = dashboardProgressStats.unscoredCount / total;

                      const circ = 2 * Math.PI * 65; // ~408.4
                      const cDash = cPct * circ;
                      const pDash = pPct * circ;
                      const uDash = uPct * circ;

                      const cOffset = 0;
                      const pOffset = -cDash;
                      const uOffset = -(cDash + pDash);

                      return (
                        <>
                          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                            {/* Background Track */}
                            <circle
                              cx="80"
                              cy="80"
                              r="65"
                              fill="none"
                              stroke="#f1f5f9"
                              strokeWidth="16"
                            />
                            {/* Segment 1: Completed (Emerald) */}
                            {dashboardProgressStats.completedCount > 0 && (
                              <circle
                                cx="80"
                                cy="80"
                                r="65"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="16"
                                strokeDasharray={`${cDash} ${circ - cDash}`}
                                strokeDashoffset={cOffset}
                                className="transition-all duration-700"
                              />
                            )}
                            {/* Segment 2: In Progress (Amber) */}
                            {dashboardProgressStats.inProgressCount > 0 && (
                              <circle
                                cx="80"
                                cy="80"
                                r="65"
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="16"
                                strokeDasharray={`${pDash} ${circ - pDash}`}
                                strokeDashoffset={pOffset}
                                className="transition-all duration-700"
                              />
                            )}
                            {/* Segment 3: Unscored (Slate/Rose) */}
                            {dashboardProgressStats.unscoredCount > 0 && (
                              <circle
                                cx="80"
                                cy="80"
                                r="65"
                                fill="none"
                                stroke="#cbd5e1"
                                strokeWidth="16"
                                strokeDasharray={`${uDash} ${circ - uDash}`}
                                strokeDashoffset={uOffset}
                                className="transition-all duration-700"
                              />
                            )}
                          </svg>

                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-slate-900 tracking-tight">
                              {dashboardProgressStats.completionRate}%
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Selesai
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {dashboardProgressStats.completedCount}/{dashboardProgressStats.totalRegistered} Sekolah
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Legend & Breakdown Stats (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Multi-segment linear progress bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                      <span>Distribusi Status Penilaian</span>
                      <span>Total {dashboardProgressStats.totalRegistered} Sekolah</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      {dashboardProgressStats.totalRegistered > 0 ? (
                        <>
                          <div
                            style={{
                              width: `${(dashboardProgressStats.completedCount / dashboardProgressStats.totalRegistered) * 100}%`
                            }}
                            className="bg-emerald-500 transition-all duration-500"
                            title={`Selesai: ${dashboardProgressStats.completedCount}`}
                          />
                          <div
                            style={{
                              width: `${(dashboardProgressStats.inProgressCount / dashboardProgressStats.totalRegistered) * 100}%`
                            }}
                            className="bg-amber-500 transition-all duration-500"
                            title={`Sedang Berjalan: ${dashboardProgressStats.inProgressCount}`}
                          />
                          <div
                            style={{
                              width: `${(dashboardProgressStats.unscoredCount / dashboardProgressStats.totalRegistered) * 100}%`
                            }}
                            className="bg-slate-300 transition-all duration-500"
                            title={`Belum Dinilai: ${dashboardProgressStats.unscoredCount}`}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-slate-200" />
                      )}
                    </div>
                  </div>

                  {/* 3 Detail Legend Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* Selesai 100% */}
                    <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-emerald-950">Sudah Selesai</span>
                      </div>
                      <div className="text-xl font-black text-emerald-800">
                        {dashboardProgressStats.completedCount} <span className="text-xs font-normal text-emerald-700">Sekolah</span>
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        Lengkap dinilai 11 dari 11 mata lomba
                      </p>
                    </div>

                    {/* Sedang Berjalan */}
                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-amber-950">Sedang Berjalan</span>
                      </div>
                      <div className="text-xl font-black text-amber-800">
                        {dashboardProgressStats.inProgressCount} <span className="text-xs font-normal text-amber-700">Sekolah</span>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        Sebagian kategori telah dinilai (1 - 10)
                      </p>
                    </div>

                    {/* Belum Diisi Nilai */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-900">Belum Dinilai</span>
                      </div>
                      <div className="text-xl font-black text-slate-700">
                        {dashboardProgressStats.unscoredCount} <span className="text-xs font-normal text-slate-600">Sekolah</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Menunggu penilaian juri di lapangan
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TABEL DAFTAR SEKOLAH & PROGRES PENILAIAN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" />
                    Status Penilaian Berdasarkan Sekolah Terdaftar
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rincian progres pengisian nilai untuk setiap peserta dan asal sekolah
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isAdminRole && (
                    <button
                      onClick={() => setModalSchoolAccountsOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Building2 className="w-3.5 h-3.5" /> Kelola Akun Sekolah
                    </button>
                  )}
                  <button
                    onClick={() => handleExportDaftarPesertaExcel('all')}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh Daftar Excel
                  </button>
                  {!isUserRole && (
                    <button
                      onClick={openNewPesertaModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Tambah Peserta
                    </button>
                  )}
                </div>
              </div>

              {dashboardProgressStats.schoolProgressList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Tidak ada data sekolah yang sesuai dengan filter pencarian.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">No. Peserta</th>
                        <th className="py-3 px-4">Asal Sekolah & Peleton</th>
                        <th className="py-3 px-3 text-center">Jenjang</th>
                        <th className="py-3 px-4">Progres Penilaian</th>
                        <th className="py-3 px-4 text-center">Total Nilai</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dashboardProgressStats.schoolProgressList.map(item => {
                        const p = item.participant;
                        const isCurrentActive = p.id === activePesertaId;

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-blue-50/40 transition ${
                              isCurrentActive ? 'bg-blue-50/70 font-medium' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-black text-slate-900">
                              <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md font-mono">
                                No. {p.nomor}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{p.sekolah}</div>
                              {p.peleton && (
                                <div className="text-[11px] text-slate-500">Peleton: {p.peleton}</div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-white ${
                                  p.jenjang === 'SLTA' ? 'bg-indigo-600' : 'bg-blue-600'
                                }`}
                              >
                                {p.jenjang || 'SLTP'}
                              </span>
                            </td>

                            <td className="py-3 px-4 min-w-[180px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-semibold text-slate-700">
                                  {item.completedCats} / 11 Kategori
                                </span>
                                <span className="font-mono text-slate-500">
                                  {item.pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    item.isComplete
                                      ? 'bg-emerald-500'
                                      : item.completedCats > 0
                                      ? 'bg-amber-500'
                                      : 'bg-slate-300'
                                  }`}
                                  style={{ width: `${(item.completedCats / 11) * 100}%` }}
                                />
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center font-black text-sm tabular-nums text-slate-900">
                              {item.grandTotal > 0 ? (
                                <span className="text-blue-600">{item.grandTotal}</span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              {item.isComplete ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Selesai 100%
                                </span>
                              ) : item.completedCats > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3 text-amber-600" /> Proses ({item.completedCats}/11)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  Belum Diisi
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePesertaId(p.id);
                                    setCurrentTab('pbb');
                                  }}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                                  title="Buka form penilaian untuk peserta ini"
                                >
                                  Nilai
                                </button>
                                {!isUserRole && (
                                  <button
                                    type="button"
                                    onClick={() => openEditPesertaModal(p)}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                                    title="Edit data sekolah/peserta"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
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

        {/* ==================================================== */}
        {/* TAB DINAMIS: LEMBAR PENILAIAN DENGAN DROPDOWN */}
        {/* ==================================================== */}
        {activeCategory && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                      {activeCategory.group}
                    </span>
                    {activeCategory.isMandatory && (
                      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                        Kategori Wajib
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    {activeCategory.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeCategory.criteria.length} Butir Kriteria • Pilihan Nilai: KS (Kurang Sekali), K (Kurang), C (Cukup), B (Baik), A (Sangat Baik / Maksimal).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold uppercase">Subtotal Diperoleh:</span>
                    <div className="text-2xl font-black text-blue-700 tabular-nums">
                      {activeCalc?.categorySummaries[activeCategory.key]?.sum || 0}{' '}
                      <span className="text-slate-400 text-sm font-semibold">
                        / {activeCategory.maxPoints}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-600">
                      ({(activeCalc?.categorySummaries[activeCategory.key]?.pct || 0).toFixed(2)}%)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Tombol Unduh Format Blanko Excel untuk Kategori ini */}
                    <button
                      onClick={() => handleDownloadBlankScoreSheet(activeCategory.key)}
                      title="Download format blanko Excel (.xlsx) untuk mata lomba ini"
                      className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Format Blanko (.xlsx)</span>
                    </button>

                    {/* Tombol Cetak / Pratinjau Lembar Blanko */}
                    <button
                      onClick={() => {
                        setBlankSheetCatKey(activeCategory.key);
                        setModalBlankSheetOpen(true);
                      }}
                      title="Pratinjau & Cetak Lembar Form Penilaian Kosong"
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>Cetak Blanko</span>
                    </button>

                    {/* Tombol Lihat Foto Form Terlampir (Bisa dilihat Juri, Admin, & Tamu) */}
                    {activePeserta?.formPhotos?.[activeCategory.key]?.url && (
                      <button
                        onClick={() => handleOpenViewPhoto(activeCategory.key)}
                        title="Lihat foto bukti lembar fisik form penilaian juri"
                        className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        <span>Foto Form Juri</span>
                      </button>
                    )}

                    {/* Tombol Upload & Scan Foto Form (Khusus Juri & Admin) */}
                    {!isUserRole && (
                      <>
                        <button
                          onClick={() => {
                            setScanPreviewUrl(null);
                            setScanFileName('');
                            setScanError(null);
                            setScannedResult(null);
                            setModalScanOpen(true);
                          }}
                          className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-amber-300" />
                          <span>Upload Foto Form</span>
                        </button>

                        <button
                          onClick={() => handleResetCategory(activeCategory.key)}
                          className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Banner Penjelasan Khusus Akun Tamu (Data Mentah) */}
              {isUserRole && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-medium">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Mode Akun Tamu:</strong> Menampilkan <strong>data mentah</strong> penilaian kriteria asli yang diinput juri untuk peserta <strong>{activePeserta?.sekolah}</strong> ({activePeserta?.peleton || `No. ${activePeserta?.nomor}`}).
                    </span>
                  </div>
                  <span className="bg-amber-200/80 text-amber-950 font-black px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    Data Mentah Belum Direkap
                  </span>
                </div>
              )}

              {/* Toolbar Dropdown Kategori & Filter Kriteria */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevCategory}
                    disabled={currentCategoryIndex <= 0}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Kategori Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 hidden sm:inline">Pindah Kategori:</span>
                    <select
                      value={activeCategory.key}
                      onChange={e => setCurrentTab(e.target.value)}
                      className="bg-white border border-slate-300 text-slate-900 text-xs font-bold py-1.5 px-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      {categories.map((c, i) => (
                        <option key={c.key} value={c.key}>
                          {i + 1}. {c.title} (Max {c.maxPoints})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleNextCategory}
                    disabled={currentCategoryIndex >= categories.length - 1}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Kategori Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Filter Kriteria:
                  </span>
                  <select
                    value={criteriaFilter}
                    onChange={e => setCriteriaFilter(e.target.value as any)}
                    className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold py-1.5 px-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">Semua Kriteria ({activeCategory.criteria.length})</option>
                    <option value="unscored">Hanya yang Belum Dinilai</option>
                    <option value="scored">Hanya yang Sudah Dinilai</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assessment Table with Dropdown Selectors & Radio Buttons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-white uppercase text-xs tracking-wider">
                    <tr>
                      <th className="py-3.5 px-3 text-center w-12">No</th>
                      <th className="py-3.5 px-4">Kriteria Penilaian</th>
                      <th className="py-3.5 px-3 text-center w-52 bg-slate-800">
                        Pilihan Dropdown<br />
                        <span className="text-[10px] text-blue-300 font-normal">Pilih Nilai Cepat</span>
                      </th>
                      <th className="py-3.5 px-2 text-center w-20">KS</th>
                      <th className="py-3.5 px-2 text-center w-20">K</th>
                      <th className="py-3.5 px-2 text-center w-20">C</th>
                      <th className="py-3.5 px-2 text-center w-20">B</th>
                      <th className="py-3.5 px-2 text-center w-20">A</th>
                      <th className="py-3.5 px-4 text-center w-24 bg-slate-950 text-amber-400">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {activeCategory.criteria
                      .filter(c => {
                        const score = activePeserta?.scores?.[activeCategory.key]?.[c.no];
                        if (criteriaFilter === 'unscored') return score === undefined || score === null;
                        if (criteriaFilter === 'scored') return score !== undefined && score !== null;
                        return true;
                      })
                      .map(c => {
                        const selectedVal = activePeserta?.scores?.[activeCategory.key]?.[c.no];
                        const isScored = selectedVal !== undefined && selectedVal !== null;

                        return (
                          <tr key={c.no} className="hover:bg-blue-50/40 transition">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{c.no}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              <span>{c.name}</span>
                              {!isScored && (
                                <span className="text-[10px] text-amber-600 font-bold block sm:hidden">
                                  Belum dinilai
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center bg-slate-50/70">
                              <select
                                disabled={isUserRole}
                                value={isScored ? String(selectedVal) : ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? null : Number(e.target.value);
                                  handleScoreSelect(activeCategory.key, c.no, val);
                                }}
                                className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold border transition outline-none cursor-pointer ${
                                  isScored
                                    ? 'bg-blue-50 text-blue-800 border-blue-400'
                                    : 'bg-white text-slate-500 border-slate-300'
                                }`}
                              >
                                <option value="">-- Pilih Nilai --</option>
                                <option value={c.weights[0]}>KS - Kurang Sekali ({c.weights[0]} pt)</option>
                                <option value={c.weights[1]}>K - Kurang ({c.weights[1]} pt)</option>
                                <option value={c.weights[2]}>C - Cukup ({c.weights[2]} pt)</option>
                                <option value={c.weights[3]}>B - Baik ({c.weights[3]} pt)</option>
                                <option value={c.weights[4]}>A - Sangat Baik / Maksimal ({c.weights[4]} pt)</option>
                              </select>
                            </td>

                            {c.weights.map((val, idx) => {
                              const isChecked = selectedVal === val;
                              return (
                                <td key={idx} className="py-2.5 px-1.5 text-center">
                                  <label className={`block ${isUserRole ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                                    <input
                                      type="radio"
                                      name={`${activeCategory.key}_${c.no}`}
                                      value={val}
                                      disabled={isUserRole}
                                      checked={isChecked}
                                      onChange={() => handleScoreSelect(activeCategory.key, c.no, val)}
                                      className="hidden"
                                    />
                                    <span
                                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold border transition ${
                                        isChecked
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                          : 'border-slate-200 hover:border-blue-400 text-slate-700'
                                      }`}
                                    >
                                      {val}
                                    </span>
                                  </label>
                                </td>
                              );
                            })}

                            <td className="py-2.5 px-4 text-center font-black text-blue-700 bg-slate-50 text-base tabular-nums">
                              {isScored ? selectedVal : '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={8} className="py-4 px-4 text-right uppercase tracking-wider text-slate-700">
                        Subtotal {activeCategory.title} (Maksimal: {activeCategory.maxPoints}):
                      </td>
                      <td className="py-4 px-4 text-center text-xl font-black text-blue-700 bg-slate-200 tabular-nums">
                        {activeCalc?.categorySummaries[activeCategory.key]?.sum || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: REKAPITULASI (JUARA UMUM & PER KATEGORI LOMBA) */}
        {/* ==================================================== */}
        {currentTab === 'rekap' && (
          <div className="space-y-5">
            {/* TINGKAT SELEKTOR (SLTP VS SLTA) - PERSISTENT TAB BAR */}
            <div className="bg-slate-900 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md no-print border border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-400 px-2 tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" /> Jenjang Penilaian:
                </span>
                <div className="flex items-center bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setJenjangFilter('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      jenjangFilter === 'all'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    <span>Semua (SLTP & SLTA Terpisah)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenjangFilter('SLTP')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      jenjangFilter === 'SLTP'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-300" />
                    <span>Tingkat SLTP (SMP/MTs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenjangFilter('SLTA')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      jenjangFilter === 'SLTA'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Tingkat SLTA (SMA/SMK/MA)</span>
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-300 px-2 font-medium">
                {jenjangFilter === 'all' && 'Nilai rekapitulasi, podium juara 1-2-3, dan piala juara umum dipisahkan mandiri untuk SLTP dan SLTA.'}
                {jenjangFilter === 'SLTP' && 'Fokus tampilan khusus jenjang SLTP (SMP / MTs). Nilai SLTA disaring.'}
                {jenjangFilter === 'SLTA' && 'Fokus tampilan khusus jenjang SLTA (SMA / SMK / MA). Nilai SLTP disaring.'}
              </div>
            </div>

            {/* View Mode Switcher (Juara Umum vs Per Kategori vs Ringkasan Pemenang) */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setRekapViewMode('umum')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    rekapViewMode === 'umum'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>Dual Juara Umum (SLTP & SLTA)</span>
                </button>

                <button
                  onClick={() => setRekapViewMode('kategori')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    rekapViewMode === 'kategori'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Medal className="w-4 h-4 text-amber-300" />
                  <span>Peringkat Per Kategori Lomba</span>
                </button>

                <button
                  onClick={() => setRekapViewMode('ringkasan')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    rekapViewMode === 'ringkasan'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Ringkasan Juara Semua Kategori</span>
                </button>
              </div>

              {/* Ekspor Excel: Multi-Sheet & Spesifik */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportExcelMasterWorkbook}
                  title="Unduh seluruh kategori lomba ke dalam 1 file Excel dengan sheet terpisah untuk setiap kategori + Juara Umum"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-amber-300" />
                  <span>Ekspor Buku Rekap (Sheet SLTP & SLTA Terpisah)</span>
                </button>

                {rekapViewMode === 'kategori' && (
                  <button
                    onClick={() => handleExportExcelKategoriSpesifik(rekapSelectedCategoryKey)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Ekspor Juara {rekapActiveCategoryObj.shortTitle} (.xlsx)
                  </button>
                )}

                {rekapViewMode === 'umum' && (
                  <button
                    onClick={handleExportExcelJuaraUmum}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Ekspor Juara Umum SLTP & SLTA (.xlsx)
                  </button>
                )}

                <button
                  onClick={() => window.print()}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak
                </button>
              </div>
            </div>

            {/* Sub-Header Khusus Rekap Per Kategori: Quick Pills & Selector */}
            {rekapViewMode === 'kategori' && (
              <div className="space-y-3 no-print">
                {/* Header Kategori Aktif */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-600 text-white">
                      <Medal className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Kategori Perlombaan yang Dipilih
                      </div>
                      <div className="text-lg font-black text-white flex items-center gap-2">
                        <span>{rekapActiveCategoryObj.title}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-blue-300 font-semibold">
                          Maks. {rekapActiveCategoryObj.maxPoints} Poin
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={rekapSelectedCategoryKey}
                      onChange={e => setRekapSelectedCategoryKey(e.target.value as CategoryKey)}
                      className="bg-slate-800 border border-slate-700 text-white text-xs font-bold py-2 px-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      {categories.map((c, i) => (
                        <option key={c.key} value={c.key}>
                          {i + 1}. {c.title} ({c.maxPoints} Poin - {c.criteria.length} Butir)
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleExportExcelKategoriSpesifik(rekapSelectedCategoryKey)}
                      title="Ekspor khusus kategori ini ke Excel"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Category Pills Bar */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase px-2 shrink-0">Pilih Kategori:</span>
                  {categories.map((cat, idx) => {
                    const isSelected = cat.key === rekapSelectedCategoryKey;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setRekapSelectedCategoryKey(cat.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{idx + 1}. {cat.shortTitle}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                          isSelected ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {cat.maxPoints} pt
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Bar: Pencarian & Status */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3 no-print">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari nomor peserta, sekolah, atau nama regu..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="border border-slate-300 rounded-xl text-sm px-3 py-2 bg-white font-medium outline-none"
                >
                  <option value="all">Semua Status Penilaian</option>
                  <option value="completed">Hanya yang Lengkap</option>
                  <option value="pending">Hanya yang Belum Selesai</option>
                </select>
              </div>
            </div>

            {/* ==================================================== */}
            {/* VIEW 1: DUAL JUARA UMUM (SLTP & SLTA TERPISAH MANDIRI) */}
            {/* ==================================================== */}
            {rekapViewMode === 'umum' && (
              <div className="space-y-8">
                {/* 1. SEKSI JUARA UMUM TINGKAT SLTP */}
                {(jenjangFilter === 'all' || jenjangFilter === 'SLTP') && (() => {
                  const sltpItems = overallStandingsData
                    .filter(item => (item.jenjang || 'SLTP') === 'SLTP')
                    .sort((a, b) => {
                      if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
                        return (a.jenjangRank || 999) - (b.jenjangRank || 999);
                      }
                      if (a.calc.mandatoryCompleted) return -1;
                      if (b.calc.mandatoryCompleted) return 1;
                      return (a.nomor || '').localeCompare(b.nomor || '');
                    });

                  const j1 = sltpItems.find(t => t.jenjangRank === 1 && t.calc.mandatoryCompleted);
                  const j2 = sltpItems.find(t => t.jenjangRank === 2 && t.calc.mandatoryCompleted);
                  const j3 = sltpItems.find(t => t.jenjangRank === 3 && t.calc.mandatoryCompleted);

                  return (
                    <div className="bg-white rounded-2xl shadow-md border-2 border-blue-200 overflow-hidden">
                      {/* Banner Header Juara Umum SLTP */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-amber-400 text-amber-950 rounded-2xl shadow-md">
                            <Trophy className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/30">
                                Klasemen Mandiri
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950">
                                Tingkat SLTP (SMP / MTs)
                              </span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-1">
                              PIALA BERGILIR JUARA UMUM TINGKAT SLTP
                            </h2>
                            <p className="text-xs text-blue-200">
                              Akumulasi nilai seluruh mata lomba khusus jenjang SMP / MTs (Maks. {activeCalc?.maxGrandTotal || 1200} Poin).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-blue-800/80 px-3 py-1 rounded-full border border-blue-300/30">
                            {sltpItems.length} Kontingen SLTP
                          </span>
                        </div>
                      </div>

                      {/* Podium Juara Umum SLTP (Emas, Perak, Perunggu) */}
                      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
                        <div className="text-xs font-black uppercase tracking-wider text-blue-900 mb-3 flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span>Podium Juara Umum Tingkat SLTP</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Juara Umum 2 SLTP (Perak) */}
                          <div className={`p-4 rounded-2xl border transition order-2 md:order-1 ${
                            j2 ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                <Medal className="w-3.5 h-3.5" /> Juara Umum 2 SLTP
                              </span>
                              <span className="text-xs font-bold text-slate-500">Perak</span>
                            </div>
                            {j2 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j2.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-semibold">{j2.peleton || `No. ${j2.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Total Nilai:</span>
                                  <span className="text-lg font-black text-slate-800">{j2.calc.grandTotal} <span className="text-xs font-normal text-slate-500">/ {j2.calc.maxGrandTotal} ({j2.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara Umum 1 SLTP (Emas - Podium Utama) */}
                          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition order-1 md:order-2 ${
                            j1 ? 'bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border-amber-400 shadow-md ring-2 ring-amber-400/30' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-sm">
                                <Crown className="w-4 h-4 text-amber-900" /> Juara Umum 1 SLTP
                              </span>
                              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Piala Bergilir 🏆</span>
                            </div>
                            {j1 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-tight truncate">{j1.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-bold">{j1.peleton || `No. ${j1.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-amber-200">
                                  <span className="text-xs text-amber-900 font-bold">Skor Tertinggi:</span>
                                  <span className="text-2xl font-black text-amber-950">{j1.calc.grandTotal} <span className="text-xs font-normal text-slate-600">/ {j1.calc.maxGrandTotal} ({j1.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara Umum 3 SLTP (Perunggu) */}
                          <div className={`p-4 rounded-2xl border transition order-3 ${
                            j3 ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                <Award className="w-3.5 h-3.5" /> Juara Umum 3 SLTP
                              </span>
                              <span className="text-xs font-bold text-amber-700">Perunggu</span>
                            </div>
                            {j3 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j3.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-semibold">{j3.peleton || `No. ${j3.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Total Nilai:</span>
                                  <span className="text-lg font-black text-slate-800">{j3.calc.grandTotal} <span className="text-xs font-normal text-slate-500">/ {j3.calc.maxGrandTotal} ({j3.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabel Klasemen SLTP */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-blue-50/70 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-blue-200">
                            <tr>
                              <th className="py-3 px-3 text-center w-12">No</th>
                              <th className="py-3 px-3 text-center w-36">Peringkat SLTP</th>
                              <th className="py-3 px-3 text-center w-16">No</th>
                              <th className="py-3 px-4 min-w-[200px]">Nama Sekolah & Regu (SLTP)</th>
                              {categories.map(cat => (
                                <th
                                  key={cat.key}
                                  onClick={() => {
                                    setRekapSelectedCategoryKey(cat.key);
                                    setRekapViewMode('kategori');
                                  }}
                                  title={`Klik untuk melihat rincian ${cat.title}`}
                                  className="py-3 px-2 text-center text-[11px] whitespace-nowrap cursor-pointer hover:bg-blue-100 transition"
                                >
                                  <span className="underline decoration-dotted decoration-blue-500 font-black">{cat.shortTitle}</span><br />
                                  <span className="text-[10px] text-slate-500 font-normal">Max {cat.maxPoints}</span>
                                </th>
                              ))}
                              <th className="py-3 px-3 text-center w-28 bg-amber-50 text-amber-950 font-black">
                                Total Nilai<br />
                                <span className="text-[10px] text-amber-600 font-normal">Max {activeCalc?.maxGrandTotal}</span>
                              </th>
                              <th className="py-3 px-3 text-center w-20">Persen</th>
                              <th className="py-3 px-3 text-center w-28">Status</th>
                              <th className="py-3 px-3 text-center w-28 no-print">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium">
                            {sltpItems.length === 0 ? (
                              <tr>
                                <td colSpan={8 + categories.length} className="py-8 text-center text-slate-400">
                                  Tidak ada peserta tingkat SLTP ditemukan.
                                </td>
                              </tr>
                            ) : (
                              sltpItems.map((item, index) => {
                                const displayRank = item.jenjangRank;
                                let rankBadge = <span className="text-slate-400 text-xs font-semibold">-</span>;
                                let rowHighlight = '';

                                if (item.calc.mandatoryCompleted && displayRank !== null) {
                                  if (displayRank === 1) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-xs">
                                        <Crown className="w-3.5 h-3.5" /> Juara Umum 1
                                      </span>
                                    );
                                    rowHighlight = 'bg-amber-50/50';
                                  } else if (displayRank === 2) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                        <Medal className="w-3.5 h-3.5" /> Juara Umum 2
                                      </span>
                                    );
                                    rowHighlight = 'bg-slate-50';
                                  } else if (displayRank === 3) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                        <Award className="w-3.5 h-3.5" /> Juara Umum 3
                                      </span>
                                    );
                                  } else {
                                    rankBadge = (
                                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                                        Peringkat {displayRank} SLTP
                                      </span>
                                    );
                                  }
                                }

                                const statusBadge = item.calc.mandatoryCompleted ? (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                    Lengkap
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                                    Proses ({item.calc.completedCategoriesCount}/{item.calc.totalCategoriesCount})
                                  </span>
                                );

                                return (
                                  <tr key={item.id} className={`hover:bg-blue-50/40 transition ${rowHighlight}`}>
                                    <td className="py-3 px-3 text-center text-slate-400">{index + 1}</td>
                                    <td className="py-3 px-3 text-center">{rankBadge}</td>
                                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.nomor}</td>
                                    <td className="py-3 px-4">
                                      <strong className="text-slate-900 block leading-tight">{item.sekolah}</strong>
                                      {item.peleton ? (
                                        <span className="text-xs text-blue-600 font-semibold">{item.peleton}</span>
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">Tanpa Nama Regu</span>
                                      )}
                                    </td>

                                    {/* Kolom Tiap Mata Lomba (Peringkat SLTP Mandiri) */}
                                    {categories.map(cat => {
                                      const s = item.calc.categorySummaries[cat.key]?.sum || 0;
                                      const isDone = item.calc.categorySummaries[cat.key]?.isComplete;
                                      const cRank = item.catRanks[cat.key]?.jenjangRank;

                                      let rankPill = null;
                                      if (isDone && cRank !== null && cRank !== undefined) {
                                        if (cRank === 1) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-amber-900 bg-amber-200/90 rounded px-1 py-0.2 mt-0.5">
                                              🥇 #1
                                            </span>
                                          );
                                        } else if (cRank === 2) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-slate-800 bg-slate-200 rounded px-1 py-0.2 mt-0.5">
                                              🥈 #2
                                            </span>
                                          );
                                        } else if (cRank === 3) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-amber-900 bg-amber-100 rounded px-1 py-0.2 mt-0.5">
                                              🥉 #3
                                            </span>
                                          );
                                        } else {
                                          rankPill = (
                                            <span className="block text-[9px] font-bold text-slate-500 bg-slate-100 rounded px-1 py-0.2 mt-0.5">
                                              #{cRank}
                                            </span>
                                          );
                                        }
                                      }

                                      return (
                                        <td
                                          key={cat.key}
                                          onClick={() => {
                                            setRekapSelectedCategoryKey(cat.key);
                                            setRekapViewMode('kategori');
                                          }}
                                          title={`Klik untuk melihat rincian ${cat.title}`}
                                          className="py-2.5 px-2 text-center tabular-nums cursor-pointer hover:bg-blue-100/60 transition"
                                        >
                                          <span className="font-extrabold text-slate-800 text-xs block">{s}</span>
                                          {rankPill}
                                        </td>
                                      );
                                    })}

                                    <td className="py-3 px-3 text-center font-black text-amber-950 bg-amber-50 text-base tabular-nums">
                                      {item.calc.grandTotal}
                                    </td>
                                    <td className="py-3 px-3 text-center font-semibold text-slate-700 tabular-nums">
                                      {item.calc.grandPct.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-3 text-center">{statusBadge}</td>
                                    <td className="py-3 px-3 text-center no-print">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => {
                                            setPrintPesertaId(item.id);
                                            setModalPrintOpen(true);
                                          }}
                                          title="Cetak Lembar Nilai"
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                        >
                                          <Printer className="w-4 h-4" />
                                        </button>
                                        {!isUserRole && (
                                          <button
                                            onClick={() => {
                                              setActivePesertaId(item.id);
                                              setCurrentTab(categories[0].key);
                                            }}
                                            title="Input / Edit Nilai"
                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                        )}
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
                  );
                })()}

                {/* 2. SEKSI JUARA UMUM TINGKAT SLTA */}
                {(jenjangFilter === 'all' || jenjangFilter === 'SLTA') && (() => {
                  const sltaItems = overallStandingsData
                    .filter(item => item.jenjang === 'SLTA')
                    .sort((a, b) => {
                      if (a.calc.mandatoryCompleted && b.calc.mandatoryCompleted) {
                        return (a.jenjangRank || 999) - (b.jenjangRank || 999);
                      }
                      if (a.calc.mandatoryCompleted) return -1;
                      if (b.calc.mandatoryCompleted) return 1;
                      return (a.nomor || '').localeCompare(b.nomor || '');
                    });

                  const j1 = sltaItems.find(t => t.jenjangRank === 1 && t.calc.mandatoryCompleted);
                  const j2 = sltaItems.find(t => t.jenjangRank === 2 && t.calc.mandatoryCompleted);
                  const j3 = sltaItems.find(t => t.jenjangRank === 3 && t.calc.mandatoryCompleted);

                  return (
                    <div className="bg-white rounded-2xl shadow-md border-2 border-indigo-200 overflow-hidden">
                      {/* Banner Header Juara Umum SLTA */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-amber-400 text-amber-950 rounded-2xl shadow-md">
                            <Trophy className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                Klasemen Mandiri
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950">
                                Tingkat SLTA (SMA / SMK / MA)
                              </span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-1">
                              PIALA BERGILIR JUARA UMUM TINGKAT SLTA
                            </h2>
                            <p className="text-xs text-indigo-200">
                              Akumulasi nilai seluruh mata lomba khusus jenjang SMA / SMK / MA (Maks. {activeCalc?.maxGrandTotal || 1200} Poin).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-indigo-800/80 px-3 py-1 rounded-full border border-indigo-300/30">
                            {sltaItems.length} Kontingen SLTA
                          </span>
                        </div>
                      </div>

                      {/* Podium Juara Umum SLTA (Emas, Perak, Perunggu) */}
                      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
                        <div className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-3 flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span>Podium Juara Umum Tingkat SLTA</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Juara Umum 2 SLTA (Perak) */}
                          <div className={`p-4 rounded-2xl border transition order-2 md:order-1 ${
                            j2 ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                <Medal className="w-3.5 h-3.5" /> Juara Umum 2 SLTA
                              </span>
                              <span className="text-xs font-bold text-slate-500">Perak</span>
                            </div>
                            {j2 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j2.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-semibold">{j2.peleton || `No. ${j2.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Total Nilai:</span>
                                  <span className="text-lg font-black text-slate-800">{j2.calc.grandTotal} <span className="text-xs font-normal text-slate-500">/ {j2.calc.maxGrandTotal} ({j2.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara Umum 1 SLTA (Emas - Podium Utama) */}
                          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition order-1 md:order-2 ${
                            j1 ? 'bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border-amber-400 shadow-md ring-2 ring-amber-400/30' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-sm">
                                <Crown className="w-4 h-4 text-amber-900" /> Juara Umum 1 SLTA
                              </span>
                              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Piala Bergilir 🏆</span>
                            </div>
                            {j1 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-tight truncate">{j1.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-bold">{j1.peleton || `No. ${j1.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-amber-200">
                                  <span className="text-xs text-amber-900 font-bold">Skor Tertinggi:</span>
                                  <span className="text-2xl font-black text-amber-950">{j1.calc.grandTotal} <span className="text-xs font-normal text-slate-600">/ {j1.calc.maxGrandTotal} ({j1.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara Umum 3 SLTA (Perunggu) */}
                          <div className={`p-4 rounded-2xl border transition order-3 ${
                            j3 ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                <Award className="w-3.5 h-3.5" /> Juara Umum 3 SLTA
                              </span>
                              <span className="text-xs font-bold text-amber-700">Perunggu</span>
                            </div>
                            {j3 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j3.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-semibold">{j3.peleton || `No. ${j3.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Total Nilai:</span>
                                  <span className="text-lg font-black text-slate-800">{j3.calc.grandTotal} <span className="text-xs font-normal text-slate-500">/ {j3.calc.maxGrandTotal} ({j3.calc.grandPct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabel Klasemen SLTA */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-indigo-50/70 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-indigo-200">
                            <tr>
                              <th className="py-3 px-3 text-center w-12">No</th>
                              <th className="py-3 px-3 text-center w-36">Peringkat SLTA</th>
                              <th className="py-3 px-3 text-center w-16">No</th>
                              <th className="py-3 px-4 min-w-[200px]">Nama Sekolah & Regu (SLTA)</th>
                              {categories.map(cat => (
                                <th
                                  key={cat.key}
                                  onClick={() => {
                                    setRekapSelectedCategoryKey(cat.key);
                                    setRekapViewMode('kategori');
                                  }}
                                  title={`Klik untuk melihat rincian ${cat.title}`}
                                  className="py-3 px-2 text-center text-[11px] whitespace-nowrap cursor-pointer hover:bg-indigo-100 transition"
                                >
                                  <span className="underline decoration-dotted decoration-indigo-500 font-black">{cat.shortTitle}</span><br />
                                  <span className="text-[10px] text-slate-500 font-normal">Max {cat.maxPoints}</span>
                                </th>
                              ))}
                              <th className="py-3 px-3 text-center w-28 bg-amber-50 text-amber-950 font-black">
                                Total Nilai<br />
                                <span className="text-[10px] text-amber-600 font-normal">Max {activeCalc?.maxGrandTotal}</span>
                              </th>
                              <th className="py-3 px-3 text-center w-20">Persen</th>
                              <th className="py-3 px-3 text-center w-28">Status</th>
                              <th className="py-3 px-3 text-center w-28 no-print">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium">
                            {sltaItems.length === 0 ? (
                              <tr>
                                <td colSpan={8 + categories.length} className="py-8 text-center text-slate-400">
                                  Tidak ada peserta tingkat SLTA ditemukan.
                                </td>
                              </tr>
                            ) : (
                              sltaItems.map((item, index) => {
                                const displayRank = item.jenjangRank;
                                let rankBadge = <span className="text-slate-400 text-xs font-semibold">-</span>;
                                let rowHighlight = '';

                                if (item.calc.mandatoryCompleted && displayRank !== null) {
                                  if (displayRank === 1) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-xs">
                                        <Crown className="w-3.5 h-3.5" /> Juara Umum 1
                                      </span>
                                    );
                                    rowHighlight = 'bg-amber-50/50';
                                  } else if (displayRank === 2) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                        <Medal className="w-3.5 h-3.5" /> Juara Umum 2
                                      </span>
                                    );
                                    rowHighlight = 'bg-slate-50';
                                  } else if (displayRank === 3) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                        <Award className="w-3.5 h-3.5" /> Juara Umum 3
                                      </span>
                                    );
                                  } else {
                                    rankBadge = (
                                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                                        Peringkat {displayRank} SLTA
                                      </span>
                                    );
                                  }
                                }

                                const statusBadge = item.calc.mandatoryCompleted ? (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                    Lengkap
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                                    Proses ({item.calc.completedCategoriesCount}/{item.calc.totalCategoriesCount})
                                  </span>
                                );

                                return (
                                  <tr key={item.id} className={`hover:bg-indigo-50/40 transition ${rowHighlight}`}>
                                    <td className="py-3 px-3 text-center text-slate-400">{index + 1}</td>
                                    <td className="py-3 px-3 text-center">{rankBadge}</td>
                                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.nomor}</td>
                                    <td className="py-3 px-4">
                                      <strong className="text-slate-900 block leading-tight">{item.sekolah}</strong>
                                      {item.peleton ? (
                                        <span className="text-xs text-indigo-600 font-semibold">{item.peleton}</span>
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">Tanpa Nama Regu</span>
                                      )}
                                    </td>

                                    {/* Kolom Tiap Mata Lomba (Peringkat SLTA Mandiri) */}
                                    {categories.map(cat => {
                                      const s = item.calc.categorySummaries[cat.key]?.sum || 0;
                                      const isDone = item.calc.categorySummaries[cat.key]?.isComplete;
                                      const cRank = item.catRanks[cat.key]?.jenjangRank;

                                      let rankPill = null;
                                      if (isDone && cRank !== null && cRank !== undefined) {
                                        if (cRank === 1) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-amber-900 bg-amber-200/90 rounded px-1 py-0.2 mt-0.5">
                                              🥇 #1
                                            </span>
                                          );
                                        } else if (cRank === 2) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-slate-800 bg-slate-200 rounded px-1 py-0.2 mt-0.5">
                                              🥈 #2
                                            </span>
                                          );
                                        } else if (cRank === 3) {
                                          rankPill = (
                                            <span className="block text-[9px] font-black text-amber-900 bg-amber-100 rounded px-1 py-0.2 mt-0.5">
                                              🥉 #3
                                            </span>
                                          );
                                        } else {
                                          rankPill = (
                                            <span className="block text-[9px] font-bold text-slate-500 bg-slate-100 rounded px-1 py-0.2 mt-0.5">
                                              #{cRank}
                                            </span>
                                          );
                                        }
                                      }

                                      return (
                                        <td
                                          key={cat.key}
                                          onClick={() => {
                                            setRekapSelectedCategoryKey(cat.key);
                                            setRekapViewMode('kategori');
                                          }}
                                          title={`Klik untuk melihat rincian ${cat.title}`}
                                          className="py-2.5 px-2 text-center tabular-nums cursor-pointer hover:bg-indigo-100/60 transition"
                                        >
                                          <span className="font-extrabold text-slate-800 text-xs block">{s}</span>
                                          {rankPill}
                                        </td>
                                      );
                                    })}

                                    <td className="py-3 px-3 text-center font-black text-amber-950 bg-amber-50 text-base tabular-nums">
                                      {item.calc.grandTotal}
                                    </td>
                                    <td className="py-3 px-3 text-center font-semibold text-slate-700 tabular-nums">
                                      {item.calc.grandPct.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-3 text-center">{statusBadge}</td>
                                    <td className="py-3 px-3 text-center no-print">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => {
                                            setPrintPesertaId(item.id);
                                            setModalPrintOpen(true);
                                          }}
                                          title="Cetak Lembar Nilai"
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                        >
                                          <Printer className="w-4 h-4" />
                                        </button>
                                        {!isUserRole && (
                                          <button
                                            onClick={() => {
                                              setActivePesertaId(item.id);
                                              setCurrentTab(categories[0].key);
                                            }}
                                            title="Input / Edit Nilai"
                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                        )}
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
                  );
                })()}
              </div>
            )}

            {/* ==================================================== */}
            {/* VIEW 2: PERINGKAT PER KATEGORI (SLTP & SLTA TERPISAH) */}
            {/* ==================================================== */}
            {rekapViewMode === 'kategori' && (
              <div className="space-y-8">
                {/* 1. SEKSI KATEGORI TINGKAT SLTP */}
                {(jenjangFilter === 'all' || jenjangFilter === 'SLTP') && (() => {
                  const catData = allCategoriesRankings[rekapSelectedCategoryKey];
                  const sltpList = catData ? catData.leaderboardSLTP.filter(item => {
                    const q = searchQuery.toLowerCase().trim();
                    const matchSearch =
                      item.nomor.toLowerCase().includes(q) ||
                      (item.peleton || '').toLowerCase().includes(q) ||
                      item.sekolah.toLowerCase().includes(q);
                    if (!matchSearch) return false;
                    if (statusFilter === 'completed') return item.catSummary.isComplete;
                    if (statusFilter === 'pending') return !item.catSummary.isComplete;
                    return true;
                  }) : [];

                  const j1 = catData?.topThreeSLTP.find(t => t.rank === 1);
                  const j2 = catData?.topThreeSLTP.find(t => t.rank === 2);
                  const j3 = catData?.topThreeSLTP.find(t => t.rank === 3);

                  return (
                    <div className="bg-white rounded-2xl shadow-md border-2 border-blue-200 overflow-hidden">
                      <div className="p-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow">
                            <Medal className="w-5 h-5 text-amber-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/30">
                                Peringkat Mandiri
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950">
                                Tingkat SLTP (SMP / MTs)
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                              JUARA KATEGORI: {rekapActiveCategoryObj.title.toUpperCase()} • TINGKAT SLTP
                            </h3>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-blue-800 px-3 py-1 rounded-full border border-blue-400/30">
                          {sltpList.length} Peserta SLTP
                        </span>
                      </div>

                      {/* Podium Juara Kategori SLTP */}
                      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Juara 2 SLTP */}
                          <div className={`p-4 rounded-2xl border transition order-2 md:order-1 ${
                            j2 ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-800">
                                <Medal className="w-3.5 h-3.5 text-slate-600" /> Juara 2 SLTP ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-bold text-slate-500">Perak</span>
                            </div>
                            {j2 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j2.participant.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-semibold">{j2.participant.peleton || `No. ${j2.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Nilai Perolehan:</span>
                                  <span className="text-lg font-black text-slate-800">{j2.score} <span className="text-xs font-normal text-slate-500">/ {rekapActiveCategoryObj.maxPoints} ({j2.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara 1 SLTP */}
                          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition order-1 md:order-2 ${
                            j1 ? 'bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border-amber-400 shadow-md ring-2 ring-amber-400/30' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-sm">
                                <Crown className="w-4 h-4 text-amber-900" /> Juara 1 SLTP ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Terbaik SLTP 🥇</span>
                            </div>
                            {j1 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-tight truncate">{j1.participant.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-bold">{j1.participant.peleton || `No. ${j1.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-amber-200">
                                  <span className="text-xs text-amber-900 font-bold">Skor Tertinggi:</span>
                                  <span className="text-xl font-black text-amber-950">{j1.score} <span className="text-xs font-normal text-slate-600">/ {rekapActiveCategoryObj.maxPoints} ({j1.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara 3 SLTP */}
                          <div className={`p-4 rounded-2xl border transition order-3 ${
                            j3 ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white">
                                <Award className="w-3.5 h-3.5" /> Juara 3 SLTP ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-bold text-amber-700">Perunggu</span>
                            </div>
                            {j3 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j3.participant.sekolah}</h4>
                                <p className="text-xs text-blue-600 font-semibold">{j3.participant.peleton || `No. ${j3.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Nilai Perolehan:</span>
                                  <span className="text-lg font-black text-slate-800">{j3.score} <span className="text-xs font-normal text-slate-500">/ {rekapActiveCategoryObj.maxPoints} ({j3.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabel Skor Kriteria SLTP */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-blue-50/70 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-blue-200">
                            <tr>
                              <th className="py-3 px-3 text-center w-12">No</th>
                              <th className="py-3 px-3 text-center w-32">Peringkat SLTP</th>
                              <th className="py-3 px-3 text-center w-16">No</th>
                              <th className="py-3 px-4 min-w-[200px]">Nama Sekolah & Regu (SLTP)</th>
                              {rekapActiveCategoryObj.criteria.map(crit => (
                                <th
                                  key={crit.no}
                                  title={`Kriteria ${crit.no}: ${crit.name}`}
                                  className="py-3 px-2 text-center text-[11px] whitespace-nowrap cursor-help bg-slate-50"
                                >
                                  K{crit.no}<br />
                                  <span className="text-[10px] text-slate-400 font-normal">Max {crit.weights[4]}</span>
                                </th>
                              ))}
                              <th className="py-3 px-3 text-center w-28 bg-amber-50 text-amber-950 font-black">
                                Subtotal<br />
                                <span className="text-[10px] text-amber-600 font-normal">Max {rekapActiveCategoryObj.maxPoints}</span>
                              </th>
                              <th className="py-3 px-3 text-center w-20">Persen</th>
                              <th className="py-3 px-3 text-center w-28">Status</th>
                              <th className="py-3 px-3 text-center w-24 no-print">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium">
                            {sltpList.length === 0 ? (
                              <tr>
                                <td colSpan={8 + rekapActiveCategoryObj.criteria.length} className="py-8 text-center text-slate-400">
                                  Tidak ada data peserta SLTP ditemukan pada kategori ini.
                                </td>
                              </tr>
                            ) : (
                              sltpList.map((item, index) => {
                                const activeRank = item.jenjangCatRank;
                                let rankBadge = <span className="text-slate-400 text-xs font-semibold">-</span>;
                                let rowHighlight = '';

                                if (item.catSummary.isComplete && activeRank !== null) {
                                  if (activeRank === 1) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-xs">
                                        <Crown className="w-3.5 h-3.5" /> Juara 1
                                      </span>
                                    );
                                    rowHighlight = 'bg-amber-50/50';
                                  } else if (activeRank === 2) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                        <Medal className="w-3.5 h-3.5" /> Juara 2
                                      </span>
                                    );
                                    rowHighlight = 'bg-slate-50';
                                  } else if (activeRank === 3) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                        <Award className="w-3.5 h-3.5" /> Juara 3
                                      </span>
                                    );
                                  } else {
                                    rankBadge = (
                                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                                        Peringkat {activeRank}
                                      </span>
                                    );
                                  }
                                }

                                const statusBadge = item.catSummary.isComplete ? (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                    Lengkap
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                                    Proses ({item.catSummary.count}/{item.catSummary.totalCriteria})
                                  </span>
                                );

                                return (
                                  <tr key={item.id} className={`hover:bg-blue-50/40 transition ${rowHighlight}`}>
                                    <td className="py-3 px-3 text-center text-slate-400">{index + 1}</td>
                                    <td className="py-3 px-3 text-center">{rankBadge}</td>
                                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.nomor}</td>
                                    <td className="py-3 px-4">
                                      <strong className="text-slate-900 block leading-tight">{item.sekolah}</strong>
                                      {item.peleton ? (
                                        <span className="text-xs text-blue-600 font-semibold">{item.peleton}</span>
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">Tanpa Nama Regu</span>
                                      )}
                                    </td>

                                    {rekapActiveCategoryObj.criteria.map(crit => {
                                      const val = item.catScores[crit.no];
                                      return (
                                        <td key={crit.no} className="py-3 px-2 text-center font-semibold text-slate-700 tabular-nums">
                                          {val !== undefined && val !== null ? val : '-'}
                                        </td>
                                      );
                                    })}

                                    <td className="py-3 px-3 text-center font-black text-amber-950 bg-amber-50 text-base tabular-nums">
                                      {item.catSummary.sum}
                                    </td>
                                    <td className="py-3 px-3 text-center font-semibold text-slate-700 tabular-nums">
                                      {item.catSummary.pct.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-3 text-center">{statusBadge}</td>
                                    <td className="py-3 px-3 text-center no-print">
                                      {!isUserRole && (
                                        <button
                                          onClick={() => {
                                            setActivePesertaId(item.id);
                                            setCurrentTab(rekapActiveCategoryObj.key);
                                          }}
                                          title="Input / Edit Nilai Kategori Ini"
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. SEKSI KATEGORI TINGKAT SLTA */}
                {(jenjangFilter === 'all' || jenjangFilter === 'SLTA') && (() => {
                  const catData = allCategoriesRankings[rekapSelectedCategoryKey];
                  const sltaList = catData ? catData.leaderboardSLTA.filter(item => {
                    const q = searchQuery.toLowerCase().trim();
                    const matchSearch =
                      item.nomor.toLowerCase().includes(q) ||
                      (item.peleton || '').toLowerCase().includes(q) ||
                      item.sekolah.toLowerCase().includes(q);
                    if (!matchSearch) return false;
                    if (statusFilter === 'completed') return item.catSummary.isComplete;
                    if (statusFilter === 'pending') return !item.catSummary.isComplete;
                    return true;
                  }) : [];

                  const j1 = catData?.topThreeSLTA.find(t => t.rank === 1);
                  const j2 = catData?.topThreeSLTA.find(t => t.rank === 2);
                  const j3 = catData?.topThreeSLTA.find(t => t.rank === 3);

                  return (
                    <div className="bg-white rounded-2xl shadow-md border-2 border-indigo-200 overflow-hidden">
                      <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 text-white flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow">
                            <Medal className="w-5 h-5 text-amber-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                Peringkat Mandiri
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950">
                                Tingkat SLTA (SMA / SMK / MA)
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white mt-0.5">
                              JUARA KATEGORI: {rekapActiveCategoryObj.title.toUpperCase()} • TINGKAT SLTA
                            </h3>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-indigo-800 px-3 py-1 rounded-full border border-indigo-400/30">
                          {sltaList.length} Peserta SLTA
                        </span>
                      </div>

                      {/* Podium Juara Kategori SLTA */}
                      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Juara 2 SLTA */}
                          <div className={`p-4 rounded-2xl border transition order-2 md:order-1 ${
                            j2 ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-800">
                                <Medal className="w-3.5 h-3.5 text-slate-600" /> Juara 2 SLTA ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-bold text-slate-500">Perak</span>
                            </div>
                            {j2 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j2.participant.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-semibold">{j2.participant.peleton || `No. ${j2.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Nilai Perolehan:</span>
                                  <span className="text-lg font-black text-slate-800">{j2.score} <span className="text-xs font-normal text-slate-500">/ {rekapActiveCategoryObj.maxPoints} ({j2.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara 1 SLTA */}
                          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition order-1 md:order-2 ${
                            j1 ? 'bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border-amber-400 shadow-md ring-2 ring-amber-400/30' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-sm">
                                <Crown className="w-4 h-4 text-amber-900" /> Juara 1 SLTA ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Terbaik SLTA 🥇</span>
                            </div>
                            {j1 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-tight truncate">{j1.participant.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-bold">{j1.participant.peleton || `No. ${j1.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-amber-200">
                                  <span className="text-xs text-amber-900 font-bold">Skor Tertinggi:</span>
                                  <span className="text-xl font-black text-amber-950">{j1.score} <span className="text-xs font-normal text-slate-600">/ {rekapActiveCategoryObj.maxPoints} ({j1.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>

                          {/* Juara 3 SLTA */}
                          <div className={`p-4 rounded-2xl border transition order-3 ${
                            j3 ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-100/60 border-dashed border-slate-300 opacity-60'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white">
                                <Award className="w-3.5 h-3.5" /> Juara 3 SLTA ({rekapActiveCategoryObj.shortTitle})
                              </span>
                              <span className="text-xs font-bold text-amber-700">Perunggu</span>
                            </div>
                            {j3 ? (
                              <div>
                                <h4 className="font-black text-slate-900 text-base leading-tight truncate">{j3.participant.sekolah}</h4>
                                <p className="text-xs text-indigo-600 font-semibold">{j3.participant.peleton || `No. ${j3.participant.nomor}`}</p>
                                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                                  <span className="text-xs text-slate-500">Nilai Perolehan:</span>
                                  <span className="text-lg font-black text-slate-800">{j3.score} <span className="text-xs font-normal text-slate-500">/ {rekapActiveCategoryObj.maxPoints} ({j3.pct.toFixed(1)}%)</span></span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada peserta lengkap</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabel Skor Kriteria SLTA */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-indigo-50/70 text-slate-700 text-xs uppercase font-bold tracking-wider border-b border-indigo-200">
                            <tr>
                              <th className="py-3 px-3 text-center w-12">No</th>
                              <th className="py-3 px-3 text-center w-32">Peringkat SLTA</th>
                              <th className="py-3 px-3 text-center w-16">No</th>
                              <th className="py-3 px-4 min-w-[200px]">Nama Sekolah & Regu (SLTA)</th>
                              {rekapActiveCategoryObj.criteria.map(crit => (
                                <th
                                  key={crit.no}
                                  title={`Kriteria ${crit.no}: ${crit.name}`}
                                  className="py-3 px-2 text-center text-[11px] whitespace-nowrap cursor-help bg-slate-50"
                                >
                                  K{crit.no}<br />
                                  <span className="text-[10px] text-slate-400 font-normal">Max {crit.weights[4]}</span>
                                </th>
                              ))}
                              <th className="py-3 px-3 text-center w-28 bg-amber-50 text-amber-950 font-black">
                                Subtotal<br />
                                <span className="text-[10px] text-amber-600 font-normal">Max {rekapActiveCategoryObj.maxPoints}</span>
                              </th>
                              <th className="py-3 px-3 text-center w-20">Persen</th>
                              <th className="py-3 px-3 text-center w-28">Status</th>
                              <th className="py-3 px-3 text-center w-24 no-print">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium">
                            {sltaList.length === 0 ? (
                              <tr>
                                <td colSpan={8 + rekapActiveCategoryObj.criteria.length} className="py-8 text-center text-slate-400">
                                  Tidak ada data peserta SLTA ditemukan pada kategori ini.
                                </td>
                              </tr>
                            ) : (
                              sltaList.map((item, index) => {
                                const activeRank = item.jenjangCatRank;
                                let rankBadge = <span className="text-slate-400 text-xs font-semibold">-</span>;
                                let rowHighlight = '';

                                if (item.catSummary.isComplete && activeRank !== null) {
                                  if (activeRank === 1) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-xs">
                                        <Crown className="w-3.5 h-3.5" /> Juara 1
                                      </span>
                                    );
                                    rowHighlight = 'bg-amber-50/50';
                                  } else if (activeRank === 2) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-300 text-slate-900 shadow-xs">
                                        <Medal className="w-3.5 h-3.5" /> Juara 2
                                      </span>
                                    );
                                    rowHighlight = 'bg-slate-50';
                                  } else if (activeRank === 3) {
                                    rankBadge = (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-700 text-white shadow-xs">
                                        <Award className="w-3.5 h-3.5" /> Juara 3
                                      </span>
                                    );
                                  } else {
                                    rankBadge = (
                                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                                        Peringkat {activeRank}
                                      </span>
                                    );
                                  }
                                }

                                const statusBadge = item.catSummary.isComplete ? (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                    Lengkap
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                                    Proses ({item.catSummary.count}/{item.catSummary.totalCriteria})
                                  </span>
                                );

                                return (
                                  <tr key={item.id} className={`hover:bg-indigo-50/40 transition ${rowHighlight}`}>
                                    <td className="py-3 px-3 text-center text-slate-400">{index + 1}</td>
                                    <td className="py-3 px-3 text-center">{rankBadge}</td>
                                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.nomor}</td>
                                    <td className="py-3 px-4">
                                      <strong className="text-slate-900 block leading-tight">{item.sekolah}</strong>
                                      {item.peleton ? (
                                        <span className="text-xs text-indigo-600 font-semibold">{item.peleton}</span>
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">Tanpa Nama Regu</span>
                                      )}
                                    </td>

                                    {rekapActiveCategoryObj.criteria.map(crit => {
                                      const val = item.catScores[crit.no];
                                      return (
                                        <td key={crit.no} className="py-3 px-2 text-center font-semibold text-slate-700 tabular-nums">
                                          {val !== undefined && val !== null ? val : '-'}
                                        </td>
                                      );
                                    })}

                                    <td className="py-3 px-3 text-center font-black text-amber-950 bg-amber-50 text-base tabular-nums">
                                      {item.catSummary.sum}
                                    </td>
                                    <td className="py-3 px-3 text-center font-semibold text-slate-700 tabular-nums">
                                      {item.catSummary.pct.toFixed(1)}%
                                    </td>
                                    <td className="py-3 px-3 text-center">{statusBadge}</td>
                                    <td className="py-3 px-3 text-center no-print">
                                      {!isUserRole && (
                                        <button
                                          onClick={() => {
                                            setActivePesertaId(item.id);
                                            setCurrentTab(rekapActiveCategoryObj.key);
                                          }}
                                          title="Input / Edit Nilai Kategori Ini"
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ==================================================== */}
            {/* VIEW 3: MATRIKS RINGKASAN JUARA SEMUA KATEGORI */}
            {/* ==================================================== */}
            {rekapViewMode === 'ringkasan' && (
              <div className="space-y-4">
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div>
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-wide flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" /> RINGKASAN JUARA SEMUA KATEGORI (SLTP & SLTA MANDIRI)
                    </h2>
                    <p className="text-xs text-blue-300 mt-0.5">
                      Daftar peraih Juara 1, 2, dan 3 untuk 11 mata lomba terpisah antara Tingkat SLTP dan Tingkat SLTA.
                    </p>
                  </div>
                  <button
                    onClick={handleExportExcelMasterWorkbook}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-amber-300" />
                    <span>Unduh Semua Sheet (.xlsx)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat, idx) => {
                    const catData = allCategoriesRankings[cat.key];

                    const sltp1 = catData?.topThreeSLTP.find(t => t.rank === 1);
                    const sltp2 = catData?.topThreeSLTP.find(t => t.rank === 2);
                    const sltp3 = catData?.topThreeSLTP.find(t => t.rank === 3);

                    const slta1 = catData?.topThreeSLTA.find(t => t.rank === 1);
                    const slta2 = catData?.topThreeSLTA.find(t => t.rank === 2);
                    const slta3 = catData?.topThreeSLTA.find(t => t.rank === 3);

                    return (
                      <div
                        key={cat.key}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                            <div>
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                                Mata Lomba #{idx + 1}
                              </span>
                              <h3 className="font-black text-slate-900 text-base leading-snug">
                                {cat.title}
                              </h3>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                              Max {cat.maxPoints} pt
                            </span>
                          </div>

                          <div className="py-3 space-y-4">
                            {/* Sub-Podium SLTP */}
                            {(jenjangFilter === 'all' || jenjangFilter === 'SLTP') && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-blue-600" /> Juara SLTP (SMP/MTs)
                                  </span>
                                </div>

                                {/* SLTP 1 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                                    <span className="font-bold text-slate-900 truncate">{sltp1 ? sltp1.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-black text-amber-950 shrink-0 tabular-nums">{sltp1 ? `${sltp1.score} pt` : '-'}</span>
                                </div>

                                {/* SLTP 2 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                                    <span className="font-bold text-slate-800 truncate">{sltp2 ? sltp2.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-bold text-slate-700 shrink-0 tabular-nums">{sltp2 ? `${sltp2.score} pt` : '-'}</span>
                                </div>

                                {/* SLTP 3 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-50/30 border border-amber-100 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                                    <span className="font-bold text-slate-800 truncate">{sltp3 ? sltp3.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-bold text-slate-700 shrink-0 tabular-nums">{sltp3 ? `${sltp3.score} pt` : '-'}</span>
                                </div>
                              </div>
                            )}

                            {/* Sub-Podium SLTA */}
                            {(jenjangFilter === 'all' || jenjangFilter === 'SLTA') && (
                              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" /> Juara SLTA (SMA/SMK)
                                  </span>
                                </div>

                                {/* SLTA 1 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                                    <span className="font-bold text-slate-900 truncate">{slta1 ? slta1.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-black text-amber-950 shrink-0 tabular-nums">{slta1 ? `${slta1.score} pt` : '-'}</span>
                                </div>

                                {/* SLTA 2 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-800 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                                    <span className="font-bold text-slate-800 truncate">{slta2 ? slta2.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-bold text-slate-700 shrink-0 tabular-nums">{slta2 ? `${slta2.score} pt` : '-'}</span>
                                </div>

                                {/* SLTA 3 */}
                                <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-50/30 border border-amber-100 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                                    <span className="font-bold text-slate-800 truncate">{slta3 ? slta3.participant.sekolah : 'Belum Ada'}</span>
                                  </div>
                                  <span className="font-bold text-slate-700 shrink-0 tabular-nums">{slta3 ? `${slta3.score} pt` : '-'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setRekapSelectedCategoryKey(cat.key);
                              setRekapViewMode('kategori');
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Buka Tabel Kategori</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleExportExcelKategoriSpesifik(cat.key)}
                            title={`Unduh Excel ${cat.shortTitle} (Sheet SLTP & SLTA)`}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB KERANGKA: FORMULIR PENDAFTARAN RESMI PKS */}
        {/* ==================================================== */}
        {['form_polisi_pelajar', 'form_calon_pks', 'form_perkemahan_balok1', 'form_perkemahan_balok2'].includes(currentTab) && (
          <RegistrationFormsView
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            appLogo={appLogo}
            currentUser={currentUser}
            paymentConfig={paymentConfig}
            submissionsList={registrationsList}
            formPolisiPelajar={formPolisiPelajar}
            setFormPolisiPelajar={setFormPolisiPelajar}
            handleExportFormPolisiPelajarExcel={handleExportFormPolisiPelajarExcel}
            formCalonPks={formCalonPks}
            setFormCalonPks={setFormCalonPks}
            handleExportFormCalonPksExcel={handleExportFormCalonPksExcel}
            formBalok1={formBalok1}
            setFormBalok1={setFormBalok1}
            handleExportFormBalok1Excel={handleExportFormBalok1Excel}
            formBalok2={formBalok2}
            setFormBalok2={setFormBalok2}
            handleExportFormBalok2Excel={handleExportFormBalok2Excel}
            blankoConfig={blankoConfig}
            onOpenBlankoEditor={() => setModalBlankoEditorOpen(true)}
            showToast={showToast}
          />
        )}

        {/* ==================================================== */}
        {/* TAB ADMIN: REKAPITULASI PENDAFTARAN SEKOLAH MANDIRI */}
        {/* ==================================================== */}
        {currentTab === 'rekap_pendaftaran' && (
          <RegistrationSubmissionsAdminView
            submissionsList={registrationsList}
            paymentConfig={paymentConfig}
            currentUser={currentUser}
            showToast={showToast}
            onOpenPaymentSettings={() => setModalPaymentSettingsOpen(true)}
          />
        )}
      </main>

        {/* FOOTER */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 no-print mt-auto">
          Sistem Rekapitulasi Nilai Lomba PBB & PKS © 2026 • Rekap Juara Umum & Peringkat Seluruh Kategori Perlombaan.
        </footer>
      </div>
    </div>

      {/* ==================================================== */}
      {/* MODAL: KELOLA PENGGUNA (TAMBAH USER BARU - ADMIN) */}
      {/* ==================================================== */}
      {modalUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Manajemen Pengguna & Akun Juri
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tingkat Akses Anda: <span className="font-bold text-amber-300">{isSuperAdmin ? 'Administrator Utama (Akses Penuh)' : 'Admin Panitia (Akses Terbatas)'}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setModalUserOpen(false);
                  setEditingUserOriginalUsername(null);
                }}
                className="text-slate-400 hover:text-white text-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigasi Modal User */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingUserOriginalUsername(null);
                  setUserFormTab('list');
                }}
                className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  userFormTab === 'list'
                    ? 'bg-white text-blue-600 border-t-2 border-blue-600 border-x border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" /> Daftar Akun ({usersList.length})
              </button>

              <button
                onClick={() => {
                  setEditingUserOriginalUsername(null);
                  setUserFormData({
                    username: '',
                    password: '',
                    name: '',
                    role: 'juri'
                  });
                  setUserFormTab('add');
                }}
                className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  userFormTab === 'add'
                    ? 'bg-white text-blue-600 border-t-2 border-blue-600 border-x border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Tambah Pengguna Baru
              </button>

              {editingUserOriginalUsername && (
                <button
                  onClick={() => setUserFormTab('edit')}
                  className={`py-2 px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    userFormTab === 'edit'
                      ? 'bg-white text-amber-600 border-t-2 border-amber-600 border-x border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Edit className="w-4 h-4 text-amber-500" /> Edit: @{editingUserOriginalUsername}
                </button>
              )}
            </div>

            {/* TAB 1: FORM TAMBAH PENGGUNA */}
            {userFormTab === 'add' && (
              <form onSubmit={handleSaveUser} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                  <strong>Tambah Akun Baru:</strong> Buat akun juri lapangan, admin panitia, atau akun tamu untuk kontingen sekolah.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Username Akun *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: juri_pbb, juri2, dll"
                    value={userFormData.username}
                    onChange={e => setUserFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Username otomatis disesuaikan menjadi huruf kecil tanpa spasi.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password Akun *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan password untuk login"
                    value={userFormData.password}
                    onChange={e => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Password disimpan untuk login aplikasi.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Lengkap / Identitas Resmi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Aiptu Dedi Suhendra, S.H. (Juri PBB)"
                    value={userFormData.name}
                    onChange={e => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Nama ini akan tercatat secara otomatis pada riwayat lembar penilaian.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Peran Hak Akses (Role) *
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={e => setUserFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                  >
                    {isSuperAdmin && (
                      <option value="superadmin">Administrator Utama / Super Admin (Akses Penuh Tanpa Batas)</option>
                    )}
                    <option value="admin">Admin Panitia (Akses Terbatas: Kelola Peserta, Nilai & Akun Sekolah)</option>
                    <option value="juri">Juri Lapangan (Bisa Input, Upload Foto Form, & Perbarui Nilai Lomba)</option>
                    <option value="sekolah">Perwakilan Sekolah (Kelola Kontingen & Formulir Pendaftaran)</option>
                    <option value="user">User / Tamu / Peninjau (Hanya Lihat Nilai Mentah & Cetak)</option>
                  </select>
                </div>

                {userFormData.role === 'sekolah' && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-emerald-900">Data Khusus Akun Sekolah:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Sekolah</label>
                        <input
                          type="text"
                          value={userFormData.schoolName || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, schoolName: e.target.value }))}
                          placeholder="SMP Negeri 1..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                        <select
                          value={userFormData.schoolLevel || 'SLTP'}
                          onChange={e => setUserFormData(prev => ({ ...prev, schoolLevel: e.target.value as SchoolLevel }))}
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none font-bold"
                        >
                          <option value="SLTP">SLTP (SMP / MTs)</option>
                          <option value="SLTA">SLTA (SMA / SMK / MA)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Pembina</label>
                        <input
                          type="text"
                          value={userFormData.pembinaName || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, pembinaName: e.target.value }))}
                          placeholder="Nama guru pembina..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. WhatsApp</label>
                        <input
                          type="text"
                          value={userFormData.contactWa || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, contactWa: e.target.value }))}
                          placeholder="081234..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUserFormTab('list')}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" /> Simpan Pengguna Baru
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: EDIT PENGGUNA & PASSWORD */}
            {userFormTab === 'edit' && editingUserOriginalUsername && (
              <form onSubmit={handleUpdateUser} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold">Mode Edit Akun Pengguna:</span>
                    <span className="ml-1.5 font-mono bg-amber-100 px-2 py-0.5 rounded font-black text-amber-950">
                      @{editingUserOriginalUsername}
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-700">Perubahan akan langsung aktif</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingUserOriginalUsername === 'admin' || editingUserOriginalUsername === 'administrator'}
                    placeholder="Username"
                    value={userFormData.username}
                    onChange={e => setUserFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {editingUserOriginalUsername === 'admin' || editingUserOriginalUsername === 'administrator' ? (
                    <p className="text-[11px] text-slate-400 mt-1">Username akun Administrator Utama dikunci oleh sistem.</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">Jika username diubah, login berikutnya wajib memakai username baru.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Password Akun Baru / Ubah Password *</span>
                    <span className="text-amber-700 font-semibold text-[11px] lowercase">Ketik password baru untuk mengganti</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Masukkan password baru untuk akun ini"
                      value={userFormData.password}
                      onChange={e => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full border border-amber-300 bg-amber-50/30 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Password saat ini ditampilkan di atas. Anda dapat langsung mengetikkan password baru untuk memperbarui login akun ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Lengkap / Identitas Resmi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Juri / Petugas"
                    value={userFormData.name}
                    onChange={e => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Nama ini akan tercatat otomatis di lembar penilaian dan berkas cetak.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Peran Hak Akses (Role) *
                  </label>
                  <select
                    value={userFormData.role}
                    disabled={editingUserOriginalUsername === 'admin' || editingUserOriginalUsername === 'administrator' || (!isSuperAdmin && userFormData.role === 'superadmin')}
                    onChange={e => setUserFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {isSuperAdmin && (
                      <option value="superadmin">Administrator Utama / Super Admin (Akses Penuh Tanpa Batas)</option>
                    )}
                    <option value="admin">Admin Panitia (Akses Terbatas: Kelola Peserta, Nilai & Akun Sekolah)</option>
                    <option value="juri">Juri Lapangan (Bisa Input, Upload Foto Form, & Perbarui Nilai Lomba)</option>
                    <option value="sekolah">Perwakilan Sekolah (Kelola Kontingen & Formulir Pendaftaran)</option>
                    <option value="user">User / Tamu / Peninjau (Hanya Lihat Nilai Mentah & Cetak)</option>
                  </select>
                  {(editingUserOriginalUsername === 'admin' || editingUserOriginalUsername === 'administrator') && (
                    <p className="text-[11px] text-slate-400 mt-1">Hak akses Administrator Utama tidak dapat diturunkan.</p>
                  )}
                  {!isSuperAdmin && (
                    <p className="text-[11px] text-amber-700 mt-1">Hanya Administrator Utama yang dapat memberikan atau mengubah role Super Admin.</p>
                  )}
                </div>

                {userFormData.role === 'sekolah' && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-amber-900">Data Khusus Akun Sekolah:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Sekolah</label>
                        <input
                          type="text"
                          value={userFormData.schoolName || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, schoolName: e.target.value }))}
                          placeholder="SMP Negeri 1..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Jenjang</label>
                        <select
                          value={userFormData.schoolLevel || 'SLTP'}
                          onChange={e => setUserFormData(prev => ({ ...prev, schoolLevel: e.target.value as SchoolLevel }))}
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none font-bold"
                        >
                          <option value="SLTP">SLTP (SMP / MTs)</option>
                          <option value="SLTA">SLTA (SMA / SMK / MA)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Nama Pembina</label>
                        <input
                          type="text"
                          value={userFormData.pembinaName || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, pembinaName: e.target.value }))}
                          placeholder="Nama guru pembina..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">No. WhatsApp</label>
                        <input
                          type="text"
                          value={userFormData.contactWa || ''}
                          onChange={e => setUserFormData(prev => ({ ...prev, contactWa: e.target.value }))}
                          placeholder="081234..."
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCancelEditUser}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Simpan Perubahan Akun & Password
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: DAFTAR PENGGUNA TERDAFTAR */}
            {userFormTab === 'list' && (
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">Hierarki Hak Akses:</span>
                    <span className="ml-1 text-slate-600">
                      <strong>Super Admin</strong> (semua kontrol & darurat), <strong>Admin Panitia</strong> (peserta, nilai & sekolah), <strong>Juri</strong> (input nilai), <strong>Sekolah</strong> (biodata peserta & form).
                    </span>
                  </div>
                  <span className="font-semibold text-slate-700 shrink-0">Total {usersList.length} Pengguna</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-bold uppercase text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Username</th>
                        <th className="p-3">Password</th>
                        <th className="p-3">Nama Lengkap</th>
                        <th className="p-3 text-center">Peran Akses</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {usersList.map(u => {
                        const isUserSuperAdmin = u.role === 'superadmin' || u.username === 'admin' || u.username === 'administrator';
                        return (
                          <tr key={u.username} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{u.username}</span>
                                {currentUser?.username === u.username && (
                                  <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.2 rounded">
                                    Anda
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                                {u.password || '••••••'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">{u.name}</td>
                            <td className="p-3 text-center">
                              {isUserSuperAdmin ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-300">
                                  SUPER ADMIN
                                </span>
                              ) : u.role === 'admin' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300">
                                  ADMIN TERBATAS
                                </span>
                              ) : u.role === 'juri' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                  JURI LAPANGAN
                                </span>
                              ) : u.role === 'sekolah' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  SEKOLAH
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-300">
                                  TAMU
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Tombol Edit User & Password */}
                                {!isSuperAdmin && isUserSuperAdmin ? (
                                  <span className="text-[10px] text-slate-400 italic px-1 font-semibold flex items-center gap-0.5">
                                    <Lock className="w-3 h-3 text-slate-400" /> Terkunci
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleStartEditUser(u)}
                                    title="Edit Data Pengguna & Ubah Password"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Tombol Hapus User */}
                                {!isUserSuperAdmin && currentUser?.username !== u.username ? (
                                  (!isSuperAdmin && u.role === 'admin') ? null : (
                                    <button
                                      onClick={() => handleDeleteUser(u.username)}
                                      title="Hapus Akun Pengguna"
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )
                                ) : isUserSuperAdmin && currentUser?.username !== u.username ? (
                                  <span className="text-[10px] text-slate-400 italic px-1">Kunci</span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <p className="text-[11px] text-slate-500">
                    Klik ikon <Edit className="w-3.5 h-3.5 inline text-blue-600" /> pada baris akun untuk mengedit identitas atau mereset password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUserOriginalUsername(null);
                      setUserFormData({ username: '', password: '', name: '', role: 'juri' });
                      setUserFormTab('add');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" /> Tambah User Baru
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: PENGATURAN NILAI MAKSIMAL (ADMIN KHUSUS) */}
      {/* ==================================================== */}
      {modalConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Pengaturan Nilai Maksimal Juknis Panitia
              </h3>
              <button
                onClick={() => setModalConfigOpen(false)}
                className="text-slate-400 hover:text-white text-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
              <p>
                Administrator dapat menyesuaikan nilai maksimal dan status wajib untuk setiap kategori sesuai dengan Petunjuk Teknis (Juknis) resmi yang berlaku.
              </p>
            </div>

            <form onSubmit={handleSaveCategoriesConfig} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-3">
                {tempCategoriesConfig.map((cat, idx) => (
                  <div
                    key={cat.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        {cat.group}
                      </span>
                      <strong className="text-sm text-slate-800">{cat.title}</strong>
                      <span className="text-xs text-slate-400 block">
                        {cat.criteria.length} Butir Kriteria Penilaian
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                          Nilai Maksimal:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={cat.maxPoints}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setTempCategoriesConfig(prev =>
                              prev.map((c, i) => (i === idx ? { ...c, maxPoints: val } : c))
                            );
                          }}
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white font-bold text-center"
                        />
                      </div>

                      <div className="pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={cat.isMandatory}
                            onChange={e => {
                              const checked = e.target.checked;
                              setTempCategoriesConfig(prev =>
                                prev.map((c, i) => (i === idx ? { ...c, isMandatory: checked } : c))
                              );
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          Wajib
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={handleResetCategoriesToDefault}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke Standar Awal
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalConfigOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TAMBAH / EDIT PESERTA */}
      {/* ==================================================== */}
      {modalPesertaOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                {editingPesertaId ? 'Edit Identitas Peserta' : 'Tambah Peserta Baru'}
              </h3>
              <button
                onClick={() => setModalPesertaOpen(false)}
                className="text-slate-400 hover:text-white text-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePeserta} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor Peserta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 01"
                  value={pesertaFormData.nomor}
                  onChange={e => setPesertaFormData(prev => ({ ...prev, nomor: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  Tingkat / Jenjang Pendidikan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPesertaFormData(prev => ({ ...prev, jenjang: 'SLTP' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      pesertaFormData.jenjang === 'SLTP'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>SLTP (SMP / MTs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPesertaFormData(prev => ({ ...prev, jenjang: 'SLTA' }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      pesertaFormData.jenjang === 'SLTA'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>SLTA (SMA / SMK / MA)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Sekolah / Asal Kontingen *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    pesertaFormData.jenjang === 'SLTP'
                      ? 'Contoh: SMPN 1 Majalengka'
                      : 'Contoh: SMAN 1 Majalengka'
                  }
                  value={pesertaFormData.sekolah}
                  onChange={e => setPesertaFormData(prev => ({ ...prev, sekolah: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Nama Peleton / Regu
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">(Opsional - Boleh Kosong)</span>
                </div>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak ada nama regu khusus"
                  value={pesertaFormData.peleton}
                  onChange={e => setPesertaFormData(prev => ({ ...prev, peleton: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Hari / Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={pesertaFormData.tanggal}
                    onChange={e => setPesertaFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Juri Penilai *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Juri"
                    value={pesertaFormData.juri}
                    onChange={e => setPesertaFormData(prev => ({ ...prev, juri: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalPesertaOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: PRINT LEMBAR NILAI */}
      {/* ==================================================== */}
      {modalPrintOpen && printTargetParticipant && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 flex justify-center">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center no-print">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" /> Lembar Penilaian Peserta Resmi
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak / PDF
                </button>
                <button
                  onClick={() => setModalPrintOpen(false)}
                  className="text-slate-400 hover:text-white p-1 ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-800 text-xs sm:text-sm">
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h2 className="text-xl font-black tracking-wider uppercase">
                  LEMBAR PENILAIAN RESMI LOMBA PBB & PKS
                </h2>
                <p className="text-xs text-slate-600 font-semibold tracking-wide mt-0.5">
                  TINGKAT {printTargetParticipant.jenjang || 'SLTP'} • REKAPITULASI {categories.length} KATEGORI LOMBA
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs mb-4">
                <div className="space-y-1">
                  <p><strong>Nomor Peserta:</strong> {printTargetParticipant.nomor}</p>
                  <p><strong>Tingkat:</strong> {printTargetParticipant.jenjang || 'SLTP'}</p>
                  <p><strong>Nama Sekolah:</strong> {printTargetParticipant.sekolah}</p>
                  {printTargetParticipant.peleton && (
                    <p><strong>Nama Peleton:</strong> {printTargetParticipant.peleton}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p><strong>Hari / Tanggal:</strong> {printTargetParticipant.tanggal}</p>
                  <p><strong>Nama Juri:</strong> {printTargetParticipant.juri}</p>
                  <p>
                    <strong>Peringkat Klasemen:</strong>{' '}
                    {printTargetParticipant.rank
                      ? `Peringkat / Juara ${printTargetParticipant.rank}`
                      : 'Belum Lengkap'}
                  </p>
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 text-left mb-6">
                <thead className="bg-slate-100 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Kategori Lomba</th>
                    <th className="p-2 text-center">Nilai Maksimal</th>
                    <th className="p-2 text-center">Nilai Diperoleh</th>
                    <th className="p-2 text-center">Pencapaian (%)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categories.map((cat, idx) => {
                    const summary = printTargetParticipant.calc?.categorySummaries[cat.key];
                    return (
                      <tr key={cat.key}>
                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-semibold">{cat.title}</td>
                        <td className="p-2 text-center font-bold">{cat.maxPoints}</td>
                        <td className="p-2 text-center font-bold text-blue-700">
                          {summary?.sum || 0}
                        </td>
                        <td className="p-2 text-center">
                          {(summary?.pct || 0).toFixed(2)}%
                        </td>
                        <td className="p-2 text-center">
                          {summary?.isComplete ? 'Selesai' : 'Belum Lengkap'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400">
                  <tr>
                    <td colSpan={2} className="p-2.5 text-right uppercase">TOTAL NILAI AKHIR:</td>
                    <td className="p-2.5 text-center">{printTargetParticipant.calc?.maxGrandTotal}</td>
                    <td className="p-2.5 text-center text-sm font-black text-amber-700">
                      {printTargetParticipant.calc?.grandTotal}
                    </td>
                    <td className="p-2.5 text-center text-sm">
                      {(printTargetParticipant.calc?.grandPct || 0).toFixed(2)}%
                    </td>
                    <td className="p-2.5 text-center">
                      {printTargetParticipant.calc?.mandatoryCompleted ? 'LENGKAP' : 'PENDING'}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="mt-12 pt-4 flex justify-between text-xs text-center">
                <div>
                  <p className="mb-14">Ketua Panitia Pelaksana,</p>
                  <p className="font-bold underline">( .................................................... )</p>
                </div>
                <div>
                  <p className="mb-14">Juri Penilai Lapangan,</p>
                  <p className="font-bold underline">( {printTargetParticipant.juri} )</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: PRATINJAU & CETAK FORMAT BLANKO LEMBAR PENILAIAN JURI */}
      {/* ==================================================== */}
      {modalBlankSheetOpen && (() => {
        const targetBlankCat = categories.find(c => c.key === blankSheetCatKey) || categories[0];
        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 flex justify-center print:p-0 print:bg-white">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print-modal-container">
              {/* Modal Toolbar (no-print) */}
              <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap justify-between items-center gap-3 no-print">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm sm:text-base leading-tight">
                      Format Blanko Penilaian Juri Lapangan
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Siap dicetak ke kertas fisik atau diunduh sebagai file Excel (.xlsx)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Selector Kategori */}
                  <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700">
                    <span className="text-[11px] text-slate-300 font-semibold hidden sm:inline">Mata Lomba:</span>
                    <select
                      value={blankSheetCatKey}
                      onChange={e => setBlankSheetCatKey(e.target.value as CategoryKey)}
                      className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                    >
                      {categories.map((c, i) => (
                        <option key={c.key} value={c.key} className="bg-slate-900 text-white">
                          {i + 1}. {c.title} ({c.maxPoints} Poin)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unduh Excel (.xlsx) Kategori Ini */}
                  <button
                    onClick={() => handleDownloadBlankScoreSheet(targetBlankCat.key)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition"
                    title="Unduh format Excel (.xlsx) untuk kriteria lomba ini"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>

                  {/* Unduh Master Workbook 11 Kategori */}
                  <button
                    onClick={handleDownloadMasterBlankWorkbook}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition hidden md:flex"
                    title="Unduh seluruh 11 kriteria dalam satu file Excel multi-sheet"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Master 11 Kategori</span>
                  </button>

                  {/* Cetak Fisik / PDF */}
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / PDF</span>
                  </button>

                  <button
                    onClick={() => setModalBlankSheetOpen(false)}
                    className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Blank Sheet Content */}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-900 text-xs sm:text-sm bg-white">
                {/* KOP RESMI */}
                <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    PANITIA PELAKSANA LOMBA TINGKAT SLTP & SLTA
                  </h3>
                  <h2 className="text-lg sm:text-xl font-black tracking-wide uppercase mt-0.5">
                    LEMBAR FORM PENILAIAN JURI LAPANGAN
                  </h2>
                  <div className="flex flex-wrap justify-center items-center gap-3 mt-1 text-xs">
                    <span className="font-extrabold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      MATA LOMBA: {targetBlankCat.title.toUpperCase()}
                    </span>
                    <span className="font-bold text-slate-700">
                      NILAI MAKSIMAL: {targetBlankCat.maxPoints} POIN
                    </span>
                    <span className="text-slate-500">
                      ({targetBlankCat.criteria.length} Butir Kriteria)
                    </span>
                  </div>
                </div>

                {/* IDENTITAS PESERTA (BLANKO UNTUK DIISI JURI) */}
                <div className="border border-slate-400 rounded-xl p-3.5 mb-4 bg-slate-50/50 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Nomor Urut Peserta</span>
                      <span className="mr-2">:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
                    </div>
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Hari / Tanggal</span>
                      <span className="mr-2">:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
                    </div>
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Nama Sekolah</span>
                      <span className="mr-2">:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
                    </div>
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Jenjang Tingkat</span>
                      <span className="mr-2">:</span>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 border border-slate-600 rounded-xs" /> SLTP</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 border border-slate-600 rounded-xs" /> SLTA</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Nama Regu / Peleton</span>
                      <span className="mr-2">:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
                    </div>
                    <div className="flex items-center">
                      <span className="w-36 font-bold text-slate-700">Nama Juri Penilai</span>
                      <span className="mr-2">:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
                    </div>
                  </div>
                </div>

                {/* TABEL KRITERIA PENILAIAN */}
                <table className="w-full text-xs border border-slate-400 text-left mb-4">
                  <thead className="bg-slate-100 font-bold border-b border-slate-400 text-slate-800 uppercase">
                    <tr>
                      <th className="p-2 text-center w-10 border-r border-slate-300">No</th>
                      <th className="p-2 border-r border-slate-300">Kriteria Penilaian</th>
                      <th className="p-2 text-center w-12 border-r border-slate-300 bg-rose-50/50">
                        KS<br />
                        <span className="text-[9px] font-normal text-slate-500">{targetBlankCat.criteria[0]?.weights[0]}</span>
                      </th>
                      <th className="p-2 text-center w-12 border-r border-slate-300 bg-amber-50/50">
                        K<br />
                        <span className="text-[9px] font-normal text-slate-500">{targetBlankCat.criteria[0]?.weights[1]}</span>
                      </th>
                      <th className="p-2 text-center w-12 border-r border-slate-300 bg-sky-50/50">
                        C<br />
                        <span className="text-[9px] font-normal text-slate-500">{targetBlankCat.criteria[0]?.weights[2]}</span>
                      </th>
                      <th className="p-2 text-center w-12 border-r border-slate-300 bg-blue-50/50">
                        B<br />
                        <span className="text-[9px] font-normal text-slate-500">{targetBlankCat.criteria[0]?.weights[3]}</span>
                      </th>
                      <th className="p-2 text-center w-12 border-r border-slate-300 bg-emerald-50/50">
                        A<br />
                        <span className="text-[9px] font-normal text-slate-500">{targetBlankCat.criteria[0]?.weights[4]}</span>
                      </th>
                      <th className="p-2 text-center w-24 border-r border-slate-300 bg-slate-50">
                        Nilai Juri
                      </th>
                      <th className="p-2 text-center w-36">
                        Catatan Juri
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {targetBlankCat.criteria.map(crit => (
                      <tr key={crit.no} className="hover:bg-slate-50/50">
                        <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-300">
                          {crit.no}
                        </td>
                        <td className="p-2 font-semibold text-slate-900 border-r border-slate-300">
                          {crit.name}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-700">
                          {crit.weights[0]}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-700">
                          {crit.weights[1]}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-700">
                          {crit.weights[2]}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-700">
                          {crit.weights[3]}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-700 font-bold">
                          {crit.weights[4]}
                        </td>
                        <td className="p-2 text-center border-r border-slate-300 bg-slate-50/30">
                          <div className="w-10 h-6 border border-slate-300 rounded mx-auto" />
                        </td>
                        <td className="p-2">
                          <div className="border-b border-dotted border-slate-400 h-5" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black border-t-2 border-slate-400">
                    <tr>
                      <td colSpan={2} className="p-2.5 text-right uppercase border-r border-slate-300">
                        TOTAL NILAI AKHIR (MAKS. {targetBlankCat.maxPoints} POIN):
                      </td>
                      <td colSpan={5} className="p-2.5 text-center text-slate-500 text-[10px] border-r border-slate-300">
                        Jumlah akumulasi poin pilihan
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-300 font-bold">
                        [ ........ / {targetBlankCat.maxPoints} ]
                      </td>
                      <td className="p-2.5 text-center text-[10px] text-slate-400">
                        Paraf: ( .......... )
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* PETUNJUK PENILAIAN & TANDA TANGAN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mt-4 pt-2">
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 text-[11px] text-slate-700 space-y-1">
                    <strong className="block text-slate-900 font-bold uppercase mb-1">
                      Petunjuk Penilaian Juri:
                    </strong>
                    <p>1. <strong>KS</strong>: Kurang Sekali, <strong>K</strong>: Kurang, <strong>C</strong>: Cukup, <strong>B</strong>: Baik, <strong>A</strong>: Sangat Baik / Maksimal.</p>
                    <p>2. Beri tanda centang (✓) atau lingkari salah satu kolom bobot pada setiap kriteria.</p>
                    <p>3. Lembar fisik yang telah diisi dapat difoto untuk dipindai otomatis via menu <strong>Upload Foto Form</strong> pada aplikasi.</p>
                  </div>

                  <div className="text-center text-xs space-y-1">
                    <p className="text-slate-600">..........................., ........................................ 2026</p>
                    <p className="font-bold text-slate-800">Juri Penilai Lapangan,</p>
                    <div className="h-16" />
                    <p className="font-bold underline text-slate-900">( ..................................................................... )</p>
                    <p className="text-[11px] text-slate-500">Nama Terang & NIP / NRP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================================================== */}
      {/* MODAL: DAFTAR NAMA PESERTA & SEKOLAH (DOWNLOAD & CETAK) */}
      {/* ==================================================== */}
      {modalDaftarPesertaOpen && (() => {
        const filteredList = pesertaList.filter(p => {
          const matchJenjang = daftarPesertaFilterJenjang === 'all' || (p.jenjang || 'SLTP') === daftarPesertaFilterJenjang;
          const q = daftarPesertaSearch.toLowerCase().trim();
          const matchSearch =
            !q ||
            p.sekolah.toLowerCase().includes(q) ||
            p.nomor.toLowerCase().includes(q) ||
            (p.peleton && p.peleton.toLowerCase().includes(q)) ||
            p.juri.toLowerCase().includes(q);
          return matchJenjang && matchSearch;
        });

        const totalSLTP = pesertaList.filter(p => (p.jenjang || 'SLTP') === 'SLTP').length;
        const totalSLTA = pesertaList.filter(p => p.jenjang === 'SLTA').length;

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 flex justify-center print:p-0 print:bg-white">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print-modal-container">
              {/* Toolbar Atas (no-print) */}
              <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap justify-between items-center gap-3 no-print shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                    <Users className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                      <span>Daftar Nama Peserta & Sekolah Kontingen</span>
                      <span className="text-[11px] bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                        {pesertaList.length} Terdaftar
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Daftar resmi kontingen lomba PKS. Siap diunduh ke Excel (.xlsx) atau dicetak untuk presensi juri/panitia.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Unduh Excel Sesuai Filter */}
                  <button
                    onClick={() => handleExportDaftarPesertaExcel(daftarPesertaFilterJenjang)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition"
                    title="Unduh seluruh daftar nama peserta & sekolah ke format Excel (.xlsx)"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Excel (.xlsx)</span>
                  </button>

                  {/* Cetak / Simpan PDF */}
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition"
                    title="Cetak lembar daftar hadir / presensi peserta lomba"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak / PDF</span>
                  </button>

                  <button
                    onClick={() => setModalDaftarPesertaOpen(false)}
                    className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter Bar (no-print) */}
              <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Filter Tingkat:</span>
                  <div className="inline-flex rounded-xl bg-white border border-slate-300 p-0.5 text-xs font-bold">
                    <button
                      onClick={() => setDaftarPesertaFilterJenjang('all')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        daftarPesertaFilterJenjang === 'all'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({pesertaList.length})
                    </button>
                    <button
                      onClick={() => setDaftarPesertaFilterJenjang('SLTP')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        daftarPesertaFilterJenjang === 'SLTP'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      SLTP ({totalSLTP})
                    </button>
                    <button
                      onClick={() => setDaftarPesertaFilterJenjang('SLTA')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        daftarPesertaFilterJenjang === 'SLTA'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      SLTA ({totalSLTA})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari sekolah, no, atau peleton..."
                      value={daftarPesertaSearch}
                      onChange={e => setDaftarPesertaSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  {daftarPesertaSearch && (
                    <button
                      onClick={() => setDaftarPesertaSearch('')}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Tabel Daftar Peserta & Sekolah */}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white">
                {/* Header Dokumen Cetak */}
                <div className="text-center border-b-2 border-slate-900 pb-3 mb-5">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    PANITIA PELAKSANA LOMBA PATROLI KEAMANAN SEKOLAH (PKS) TAHUN 2026
                  </h3>
                  <h2 className="text-lg sm:text-xl font-black tracking-wide uppercase mt-0.5">
                    DAFTAR RESMI NAMA PESERTA & KONTINGEN SEKOLAH
                  </h2>
                  <div className="flex flex-wrap justify-center items-center gap-3 mt-1.5 text-xs">
                    <span className="font-extrabold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      TINGKAT: {daftarPesertaFilterJenjang === 'all' ? 'SEMUA TINGKAT (SLTP & SLTA)' : daftarPesertaFilterJenjang}
                    </span>
                    <span className="font-bold text-slate-700">
                      Total: {filteredList.length} Kontingen Terdaftar
                    </span>
                    <span className="text-slate-500">
                      Tanggal: {new Date().toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs mb-5">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 font-bold uppercase text-slate-700 border-b border-slate-300">
                      <tr>
                        <th className="py-3 px-3 text-center w-12 border-r border-slate-200">No</th>
                        <th className="py-3 px-3 text-center w-20 border-r border-slate-200">No. Peserta</th>
                        <th className="py-3 px-3 text-center w-20 border-r border-slate-200">Tingkat</th>
                        <th className="py-3 px-4 border-r border-slate-200">Nama Sekolah & Peleton</th>
                        <th className="py-3 px-3 border-r border-slate-200">Hari / Tanggal</th>
                        <th className="py-3 px-3 border-r border-slate-200">Juri Penilai</th>
                        <th className="py-3 px-3 text-center border-r border-slate-200">Kelengkapan</th>
                        <th className="py-3 px-3 text-center border-r border-slate-200">Total Nilai</th>
                        <th className="py-3 px-3 text-center w-28 no-print">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            Tidak ada peserta atau sekolah yang cocok dengan pencarian / filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((p, index) => {
                          const calc = calculateAllCategories(p, categories);
                          const isComplete = calc?.mandatoryCompleted;
                          const completedCount = calc?.completedCategoriesCount || 0;
                          const totalCat = categories.length;
                          const grandTotal = calc?.grandTotal || 0;
                          const isActive = activePesertaId === p.id;

                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-blue-50/40 transition ${
                                isActive ? 'bg-blue-50/60 font-semibold' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center text-slate-400 border-r border-slate-200">
                                {index + 1}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-200 font-mono">
                                {p.nomor}
                              </td>
                              <td className="py-3 px-3 text-center border-r border-slate-200">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    p.jenjang === 'SLTA'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {p.jenjang || 'SLTP'}
                                </span>
                              </td>
                              <td className="py-3 px-4 border-r border-slate-200">
                                <strong className="text-slate-900 block text-sm leading-snug">
                                  {p.sekolah}
                                </strong>
                                {p.peleton ? (
                                  <span className="text-xs text-blue-600 font-medium">{p.peleton}</span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Tanpa Nama Regu</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-700 border-r border-slate-200">
                                {p.tanggal}
                              </td>
                              <td className="py-3 px-3 text-slate-700 border-r border-slate-200">
                                {p.juri}
                              </td>
                              <td className="py-3 px-3 text-center border-r border-slate-200">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isComplete
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : completedCount > 0
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {completedCount} / {totalCat} Selesai
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-200 tabular-nums">
                                {grandTotal > 0 ? (
                                  <div>
                                    <span className="text-blue-700 font-black">{grandTotal}</span>
                                    <span className="text-[10px] text-slate-400 block">
                                      {(calc?.grandPct || 0).toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-normal">-</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center no-print">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setActivePesertaId(p.id);
                                      setModalDaftarPesertaOpen(false);
                                      showToast(`Peserta aktif dialihkan ke ${p.sekolah}`);
                                    }}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                    title="Pilih & Buka Penilaian Peserta Ini"
                                  >
                                    Pilih
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPrintPesertaId(p.id);
                                      setModalPrintOpen(true);
                                    }}
                                    className="p-1 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                    title="Cetak Lembar Nilai Peserta"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
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

                {/* Footer Dokumen Cetak & Ringkasan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end pt-2 text-xs">
                  <div className="space-y-1 text-slate-600">
                    <p><strong>Total Peserta Terdaftar:</strong> {pesertaList.length} Kontingen Sekolah</p>
                    <p><strong>Rincian Tingkat:</strong> {totalSLTP} Sekolah SLTP, {totalSLTA} Sekolah SLTA</p>
                    <p className="text-[11px] text-slate-400 italic">
                      Dicetak otomatis melalui Sistem Rekapitulasi Nilai Lomba PKS pada {new Date().toLocaleString('id-ID')}.
                    </p>
                  </div>

                  <div className="text-center text-xs space-y-1">
                    <p className="text-slate-600">..........................., ........................................ 2026</p>
                    <p className="font-bold text-slate-800">Ketua Panitia Pelaksana Lomba,</p>
                    <div className="h-14" />
                    <p className="font-bold underline text-slate-900">( ..................................................................... )</p>
                    <p className="text-[11px] text-slate-500">NIP / NRP Panitia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================================================== */}
      {/* MODAL: IN-APP CONFIRMATION */}
      {/* ==================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  confirmModal.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">{confirmModal.title}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-xl shadow cursor-pointer ${
                  confirmModal.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.confirmText || 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: UPLOAD & SCAN FOTO FORM PENILAIAN JURI */}
      {/* ==================================================== */}
      {modalScanOpen && activeCategory && activePeserta && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 my-8 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Camera className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base leading-tight">
                    Upload & Pindai Foto Lembar Penilaian Juri
                  </h3>
                  <p className="text-xs text-blue-300">
                    Kategori: <strong className="text-white">{activeCategory.title}</strong> (Maks. {activeCategory.maxPoints} Poin • {activeCategory.criteria.length} Butir Kriteria)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalScanOpen(false);
                  setScanPreviewUrl(null);
                  setScannedResult(null);
                  setScanError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Peserta Info */}
            <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase">Target Peserta:</span>
                <span className="font-black text-slate-900">
                  [No. {activePeserta.nomor}] {activePeserta.sekolah}
                </span>
                {activePeserta.peleton && (
                  <span className="text-blue-600 font-semibold">({activePeserta.peleton})</span>
                )}
                <span className={`px-2 py-0.2 rounded font-black text-[10px] ${
                  activePeserta.jenjang === 'SLTA' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {activePeserta.jenjang || 'SLTP'}
                </span>
              </div>
              <div className="text-slate-500 font-medium">
                Juri Bertugas: <strong className="text-slate-700">{currentUser?.name || activePeserta.juri}</strong>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Langkah 1: Upload / Ambil Foto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Pilih Foto Lembar Penilaian Juri (Kamera HP / Berkas Gambar)
                </label>

                {!scanPreviewUrl ? (
                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition group">
                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition mb-2" />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600">
                      Klik untuk Memilih atau Foto Langsung Lembar Penilaian
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Mendukung format JPG, PNG, atau WEBP dari kamera ponsel maupun scan dokumen
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative shrink-0 max-w-[200px] w-full">
                      <img
                        src={scanPreviewUrl}
                        alt="Preview Form"
                        className="w-full h-36 object-contain rounded-xl border border-slate-300 bg-black/5"
                      />
                    </div>
                    <div className="flex-1 space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 uppercase font-bold text-[10px] block">Berkas Foto Terpilih:</span>
                        <strong className="text-slate-800 break-all">{scanFileName || 'foto_lembar_penilaian.jpg'}</strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 font-bold cursor-pointer transition">
                          Ganti Foto
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoFileChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setScanPreviewUrl(null);
                            setScannedResult(null);
                            setScanError(null);
                          }}
                          className="text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Pindai AI */}
              {scanPreviewUrl && !scannedResult && (
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleScanPhotoWithAI}
                    disabled={isScanning}
                    className="w-full sm:w-auto flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow cursor-pointer transition"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Sedang Menganalisis & Membaca Nilai dari Foto...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Mulai Pindai Nilai dari Foto (AI Vision)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-300 cursor-pointer transition"
                    title="Gunakan simulasi ekstraksi jika server AI belum terhubung"
                  >
                    <span>⚡ Gunakan Deteksi Cepat</span>
                  </button>
                </div>
              )}

              {/* Pesan Kesalahan / Error */}
              {scanError && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Gagal Menganalisis Gambar secara Otomatis:</strong>
                      <span>{scanError}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-rose-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateScan}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Terapkan dengan Deteksi Cepat
                    </button>
                    <span className="text-slate-500 text-[11px]">Anda juga dapat mengedit nilai secara manual di tabel penilaian.</span>
                  </div>
                </div>
              )}

              {/* Langkah 2: Hasil Pembacaan & Verifikasi */}
              {scannedResult && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                        2. Verifikasi Hasil Pembacaan Nilai Form
                      </span>
                      <p className="text-xs text-slate-500">
                        Periksa kembali nilai yang terbaca dari foto. Anda dapat menyesuaikan pilihan bila diperlukan.
                      </p>
                    </div>

                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {scannedResult.scores.length} Kriteria Terdeteksi
                    </span>
                  </div>

                  {/* Header info yang terdeteksi */}
                  {(scannedResult.detectedSekolah || scannedResult.detectedNomor) && (
                    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs flex flex-wrap items-center gap-4 text-slate-700">
                      {scannedResult.detectedNomor && (
                        <span>No. Terbaca: <strong className="text-blue-900">{scannedResult.detectedNomor}</strong></span>
                      )}
                      {scannedResult.detectedSekolah && (
                        <span>Sekolah Terbaca: <strong className="text-blue-900">{scannedResult.detectedSekolah}</strong></span>
                      )}
                      {scannedResult.notes && (
                        <span className="italic text-slate-500">Catatan: {scannedResult.notes}</span>
                      )}
                    </div>
                  )}

                  {/* Tabel Nilai Tiap Butir Kriteria */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">No</th>
                          <th className="py-2.5 px-3">Kriteria Penilaian</th>
                          <th className="py-2.5 px-3 text-center w-24">Predikat</th>
                          <th className="py-2.5 px-3 text-center w-28">Poin Terbaca</th>
                          <th className="py-2.5 px-3 text-center w-36">Sesuaikan Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {activeCategory.criteria.map(crit => {
                          const matched = scannedResult.scores.find(s => s.criterionNo === crit.no);
                          const currentScore = matched ? matched.score : crit.weights[3];
                          const currentLabel = matched ? matched.label : 'B';

                          return (
                            <tr key={crit.no} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-center text-slate-400">K{crit.no}</td>
                              <td className="py-2 px-3 font-semibold text-slate-800">{crit.name}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded font-black text-[11px] bg-blue-100 text-blue-800">
                                  {currentLabel}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-black text-slate-900 text-sm tabular-nums">
                                {currentScore} <span className="text-[10px] text-slate-400 font-normal">/ {crit.weights[4]}</span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <select
                                  value={currentScore}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    const wIdx = crit.weights.indexOf(val);
                                    const label = wIdx !== -1 ? ['KS', 'K', 'C', 'B', 'A'][wIdx] : 'B';
                                    handleAdjustScannedScore(crit.no, val, label);
                                  }}
                                  className="py-1 px-2 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 outline-none cursor-pointer"
                                >
                                  {crit.weights.map((w, idx) => (
                                    <option key={idx} value={w}>
                                      {['KS', 'K', 'C', 'B', 'A'][idx]} ({w} pt)
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Ringkasan Subtotal yang diekstrak */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold">Total Poin Form yang Diekstrak:</span>
                      <span className="text-lg font-black text-amber-400 tabular-nums">
                        {scannedResult.scores.reduce((acc, curr) => acc + curr.score, 0)} <span className="text-xs text-slate-300 font-normal">/ {activeCategory.maxPoints} Poin</span>
                      </span>
                    </div>
                    <span className="text-blue-300 font-bold">
                      {((scannedResult.scores.reduce((acc, curr) => acc + curr.score, 0) / activeCategory.maxPoints) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalScanOpen(false);
                  setScanPreviewUrl(null);
                  setScannedResult(null);
                  setScanError(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>

              {scannedResult && (
                <button
                  type="button"
                  onClick={handleApplyScannedScores}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-2 shadow cursor-pointer transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Terapkan Nilai & Simpan Foto Lembar Juri</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: LIHAT FOTO BUKTI FORM PENILAIAN JURI */}
      {/* ==================================================== */}
      {modalViewPhotoOpen && viewingPhotoData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm">
                    Foto Bukti Lembar Penilaian Juri Lapangan
                  </h3>
                  <p className="text-xs text-blue-300">
                    Kategori: {viewingPhotoData.categoryTitle} • Peserta: [No. {viewingPhotoData.participantNomor}] {viewingPhotoData.participantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalViewPhotoOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-100 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 text-slate-600">
              <span>Waktu Unggah: <strong>{viewingPhotoData.uploadTime || '-'}</strong></span>
              <span>Juri Penilai: <strong>{viewingPhotoData.juriName || '-'}</strong></span>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-950">
              <img
                src={viewingPhotoData.url}
                alt="Foto Lembar Penilaian Juri"
                className="max-h-[60vh] w-auto object-contain rounded-lg border border-slate-800 shadow"
              />
            </div>

            <div className="bg-white px-5 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <a
                href={viewingPhotoData.url}
                download={`Foto_Form_${viewingPhotoData.categoryTitle}_No_${viewingPhotoData.participantNomor}.jpg`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Foto
              </a>
              <button
                onClick={() => setModalViewPhotoOpen(false)}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: PENGATURAN LOGO APLIKASI */}
      {/* ==================================================== */}
      <LogoSettingModal
        isOpen={modalLogoOpen}
        onClose={() => setModalLogoOpen(false)}
        currentLogo={appLogo}
        onSaveLogo={handleSaveLogoUrl}
        onResetLogo={handleResetLogo}
        showToast={showToast}
      />

      {/* ==================================================== */}
      {/* MODAL: KELOLA AKUN SEKOLAH */}
      {/* ==================================================== */}
      <SchoolAccountManagerModal
        isOpen={modalSchoolAccountsOpen}
        onClose={() => setModalSchoolAccountsOpen(false)}
        usersList={usersList}
        setUsersList={setUsersList}
        pesertaList={pesertaList}
        setPesertaList={setPesertaList}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        showToast={showToast}
      />

      {/* ==================================================== */}
      {/* MODAL: INFORMASI & SINKRONISASI CLOUD FIRESTORE */}
      {/* ==================================================== */}
      <CloudSyncModal
        isOpen={modalCloudInfoOpen}
        onClose={() => setModalCloudInfoOpen(false)}
        cloudStatus={cloudStatus}
        lastSynced={cloudLastSynced}
        pesertaCount={pesertaList.length}
        usersCount={usersList.length}
        onForceSyncAll={handleForceSyncAll}
        showToast={showToast}
      />

      {/* ==================================================== */}
      {/* MODAL: KONTROL STATUS APLIKASI (AKTIVASI / NONAKTIF) */}
      {/* ==================================================== */}
      <AppStatusModal
        isOpen={modalStatusOpen}
        onClose={() => setModalStatusOpen(false)}
        currentStatus={appStatus}
        onSaveStatus={handleSaveAppStatus}
        showToast={showToast}
        appLogo={appLogo}
      />

      {/* ==================================================== */}
      {/* MODAL: PENGATURAN BIAYA FORMULIR & PAYMENT GATEWAY */}
      {/* ==================================================== */}
      <PaymentGatewaySettingsModal
        isOpen={modalPaymentSettingsOpen}
        onClose={() => setModalPaymentSettingsOpen(false)}
        paymentConfig={paymentConfig}
        onSave={async (newCfg: PaymentConfig) => {
          const res = await savePaymentConfigToCloud(newCfg);
          if (res.success) {
            setPaymentConfig(newCfg);
            showToast('Pengaturan tarif & payment gateway berhasil disimpan ke Cloud!', 'success');
            return true;
          } else {
            showToast(`Gagal menyimpan ke Cloud: ${res.error}`, 'error');
            return false;
          }
        }}
        showToast={showToast}
      />

      {/* ==================================================== */}
      {/* MODAL: EDIT MASTER FORMAT BLANGKO PENDAFTARAN */}
      {/* ==================================================== */}
      <BlankoEditorModal
        isOpen={modalBlankoEditorOpen}
        onClose={() => setModalBlankoEditorOpen(false)}
        blankoConfig={blankoConfig}
        onSaveBlankoConfig={async (newCfg) => {
          const res = await saveBlankoConfigToCloud(newCfg);
          if (res.success) {
            setBlankoConfig(newCfg);
            showToast('Format blangko berhasil disimpan ke Cloud!', 'success');
            return true;
          } else {
            showToast(`Gagal menyimpan ke Cloud: ${res.error}`, 'error');
            return false;
          }
        }}
        showToast={showToast}
        appLogo={appLogo}
      />

      {/* ==================================================== */}
      {/* TOAST NOTIFICATION */}
      {/* ==================================================== */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border-l-4 text-xs sm:text-sm text-white transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-slate-900 border-rose-500'
              : toast.type === 'info'
              ? 'bg-slate-900 border-blue-500'
              : 'bg-slate-900 border-emerald-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

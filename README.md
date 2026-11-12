Rencana Implementasi: Fitur Kustomisasi Logo, Dashboard Progres Sekolah, Form Pendaftaran PKS, dan Registrasi Mandiri Sekolah
Rencana ini merinci penambahan fitur kustomisasi logo aplikasi, penyederhanaan dashboard yang berfokus pada sambutan pengguna dan visualisasi progres penilaian berdasarkan jumlah sekolah, penambahan 4 kerangka formulir pendaftaran resmi PKS di sidebar, serta pendaftaran mandiri akun sekolah.
Konfirmasi Keputusan Pengguna
Berdasarkan tanya jawab tahap 1:
Hak Akses Akun Sekolah Mandiri: Akun perwakilan sekolah hanya dapat melihat dan mengelola kontingen/peserta dari sekolahnya sendiri, menjaga privasi antar sekolah.
Tampilan Form Pendaftaran di Sidebar: Format digital interaktif lengkap dengan fitur pratinjau cetak resmi A4 dan tombol unduh/cetak blanko dokumen.
Pengaturan Logo Aplikasi: Disediakan menu upload logo khusus di pengaturan Administrator dengan pratinjau instan dan tombol reset ke logo default PKS.
1. Ikhtisar & Nilai Utama Aplikasi
Kustomisasi Identitas Acara (Logo): Panitia/Admin dapat mengunggah logo resmi kejuaraan atau logo instansi kepolisian/sekolah, yang langsung tercermin di navbar, dashboard, lembar penilaian, hingga dokumen cetak.
Dashboard Fokus & Intuitif: Menggantikan tampilan dashboard sebelumnya dengan sambutan personal pengguna dan visualisasi chart progres penilaian (sudah selesai dinilai vs belum selesai) berbasis jumlah sekolah/peserta terdaftar.
Form Pendaftaran Terpadu di Sidebar:
Pendaftaran Polisi Pelajar
Pendaftaran Calon Anggota PKS
Pendaftaran Perkemahan PKS Balok 1
Pendaftaran PKS Balok 2
Registrasi Mandiri untuk Sekolah: Memungkinkan sekolah mendaftarkan akun secara mandiri langsung dari halaman login tanpa harus dibuatkan manual satu per satu oleh administrator.
2. Rincian Fitur & Pengalaman Pengguna (UX)
A. Pengaturan Logo Aplikasi (Custom Logo)
Akses: Tombol di Pengaturan Admin (dan menu header/sidebar untuk Admin).
Format Dukungan: File gambar (PNG, JPG, SVG, WebP) dengan batas ukuran otomatis dikonversi ke Base64 data URL dan disimpan ke localStorage.
Fitur:
Upload file logo dari perangkat lokal.
Pratinjau ukuran di navbar dan kop surat dokumen.
Tombol Reset ke Logo Default Lambang PKS.
Sinkronisasi otomatis ke header aplikasi, blanko form penilaian, kartu peserta, dan cetak form.
B. Dashboard Baru: Sambutan Pengguna & Chart Progres Penilaian
Header Sambutan:
Banner elegan dengan ucapan dinamis berdasarkan waktu (Selamat Pagi/Siang/Sore/Malam), nama pengguna yang sedang login, dan badge peran (Administrator, Juri Lapangan, Akun Sekolah, atau Tamu).
Visual Chart & Statistik Progres Penilaian:
KPI Cards:
Total Sekolah / Kontingen Terdaftar.
Jumlah Sekolah / Peserta Sudah Selesai Dinilai (100% kriteria wajib lengkap).
Jumlah Sekolah / Peserta Sedang Berjalan / Belum Selesai.
Jumlah Sekolah / Peserta Belum Dinilai Sama Sekali (0 poin).
Chart Progres Visual (Donut / Bar SVG Responsif):
Persentase kelengkapan penilaian keseluruhan (misal 68% Selesai).
Filter cepat jenjang: Semua Jenjang, SLTP, dan SLTA.
Tabel Ringkas Status Progres Per Sekolah:
Kolom: No. Urut, Asal Sekolah, Jenjang, Kategori Selesai (X / 11), Status (Selesai Dinilai / Belum Lengkap), dan tombol pintasan "Lanjut Nilai".
C. 4 Kerangka Form Pendaftaran Resmi di Sidebar
Ditempatkan di dalam accordion baru di sidebar: Formulir Pendaftaran PKS & Polisi Pelajar:
Form Pendaftaran Polisi Pelajar
Data Pribadi Siswa (Nama, NISN, TTL, Kelas, Gol. Darah, Alamat).
Riwayat Pelatihan & Prestasi.
Pernyataan komitmen & persetujuan orang tua.
Form Pendaftaran Calon Anggota PKS (Patroli Keamanan Sekolah)
Identitas Calon Anggota & Pangkalan Sekolah.
Pilihan divisi minat (Gatur Lantas, PBB & Kedisiplinan, P3K & Medis, TPTKP Pelajar).
Surat izin orang tua/wali & rekomendasi kesiswaan sekolah.
Form Pendaftaran Perkemahan PKS Balok 1
Formulir Tingkat Dasar / Pelantikan Balok 1.
Data kesehatan/riwayat alergi, perlengkapan regu perkemahan, dan data pembina pendamping.
Form Pendaftaran PKS Balok 2
Formulir Tingkat Lanjutan / Kepemimpinan Balok 2 (Komandan Regu & Danton).
Verifikasi lulus Balok 1, uji kecakapan khusus, dan rekomendasi Satlantas/Polres.
Fitur Tiap Form:
Tampilan formulir interaktif bersih berstandar kop surat dinas.
Tombol Cetak Formulir A4 (Printer Friendly dengan @media print).
Tombol Unduh Blanko Kosong (.xlsx / PDF) untuk pengisian manual sekolah.
Tombol Simpan Draft Isian.
D. Pendaftaran Mandiri Akun Sekolah (Self-Service Registration)
Antarmuka di Layar Login:
Tombol tab "Daftar Akun Sekolah Baru" di bawah form login.
Input:
Jenjang Sekolah: Pilihan SLTP / SLTA.
Nama Lengkap Sekolah (misal: SMP Negeri 1 Surabaya).
Nama Pembina / Pendamping PKS.
Nomor WhatsApp / Kontak Pembina.
Username & Password yang diinginkan.
Logika Hak Akses (Role: sekolah):
Begitu mendaftar dan login, akun otomatis memiliki filter sekolah sesuai pendaftarannya.
Sekolah dapat menambahkan peserta/peleton untuk kontingen sekolahnya sendiri.
Sekolah dapat mengisi formulir pendaftaran (Polisi Pelajar, Balok 1 & 2) khusus untuk perwakilannya.
Mencegah sekolah lain melihat atau mengotak-atik data peserta sekolah yang berbeda.
3. Arsitektur Teknis & Diagram Alur Data
Code
┌──────────────────────────────────────────────────────────────┐
│                    TOP NAVBAR DENGAN LOGO                    │
│    [Logo Kustom / Default] - Judul Aplikasi - Profil User    │
└──────────────────────────────┬───────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌─────────────────────────────┐        ┌───────────────────────────────┐
│     SIDEBAR BER-DROPDOWN    │        │       VIEWPORT UTAMA          │
│ 1. Dashboard Progres        │        │                               │
│ 2. Kategori Penilaian (11)  │───────►│  • Dashboard: Sambutan User   │
│ 3. Nama Peserta & Sekolah   │        │    + Chart Progres Penilaian  │
│ 4. Form Pendaftaran PKS:    │        │  • Lembar Penilaian Juri      │
│    - Polisi Pelajar         │        │  • Rekapitulasi Juara         │
│    - Calon Anggota PKS      │        │  • Formulir Cetak A4          │
│    - Perkemahan Balok 1     │        │  • Pengaturan Logo & Juknis   │
│    - Perkemahan Balok 2     │        └───────────────────────────────┘
│ 5. Rekapitulasi & Peringkat │
│ 6. Manajemen Admin / Logo   │
└─────────────────────────────┘
4. Rencana Kerja Bertahap
State & Penyimpanan Data:
Menambahkan state appLogo (Base64 URL) tersimpan di localStorage beserta modal/menu upload logo.
Menambahkan role 'sekolah' pada UserRole dan atribut schoolName pada akun sekolah.
Menambahkan data struktur untuk 4 template form pendaftaran (Polisi Pelajar, Calon Anggota PKS, Balok 1, Balok 2).
Dashboard Redesign:
Memperbarui komponen dashboard utama agar menampilkan kartu sambutan pengguna aktif dan grafik progres penilaian (selesai dinilai vs belum selesai) berbasis jumlah sekolah.
Form Pendaftaran PKS:
Membuat komponen viewer & cetak untuk 4 form pendaftaran di sidebar, dengan gaya kop surat formal kepolisian & PKS.
Pendaftaran Mandiri Sekolah:
Menambahkan antarmuka pendaftaran mandiri pada layar login dengan validasi dan alokasi peran sekolah otomatis.
Verifikasi & Build:
Pengujian compile_applet dan lint_applet untuk memastikan kompatibilitas TypeScript dan tidak ada error.

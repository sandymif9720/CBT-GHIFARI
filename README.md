# GHIFARI CBT — SMK AL-GHIFARI

> **Smarter Examination. Better Education.**  
> Platform Computer Based Test (CBT) Lokal untuk SMA/SMK/MA — *Developed by MARGUMI STUDIO*

---

## Ringkasan Sistem
**GHIFARI CBT** adalah platform ujian berbasis komputer (CBT) client–server yang dirancang khusus untuk berjalan di **jaringan lokal (LAN/Wi-Fi) sekolah tanpa ketergantungan internet**. Siswa mengakses ujian langsung melalui browser pada komputer lab atau perangkat sekolah, sementara seluruh data, timer ujian, auto-save jawaban, dan bank soal tersimpan aman di database **SQLite** pada komputer server.

### Fitur Utama
- **3 Role Terpisah (RBAC)**: Administrator Sekolah, Guru, dan Siswa.
- **Manajemen Master Data**: Identitas Sekolah, Jurusan, Kelas, Mata Pelajaran, Guru, dan Siswa.
- **Bank Soal & Impor Excel**: Mendukung Pilihan Ganda (A–E) dan Esai, unduh template resmi (`sheet: SOAL`), validasi baris demi baris, deteksi duplikasi, dan preview sebelum simpan.
- **Pengaturan Ujian Lengkap**: Jadwal tanggal/jam mulai–selesai, durasi, bobot PG & Esai, KKM, acak soal, acak opsi jawaban, kontrol tampilkan hasil ke siswa.
- **Ruang Ujian Siswa Fokus**: 1 soal per halaman, navigasi nomor soal, penanda Ragu-ragu, auto-save otomatis ke server, timer berbasis server, tahan refresh/putus koneksi sementara.
- **Keamanan CBT**: Password hashing `bcrypt`, JWT session, rate limiter login, 1 sesi ujian aktif per siswa, kunci jawaban tidak pernah dikirim ke browser siswa, pencatatan audit log.
- **Monitoring Real-Time**: Pantau status peserta (Hijau: Mengerjakan, Kuning: Terputus, Biru: Selesai, Merah: Waktu Habis), sisa waktu, progres soal terjawab, dan akhiri sesi paksa.
- **Penilaian & Laporan Analitik**: Koreksi PG otomatis, penilaian Esai manual dengan feedback, ranking, rata-rata, persentase kelulusan, analisis butir soal, Export Excel & Export PDF.
- **Backup & Restore Database**: Unduh dan pulihkan file SQLite langsung dari dashboard Admin maupun via skrip Windows.

---

## Akun Demo Bawaan
| Role | Username | Kata Sandi | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin Sekolah** | `admin` | `admin123` | Pengelola penuh sekolah, master data, log, backup |
| **Guru** | `guru1` | `guru123` | Budi Santoso, S.Kom. (Bank Soal, Ujian, Monitoring, Esai) |
| **Guru** | `guru2` | `guru123` | Siti Rahmawati, S.Pd. |
| **Siswa** | `siswa1` | `siswa123` | Ahmad Zaki Pratama (Kelas XI TKJ 1 — ada ujian aktif!) |
| **Siswa** | `siswa2` | `siswa123` | Nabila Putri Azzahra (Kelas XI TKJ 1 — riwayat ujian selesai) |

---

## Panduan Instalasi & Menjalankan di Server Windows (LAN 30–50 Client)

1. **Prasyarat pada Komputer Server Windows**:
   - Pasang **Node.js v20 LTS atau v22 LTS**.
   - Hubungkan komputer server ke switch/router lab sekolah dan atur **IP Statis** (contoh: `192.168.10.2`).
2. **Instalasi**:
   - Ekstrak folder proyek ke server (misal `C:\ghifari-cbt`).
   - Klik dua kali `install-windows.bat` (atau jalankan `npm install` lalu `npm run build`).
3. **Menjalankan Server**:
   - Klik dua kali `start-windows.bat` (atau jalankan `npm run dev` untuk mode pengembangan).
   - Buka Windows Defender Firewall dan izinkan **TCP Port 3000**.
4. **Akses dari Komputer Siswa (30–50 Client)**:
   - Pada browser siswa (Chrome/Edge/Firefox), buka alamat IP server:
     `http://192.168.10.2:3000` (sesuaikan dengan IP LAN server yang tampil di konsol saat server menyala).
5. **Backup Rutin**:
   - Gunakan menu **Backup Database** di dashboard Admin atau jalankan `backup-database.bat`.

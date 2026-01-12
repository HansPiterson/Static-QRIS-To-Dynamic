# QRIS Static to Dynamic Generator

Aplikasi ini mengubah **QRIS statis** menjadi **QRIS dinamis** dengan nominal pembayaran tertentu. Dilengkapi dengan fitur notifikasi pembayaran *real-time* via WebSocket, aplikasi ini siap diintegrasikan dengan *callback* pembayaran dari penyedia layanan seperti GoPay/GoBiz.

---

## Fitur Utama

* **Input QRIS Statis:** Mendukung input string QRIS statis dari merchant gopay.
* **Input Nominal Pembayaran:** Tentukan nominal yang diinginkan untuk transaksi.
* **Generasi QRIS Dinamis:** Hasilkan QRIS dinamis lengkap dengan nominal pembayaran yang diinput.
* **Tampilan Detail Merchant:** Menampilkan QR Code yang dihasilkan beserta ringkasan informasi merchant.

---

## Cara Instalasi & Menjalankan

Ikuti langkah-langkah di bawah ini untuk mengatur dan menjalankan aplikasi di lingkungan lokal Anda.

### 1. Clone Repositori & Instal Dependencies

```bash
git clone <repo-url-anda-di-sini> # Ganti dengan URL repo GitHub Anda
cd Dynamic-Qris
npm install
npm start

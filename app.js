const express = require('express');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Simpan status pembayaran di memori (untuk demo)
const paymentStatusMap = {};

// QRIS static string
const QRIS_STATIC = '00020101021126610014COM.GO-JEK.WWW01189360091437047780480210G7047780480303UMI51440014ID.CO.QRIS.WWW0215ID10243321449470303UMI5204581553033605802ID5920iCheap Digital Store6009PALEMBANG61053016362070703A0163048E1D';

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function calculateCRC(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}

function updateTag01To12(qris) {
  // Tag 01 selalu di awal, format: 01LLVV (LL=length, VV=value)
  // Ganti value jadi 12
  return qris.replace(/^01(\d{2})11/, '010212');
}

function insertTag54After53(qris, amount) {
  // Cari tag 53
  const tag53Regex = /(53\d{2}\d{3})/;
  const match = qris.match(tag53Regex);
  if (!match) return qris; // fallback
  const idx = match.index + match[0].length;
  // Buat tag 54
  const nominal = String(amount);
  const tag54 = `54${nominal.length.toString().padStart(2, '0')}${nominal}`;
  // Sisipkan tag 54 setelah tag 53
  return qris.slice(0, idx) + tag54 + qris.slice(idx);
}

function removeTag54(qris) {
  // Hapus tag 54 jika ada
  return qris.replace(/54\d{2}\d+/, '');
}

function removeCRC(qris) {
  // Hapus tag 63 (CRC) jika ada
  return qris.replace(/6304[0-9A-Fa-f]{4}$/, '');
}

function generateQRISDynamic(qrisStatic, amount) {
  // 1. Hapus CRC lama
  let qris = removeCRC(qrisStatic);
  // 2. Hapus tag 54 lama jika ada
  qris = removeTag54(qris);
  // 3. Ganti tag 01 ke 12
  qris = updateTag01To12(qris);
  // 4. Sisipkan tag 54 setelah tag 53
  qris = insertTag54After53(qris, amount);
  // 5. Tambahkan CRC baru
  const qrisForCRC = qris + '6304';
  const crc = calculateCRC(qrisForCRC);
  return qrisForCRC + crc;
}

app.post('/api/qris', async (req, res) => {
  const { qrisStatic, nominal } = req.body;
  const amount = parseInt(nominal, 10);
  if (!qrisStatic || typeof qrisStatic !== 'string' || qrisStatic.length < 20) {
    return res.status(400).json({ error: 'String QRIS statis tidak valid' });
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Nominal tidak valid' });
  }
  // Generate dynamic QRIS string
  const qrisDynamic = generateQRISDynamic(qrisStatic, amount);
  if (!qrisDynamic) {
    return res.status(500).json({ error: 'Gagal generate QRIS dinamis' });
  }
  // Generate QR code PNG (base64)
  try {
    const qrPng = await QRCode.toDataURL(qrisDynamic);
    res.json({ qris: qrisDynamic, qrPng });
  } catch (err) {
    res.status(500).json({ error: 'Gagal generate QR' });
  }
});

app.post('/api/qris-callback', (req, res) => {
  const notification = req.body;
  // Misal: notification.order_id, notification.status
  const { order_id, status } = notification;
  if (order_id && status) {
    paymentStatusMap[order_id] = status;
    // Emit ke semua client (atau bisa ke client tertentu jika ada session)
    io.emit('payment_status', { order_id, status });
  }
  res.status(200).json({ success: true });
});

// Endpoint untuk frontend polling status (opsional)
app.get('/api/payment-status/:order_id', (req, res) => {
  const { order_id } = req.params;
  res.json({ status: paymentStatusMap[order_id] || 'PENDING' });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 
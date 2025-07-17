const form = document.getElementById('qris-form');
const qrSection = document.getElementById('qr-section');
const qrImg = document.getElementById('qr-img');
const qrisString = document.getElementById('qris-string');
const errorDiv = document.getElementById('error');

const acquirerMap = {
  'COM.GO-JEK.WWW': 'gopay',
  'ID.CO.QRIS.WWW': 'QRIS Nasional',
  // tambahkan mapping lain jika perlu
};

let currentOrderId = null;

// Inisialisasi socket.io
const socket = io();
socket.on('payment_status', ({ order_id, status }) => {
  if (order_id && order_id === currentOrderId) {
    const statusDiv = document.getElementById('payment-status');
    if (status === 'COMPLETED' || status === 'PAID' || status === 'SUCCESS') {
      statusDiv.textContent = 'BERHASIL DIBAYAR';
      statusDiv.style.color = '#28a745';
    } else if (status === 'FAILED' || status === 'EXPIRED') {
      statusDiv.textContent = 'GAGAL/EXPIRED';
      statusDiv.style.color = '#c00';
    } else {
      statusDiv.textContent = status;
      statusDiv.style.color = '#333';
    }
    statusDiv.style.display = 'block';
  }
});

function extractTag(qris, tag) {
  // Format: tag(2) + len(2) + value
  const regex = new RegExp(`${tag}(\\d{2})([A-Za-z0-9 .\-]*)`);
  const match = qris.match(regex);
  if (match) {
    const len = parseInt(match[1], 10);
    return match[2].substring(0, len);
  }
  return '-';
}

function extractMerchantPAN(qris) {
  // Cari tag 26, lalu tag 02 setelahnya
  const tag26Regex = /26\d{2}([A-Za-z0-9.\-]*)/g;
  const match26 = tag26Regex.exec(qris);
  if (match26) {
    // Setelah tag 26, cari tag 02
    const after26 = qris.slice(match26.index + match26[0].length);
    const panMatch = after26.match(/02(\d{2})(\d{8,20})/); // PAN biasanya 8-20 digit
    if (panMatch) {
      const len = parseInt(panMatch[1], 10);
      return panMatch[2].substring(0, len);
    }
  }
  return '-';
}

function parseQrisTags(qris) {
  let i = 0;
  const tags = {};
  while (i < qris.length - 4) { // -4 agar tidak kena CRC
    const tag = qris.substr(i, 2);
    const len = parseInt(qris.substr(i + 2, 2), 10);
    const value = qris.substr(i + 4, len);
    tags[tag] = value;
    i += 4 + len;
  }
  return tags;
}

function parseSubTags(value) {
  let i = 0;
  const subtags = {};
  while (i < value.length) {
    const tag = value.substr(i, 2);
    const len = parseInt(value.substr(i + 2, 2), 10);
    const val = value.substr(i + 4, len);
    subtags[tag] = val;
    i += 4 + len;
    if (i > value.length - 2) break;
  }
  return subtags;
}

function showSummary(qris, amount) {
  const tags = parseQrisTags(qris);
  // Acquirer Name: tag 26 subtag 00
  let acquirerName = '-';
  if (tags['26']) {
    const sub = parseSubTags(tags['26']);
    acquirerName = acquirerMap[sub['00']] || sub['00'] || '-';
  }
  document.getElementById('acquirer-name').textContent = acquirerName;
  // Merchant Name: tag 59
  document.getElementById('merchant-name').textContent = tags['59'] || '-';
  // Lokasi Merchant: tag 60
  document.getElementById('merchant-location').textContent = tags['60'] || '-';
  // Merchant PAN: tag 26 subtag 02 (jika ada)
  let merchantPAN = '-';
  if (tags['26']) {
    const sub = parseSubTags(tags['26']);
    if (sub['02']) merchantPAN = sub['02'];
  }
  document.getElementById('merchant-pan').textContent = merchantPAN;
  // Terminal ID: tag 07
  document.getElementById('terminal-id').textContent = tags['07'] || '-';
  document.getElementById('summary-amount').textContent = amount ? `Rp ${Number(amount).toLocaleString('id-ID')}` : '-';
  document.getElementById('qris-summary').style.display = 'block';
}

function getOrderIdFromQris(qris) {
  // Untuk demo, gunakan 4 digit CRC di akhir QRIS sebagai order_id unik
  return qris.slice(-4);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.textContent = '';
  qrSection.style.display = 'none';
  document.getElementById('qris-summary').style.display = 'none';
  document.getElementById('payment-status').style.display = 'none';
  const qrisStatic = document.getElementById('qris-static').value.trim();
  const nominal = document.getElementById('nominal').value;
  if (!qrisStatic) {
    errorDiv.textContent = 'String QRIS statis wajib diisi';
    return;
  }
  if (!nominal || isNaN(nominal) || nominal <= 0) {
    errorDiv.textContent = 'Nominal tidak valid';
    return;
  }
  try {
    const res = await fetch('/api/qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrisStatic, nominal })
    });
    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Terjadi kesalahan';
      return;
    }
    qrImg.src = data.qrPng;
    qrisString.textContent = data.qris;
    qrSection.style.display = 'block';
    showSummary(data.qris, nominal);
    // Simpan order_id (pakai CRC QRIS)
    currentOrderId = getOrderIdFromQris(data.qris);
  } catch (err) {
    errorDiv.textContent = 'Gagal terhubung ke server';
  }
}); 
export interface SampleReceiptPreset {
  id: string;
  label: string;
  subtitle: string;
  merchant: string;
  address: string;
  date: string;
  time: string;
  receiptNo: string;
  paymentMethod: string;
  items: { name: string; qty: number; price: number }[];
  taxPercent: number;
  discount: number;
}

export const SAMPLE_RECEIPT_PRESETS: SampleReceiptPreset[] = [
  {
    id: 'kopi-roti',
    label: 'Struk Kopi & Bakery',
    subtitle: 'Kopi Senja Nusantara · Rp 93.500',
    merchant: 'KOPI SENJA NUSANTARA',
    address: 'Jl. Senopati No. 48, Jakarta Selatan',
    date: new Date().toISOString().slice(0, 10),
    time: '09:42',
    receiptNo: 'INV-KSN-88291',
    paymentMethod: 'QRIS',
    items: [
      { name: 'Es Kopi Susu Aren Large', qty: 2, price: 28000 },
      { name: 'Almond Croissant Butter', qty: 1, price: 29000 },
    ],
    taxPercent: 10,
    discount: 0,
  },
  {
    id: 'minimarket',
    label: 'Struk Belanja Harian',
    subtitle: 'IndoSegar Mart · Rp 164.500',
    merchant: 'INDOSEGAR MART CAB. KEMANG',
    address: 'Jl. Kemang Raya No. 12, Jakarta',
    date: new Date().toISOString().slice(0, 10),
    time: '18:15',
    receiptNo: 'POS-2026-44109',
    paymentMethod: 'Kartu Debit/Kredit',
    items: [
      { name: 'Beras Premium Pandan Wangi 5kg', qty: 1, price: 74500 },
      { name: 'Minyak Goreng Sawit 2L', qty: 1, price: 36000 },
      { name: 'Telur Ayam Negeri 1 Tray (15 btr)', qty: 1, price: 32000 },
      { name: 'Sabun Cuci Piring Jeruk Nipis', qty: 2, price: 14500 },
    ],
    taxPercent: 0,
    discount: 7000,
  },
  {
    id: 'listrik-pln',
    label: 'Bukti Tagihan Utilitas',
    subtitle: 'Token Listrik PLN & Internet · Rp 502.500',
    merchant: 'PEMBAYARAN TAGIHAN UTILITAS',
    address: 'ID Pelanggan: 538291004821 · Layanan Digital',
    date: new Date().toISOString().slice(0, 10),
    time: '13:10',
    receiptNo: 'PLN-REF-9910234',
    paymentMethod: 'Transfer Bank',
    items: [
      { name: 'Token Listrik PLN Prabayar 500k', qty: 1, price: 500000 },
      { name: 'Biaya Admin Transaksi Bank', qty: 1, price: 2500 },
    ],
    taxPercent: 0,
    discount: 0,
  },
];

/**
 * Generates a realistic thermal receipt PNG image as a base64 data URL
 * so the user can test the AI Receipt Vision scanner with 1 click.
 */
export function generateSampleReceiptDataUrl(preset: SampleReceiptPreset): string {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Paper background
  ctx.fillStyle = '#FCFBF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper border
  ctx.strokeStyle = '#E2E0D8';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Header
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(preset.merchant, canvas.width / 2, 72);

  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#4B5563';
  ctx.fillText(preset.address, canvas.width / 2, 100);

  // Dashed divider
  const drawDashedLine = (y: number) => {
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(40, y);
    ctx.lineTo(canvas.width - 40, y);
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(125);

  // Metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1F2937';
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText(`TGL : ${preset.date} ${preset.time}`, 44, 155);
  ctx.fillText(`NO  : ${preset.receiptNo}`, 44, 180);
  ctx.fillText(`BYR : ${preset.paymentMethod}`, 44, 205);

  drawDashedLine(225);

  // Column headers
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText('ITEM', 44, 252);
  ctx.textAlign = 'right';
  ctx.fillText('SUBTOTAL (RP)', canvas.width - 44, 252);

  drawDashedLine(268);

  // Items
  let y = 300;
  let subtotalSum = 0;

  for (const item of preset.items) {
    const lineSub = item.qty * item.price;
    subtotalSum += lineSub;

    ctx.textAlign = 'left';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#111827';
    ctx.fillText(item.name, 44, y);

    y += 24;
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4B5563';
    ctx.fillText(
      `${item.qty} x Rp ${item.price.toLocaleString('id-ID')}`,
      44,
      y
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#111827';
    ctx.fillText(`Rp ${lineSub.toLocaleString('id-ID')}`, canvas.width - 44, y);

    y += 34;
  }

  drawDashedLine(y - 10);
  y += 22;

  const taxAmount = Math.round((subtotalSum * preset.taxPercent) / 100);
  const grandTotal = subtotalSum + taxAmount - preset.discount;

  // Subtotal
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'left';
  ctx.fillText('SUBTOTAL', 44, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Rp ${subtotalSum.toLocaleString('id-ID')}`, canvas.width - 44, y);
  y += 26;

  if (preset.discount > 0) {
    ctx.textAlign = 'left';
    ctx.fillText('DISKON PROMO', 44, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-Rp ${preset.discount.toLocaleString('id-ID')}`, canvas.width - 44, y);
    y += 26;
  }

  if (taxAmount > 0) {
    ctx.textAlign = 'left';
    ctx.fillText(`PAJAK PB1 (${preset.taxPercent}%)`, 44, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Rp ${taxAmount.toLocaleString('id-ID')}`, canvas.width - 44, y);
    y += 26;
  }

  drawDashedLine(y);
  y += 32;

  // Grand Total
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL BAYAR', 44, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Rp ${grandTotal.toLocaleString('id-ID')}`, canvas.width - 44, y);

  y += 30;
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'left';
  ctx.fillText(`METODE PEMBAYARAN: ${preset.paymentMethod}`, 44, y);

  drawDashedLine(y + 24);

  ctx.textAlign = 'center';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('TERIMA KASIH ATAS KUNJUNGAN ANDA', canvas.width / 2, y + 58);
  ctx.fillText('BUKTI PEMBAYARAN SAH', canvas.width / 2, y + 80);

  return canvas.toDataURL('image/png');
}

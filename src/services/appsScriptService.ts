import {
  ConnectedAppsScriptSheet,
  EntrySource,
  FinanceTransaction,
  TransactionType,
} from '../types/finance';

export const PERMANENT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw-nKZ5FvR1NsRuFXbN1Bvx-2nyROJsAEF43R77tYmcogmCZmwFBWAS4GFO0ZB3Ciqw/exec';

export const PERMANENT_SHEET_NAME = 'Catatan_Keuangan';

export const APPS_SCRIPT_CODE_GS = `/**
 * ============================================================================
 * SAKUSHEET — GOOGLE APPS SCRIPT (Code.gs)
 * Manajemen Keuangan Pribadi Real-Time (Foto Bill Otomatis & Input Manual)
 * ============================================================================
 * CARA PAKAI:
 * 1. Buka Google Sheets Anda -> klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 2. Hapus kode lama di editor, lalu tempel (Paste) seluruh kode ini.
 * 3. Klik ikon Simpan (Save / Ctrl+S).
 * 4. (Opsional) Pilih fungsi "setupSheetAwal" di bagian atas lalu klik "Jalankan" (Run)
 *    untuk memberikan izin akses (Review Permissions -> Allow).
 * 5. Klik tombol biru "Terapkan" (Deploy) di kanan atas -> "Deployment baru" (New deployment).
 * 6. Pilih jenis: "Aplikasi web" (Web app).
 *    - Jalankan sebagai (Execute as): "Saya" (Me)
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone)
 * 7. Klik "Terapkan" (Deploy), salin URL Web App (berakhiran /exec),
 *    lalu tempelkan ke menu "Integrasi Apps Script" di aplikasi SakuSheet.
 */

const DEFAULT_SHEET_NAME = 'Catatan_Keuangan';
const HEADERS = [
  'ID Transaksi',
  'Tanggal',
  'Waktu',
  'Tipe',
  'Kategori',
  'Merchant / Deskripsi',
  'Metode Pembayaran',
  'Nominal (Rp)',
  'Sumber Input',
  'Rincian Item Bill',
  'Catatan'
];

// Fungsi ini bisa dijalankan langsung dari tombol "Jalankan / Run" di editor Apps Script
function setupSheetAwal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateFormattedSheet(ss, DEFAULT_SHEET_NAME);
  Logger.log('Sheet berhasil disiapkan pada: ' + ss.getName());
}

function getOrCreateFormattedSheet(ss, requestedSheetName) {
  const targetName = (requestedSheetName && String(requestedSheetName).trim()) || DEFAULT_SHEET_NAME;
  let sheet = ss.getSheetByName(targetName);

  if (!sheet) {
    sheet = ss.insertSheet(targetName);
  }

  // Jika baris pertama masih kosong, buat header otomatis dan format tampilannya
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Atur lebar kolom agar rapi
    sheet.setColumnWidth(1, 120); // ID Transaksi
    sheet.setColumnWidth(2, 105); // Tanggal
    sheet.setColumnWidth(3, 75);  // Waktu
    sheet.setColumnWidth(4, 120); // Tipe
    sheet.setColumnWidth(5, 160); // Kategori
    sheet.setColumnWidth(6, 220); // Merchant / Deskripsi
    sheet.setColumnWidth(7, 150); // Metode Pembayaran
    sheet.setColumnWidth(8, 140); // Nominal (Rp)
    sheet.setColumnWidth(9, 130); // Sumber Input
    sheet.setColumnWidth(10, 280); // Rincian Item Bill
    sheet.setColumnWidth(11, 200); // Catatan
  }

  return sheet;
}

function formatDateCell(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function formatTimeCell(val) {
  if (!val) return '12:00';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(val);
}

function readAllTransactions(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const transactions = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const id = String(row[0] || '').trim();
    if (!id) continue;

    const rawType = String(row[3] || '').toUpperCase().trim();
    const rawSource = String(row[8] || '').toUpperCase().trim();
    const numericAmount = Math.abs(Number(String(row[7] || '0').replace(/[^0-9.-]/g, '')) || 0);

    transactions.push({
      id: id,
      date: formatDateCell(row[1]),
      time: formatTimeCell(row[2]),
      type: rawType === 'PEMASUKAN' || rawType === 'INCOME' ? 'INCOME' : 'EXPENSE',
      category: String(row[4] || 'Lainnya'),
      merchantOrDescription: String(row[5] || 'Transaksi'),
      paymentMethod: String(row[6] || 'Lainnya'),
      amount: Math.round(numericAmount),
      source: rawSource.indexOf('FOTO') !== -1 || rawSource.indexOf('BILL') !== -1 ? 'BILL_PHOTO' : 'MANUAL',
      itemsSummary: String(row[9] || '-'),
      notes: String(row[10] || '-'),
      sheetRowIndex: i + 2,
      syncedToSheets: true
    });
  }

  return transactions;
}

function transactionToRowArray(tx) {
  return [
    tx.id || ('TRX-' + new Date().getTime().toString().slice(-6)),
    tx.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    tx.time || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
    tx.type === 'INCOME' ? 'PEMASUKAN' : 'PENGELUARAN',
    tx.category || 'Lainnya',
    tx.merchantOrDescription || 'Transaksi',
    tx.paymentMethod || 'Lainnya',
    Number(tx.amount) || 0,
    tx.source === 'BILL_PHOTO' ? 'FOTO BILL (AI)' : 'INPUT MANUAL',
    tx.itemsSummary || '-',
    tx.notes || '-'
  ];
}

function buildSuccessResponse(ss, sheet) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'ok',
      spreadsheetTitle: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheetName: sheet.getName(),
      transactions: readAllTransactions(sheet)
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (e && e.parameter && e.parameter.sheetName) || DEFAULT_SHEET_NAME;
    const sheet = getOrCreateFormattedSheet(ss, sheetName);
    return buildSuccessResponse(ss, sheet);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: String(err.message || err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = payload.action || 'list';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateFormattedSheet(ss, payload.sheetName || DEFAULT_SHEET_NAME);

    if (action === 'setup' || action === 'list') {
      return buildSuccessResponse(ss, sheet);
    }

    if (action === 'append') {
      const list = Array.isArray(payload.transactions)
        ? payload.transactions
        : payload.transaction
        ? [payload.transaction]
        : [];

      if (list.length > 0) {
        const rows = list.map(transactionToRowArray);
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
        sheet.getRange(startRow, 8, rows.length, 1).setNumberFormat('#,##0');
      }
      return buildSuccessResponse(ss, sheet);
    }

    if (action === 'update' && payload.transaction) {
      const tx = payload.transaction;
      const targetRow = findRowIndexByIdOrIndex(sheet, tx.id, tx.sheetRowIndex);
      if (targetRow >= 2) {
        const rowArr = transactionToRowArray(tx);
        sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([rowArr]);
        sheet.getRange(targetRow, 8).setNumberFormat('#,##0');
      }
      return buildSuccessResponse(ss, sheet);
    }

    if (action === 'delete') {
      const targetRow = findRowIndexByIdOrIndex(sheet, payload.id, payload.rowIndex);
      if (targetRow >= 2) {
        sheet.deleteRow(targetRow);
      }
      return buildSuccessResponse(ss, sheet);
    }

    return buildSuccessResponse(ss, sheet);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: String(err.message || err) })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function findRowIndexByIdOrIndex(sheet, id, fallbackRowIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && id) {
    const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0]).trim() === String(id).trim()) {
        return i + 2;
      }
    }
  }
  if (fallbackRowIndex && fallbackRowIndex >= 2 && fallbackRowIndex <= lastRow) {
    return Number(fallbackRowIndex);
  }
  return -1;
}
`;

interface AppsScriptResponse {
  status: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
  transactions?: FinanceTransaction[];
  error?: string;
}

async function callAppsScriptProxy(
  scriptUrl: string,
  payload: Record<string, any>
): Promise<{
  meta: ConnectedAppsScriptSheet;
  transactions: FinanceTransaction[];
}> {
  const trimmedUrl = scriptUrl.trim();
  const res = await fetch('/api/apps-script', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scriptUrl: trimmedUrl,
      payload,
    }),
  });

  const data: AppsScriptResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      data?.error || 'Gagal berkomunikasi dengan Google Apps Script.'
    );
  }

  const rawTransactions = Array.isArray(data.transactions)
    ? data.transactions
    : [];

  const normalized: FinanceTransaction[] = rawTransactions
    .map((tx: any) => ({
      id: String(tx.id || ''),
      date: String(tx.date || new Date().toISOString().slice(0, 10)),
      time: String(tx.time || '12:00'),
      type:
        tx.type === 'INCOME' || tx.type === 'PEMASUKAN'
          ? TransactionType.INCOME
          : TransactionType.EXPENSE,
      category: String(tx.category || 'Lainnya'),
      merchantOrDescription: String(tx.merchantOrDescription || 'Transaksi'),
      paymentMethod: String(tx.paymentMethod || 'Lainnya'),
      amount: Math.round(Math.abs(Number(tx.amount) || 0)),
      source:
        tx.source === 'BILL_PHOTO' || String(tx.source).includes('FOTO')
          ? EntrySource.BILL_PHOTO
          : EntrySource.MANUAL,
      itemsSummary: String(tx.itemsSummary || '-'),
      notes: String(tx.notes || '-'),
      sheetRowIndex: Number(tx.sheetRowIndex) || undefined,
      syncedToSheets: true,
    }))
    .sort((a, b) => {
      const dtA = `${a.date}T${a.time || '00:00'}`;
      const dtB = `${b.date}T${b.time || '00:00'}`;
      return dtB.localeCompare(dtA);
    });

  const meta: ConnectedAppsScriptSheet = {
    scriptUrl: trimmedUrl,
    spreadsheetTitle: data.spreadsheetTitle || 'Google Sheets Keuangan Pribadi',
    spreadsheetUrl: data.spreadsheetUrl || trimmedUrl,
    sheetName: data.sheetName || payload.sheetName || 'Catatan_Keuangan',
    lastSyncedAt: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  return { meta, transactions: normalized };
}

export async function connectAndFetchViaAppsScript(
  scriptUrl: string,
  sheetName?: string
) {
  return callAppsScriptProxy(scriptUrl, {
    action: 'setup',
    sheetName: sheetName || 'Catatan_Keuangan',
  });
}

export async function appendTransactionsViaAppsScript(
  scriptUrl: string,
  sheetName: string,
  transactions: FinanceTransaction[]
) {
  return callAppsScriptProxy(scriptUrl, {
    action: 'append',
    sheetName,
    transactions,
  });
}

export async function updateTransactionViaAppsScript(
  scriptUrl: string,
  sheetName: string,
  transaction: FinanceTransaction
) {
  return callAppsScriptProxy(scriptUrl, {
    action: 'update',
    sheetName,
    transaction,
  });
}

export async function deleteTransactionViaAppsScript(
  scriptUrl: string,
  sheetName: string,
  transaction: FinanceTransaction
) {
  return callAppsScriptProxy(scriptUrl, {
    action: 'delete',
    sheetName,
    id: transaction.id,
    rowIndex: transaction.sheetRowIndex,
  });
}

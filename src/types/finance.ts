export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum EntrySource {
  BILL_PHOTO = 'BILL_PHOTO',
  MANUAL = 'MANUAL',
}

export interface BillLineItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface FinanceTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: TransactionType;
  category: string;
  merchantOrDescription: string;
  paymentMethod: string;
  amount: number; // IDR integer
  source: EntrySource;
  itemsSummary: string; // serialized items or '-'
  notes: string;
  sheetRowIndex?: number; // 1-based row index in Google Sheets (row >= 2)
  syncedToSheets?: boolean;
}

export interface ScannedBillResult {
  merchantName: string;
  transactionDate: string;
  transactionTime: string;
  type: 'EXPENSE' | 'INCOME';
  category: string;
  totalAmount: number;
  taxOrServiceAmount?: number;
  discountAmount?: number;
  paymentMethod: string;
  items: BillLineItem[];
  notes?: string;
  confidence: string;
}

export interface ConnectedAppsScriptSheet {
  scriptUrl: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  sheetName: string;
  lastSyncedAt: string;
}

export const EXPENSE_CATEGORIES = [
  'Makanan & Minuman',
  'Belanja Harian',
  'Transportasi',
  'Tagihan & Utilitas',
  'Kesehatan',
  'Hiburan & Gaya Hidup',
  'Pendidikan',
  'Keluarga & Rumah',
  'Lainnya',
] as const;

export const INCOME_CATEGORIES = [
  'Gaji & Upah',
  'Bonus & Komisi',
  'Hasil Usaha',
  'Investasi',
  'Transfer Masuk',
  'Lainnya',
] as const;

export const PAYMENT_METHODS = [
  'QRIS',
  'Transfer Bank',
  'Tunai',
  'E-Wallet',
  'Kartu Debit/Kredit',
  'Lainnya',
] as const;

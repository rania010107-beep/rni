/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Camera,
  PenLine,
  FileSpreadsheet,
  Search,
  RefreshCw,
  ExternalLink,
  Download,
  Pencil,
  Trash2,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import {
  ConnectedAppsScriptSheet,
  EntrySource,
  FinanceTransaction,
  TransactionType,
} from './types/finance';
import {
  appendTransactionsViaAppsScript,
  connectAndFetchViaAppsScript,
  deleteTransactionViaAppsScript,
  PERMANENT_APPS_SCRIPT_URL,
  PERMANENT_SHEET_NAME,
  updateTransactionViaAppsScript,
} from './services/appsScriptService';
import { BillScannerPanel } from './components/BillScannerPanel';
import { ManualEntryPanel } from './components/ManualEntryPanel';
import { SheetsConfigPanel } from './components/SheetsConfigPanel';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { EditTransactionModal } from './components/EditTransactionModal';

type ActiveTab = 'ledger' | 'scan-bill' | 'manual-input' | 'sheets-config';

const STORAGE_KEY_APPS_SCRIPT_META = 'sakusheet_apps_script_meta_v4';
const STORAGE_KEY_LOCAL_TX = 'sakusheet_local_transactions_v4';

const DEFAULT_PERMANENT_SHEET: ConnectedAppsScriptSheet = {
  scriptUrl: PERMANENT_APPS_SCRIPT_URL,
  spreadsheetTitle: 'Google Sheets Keuangan Pribadi',
  spreadsheetUrl: '',
  sheetName: PERMANENT_SHEET_NAME,
  lastSyncedAt: 'Siap Sinkron',
};

const INITIAL_LOCAL_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: 'TRX-890142',
    date: new Date().toISOString().slice(0, 10),
    time: '08:30',
    type: TransactionType.INCOME,
    category: 'Gaji & Upah',
    merchantOrDescription: 'Gaji Bulanan & Tunjangan Kerja',
    paymentMethod: 'Transfer Bank',
    amount: 12500000,
    source: EntrySource.MANUAL,
    itemsSummary: '-',
    notes: 'Pemasukan utama bulan berjalan',
    syncedToSheets: false,
  },
  {
    id: 'BILL-890215',
    date: new Date().toISOString().slice(0, 10),
    time: '12:45',
    type: TransactionType.EXPENSE,
    category: 'Makanan & Minuman',
    merchantOrDescription: 'Kopi Senja Nusantara',
    paymentMethod: 'QRIS',
    amount: 93500,
    source: EntrySource.BILL_PHOTO,
    itemsSummary:
      'Es Kopi Susu Aren Large (2x Rp28.000); Almond Croissant Butter (1x Rp29.000)',
    notes: 'Pajak PB1 10%: Rp8.500',
    syncedToSheets: false,
  },
  {
    id: 'BILL-890309',
    date: new Date().toISOString().slice(0, 10),
    time: '18:20',
    type: TransactionType.EXPENSE,
    category: 'Belanja Harian',
    merchantOrDescription: 'IndoSegar Mart Cab. Kemang',
    paymentMethod: 'Kartu Debit/Kredit',
    amount: 164500,
    source: EntrySource.BILL_PHOTO,
    itemsSummary:
      'Beras Premium 5kg (1x Rp74.500); Minyak Goreng 2L (1x Rp36.000); Telur Ayam (1x Rp32.000); Sabun Cuci (2x Rp14.500)',
    notes: 'Diskon Promo: Rp7.000',
    syncedToSheets: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');

  // Google Apps Script Permanent Connection State
  const [connectedSheet, setConnectedSheet] =
    useState<ConnectedAppsScriptSheet>(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_APPS_SCRIPT_META);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...DEFAULT_PERMANENT_SHEET,
            ...parsed,
            scriptUrl: PERMANENT_APPS_SCRIPT_URL,
          };
        }
      } catch {
        // ignore
      }
      return DEFAULT_PERMANENT_SHEET;
    });
  const [isSheetBusy, setIsSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Transactions State
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOCAL_TX);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_LOCAL_TRANSACTIONS;
  });

  // Filters for Ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>(
    'ALL'
  );
  const [sourceFilter, setSourceFilter] = useState<
    'ALL' | 'BILL_PHOTO' | 'MANUAL'
  >('ALL');

  // Edit & Confirmation Modal States
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details: { label: string; value: string }[];
    confirmLabel: string;
    variant: 'danger' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Persist local transactions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOCAL_TX, JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions]);

  // Persist connected Apps Script metadata
  useEffect(() => {
    try {
      if (connectedSheet) {
        localStorage.setItem(
          STORAGE_KEY_APPS_SCRIPT_META,
          JSON.stringify(connectedSheet)
        );
      } else {
        localStorage.removeItem(STORAGE_KEY_APPS_SCRIPT_META);
      }
    } catch {
      // ignore
    }
  }, [connectedSheet]);

  const loadFromAppsScript = useCallback(
    async (scriptUrl: string, sheetName: string) => {
      setIsSheetBusy(true);
      setSheetError(null);
      try {
        const { meta, transactions: sheetTxs } =
          await connectAndFetchViaAppsScript(scriptUrl, sheetName);
        setConnectedSheet(meta);
        setTransactions(sheetTxs);
      } catch (err: any) {
        setSheetError(
          err?.message ||
            'Gagal memuat data dari Google Apps Script. Periksa URL Web App Anda.'
        );
      } finally {
        setIsSheetBusy(false);
      }
    },
    []
  );

  // Auto-refresh on mount if connectedSheet is already configured
  useEffect(() => {
    if (connectedSheet?.scriptUrl) {
      void loadFromAppsScript(
        connectedSheet.scriptUrl,
        connectedSheet.sheetName
      );
    }
  }, []);

  // Connect / test Apps Script URL
  const handleConnectAppsScript = async (
    scriptUrl: string,
    sheetName: string
  ) => {
    setIsSheetBusy(true);
    setSheetError(null);
    try {
      const unsyncedLocal = transactions.filter((t) => !t.syncedToSheets);
      const { meta, transactions: existingSheetTxs } =
        await connectAndFetchViaAppsScript(scriptUrl, sheetName);

      // If the newly connected sheet is completely empty and user has local transactions, upload them automatically
      if (existingSheetTxs.length === 0 && unsyncedLocal.length > 0) {
        const appended = await appendTransactionsViaAppsScript(
          scriptUrl,
          meta.sheetName,
          unsyncedLocal
        );
        setConnectedSheet(appended.meta);
        setTransactions(appended.transactions);
        showToast(
          `Terhubung ke "${appended.meta.spreadsheetTitle}" & menyinkronkan ${unsyncedLocal.length} transaksi awal!`
        );
      } else {
        setConnectedSheet(meta);
        setTransactions(existingSheetTxs);
        showToast(
          `Berhasil terhubung ke Google Sheets "${meta.spreadsheetTitle}" via Apps Script!`
        );
      }
    } catch (err: any) {
      setSheetError(
        err?.message ||
          'Gagal menghubungkan Apps Script. Pastikan URL berakhiran /exec dan akses disetel ke "Siapa saja (Anyone)".'
      );
    } finally {
      setIsSheetBusy(false);
    }
  };

  // Record transaction (either automatically from Bill Photo or from Manual Input)
  const handleRecordTransaction = async (
    newTx: FinanceTransaction,
    stayOnCurrentTab = false
  ) => {
    setIsSheetBusy(true);
    setSheetError(null);
    try {
      if (connectedSheet?.scriptUrl) {
        const { meta, transactions: updatedList } =
          await appendTransactionsViaAppsScript(
            connectedSheet.scriptUrl,
            connectedSheet.sheetName,
            [newTx]
          );
        setConnectedSheet(meta);
        setTransactions(updatedList);
        showToast(
          `Pengeluaran "${newTx.merchantOrDescription}" (Rp ${newTx.amount.toLocaleString(
            'id-ID'
          )}) otomatis tercatat ke Google Sheets!`
        );
      } else {
        const localTx: FinanceTransaction = {
          ...newTx,
          syncedToSheets: false,
        };
        setTransactions((prev) => [localTx, ...prev]);
        showToast(
          `Transaksi "${newTx.merchantOrDescription}" (Rp ${newTx.amount.toLocaleString(
            'id-ID'
          )}) otomatis tercatat!`
        );
      }
      if (!stayOnCurrentTab) {
        setActiveTab('ledger');
      }
    } catch (err: any) {
      // Fallback: still keep in local state if offline or script error
      const fallbackTx: FinanceTransaction = {
        ...newTx,
        syncedToSheets: false,
      };
      setTransactions((prev) => [fallbackTx, ...prev]);
      setSheetError(
        err?.message ||
          'Tersimpan di aplikasi, namun gagal mengirim ke Apps Script. Periksa URL Web App Anda.'
      );
    } finally {
      setIsSheetBusy(false);
    }
  };

  // Update a transaction that was just auto-recorded in the Bill Scanner
  const handleUpdateAutoRecordedBill = async (updatedTx: FinanceTransaction) => {
    setIsSheetBusy(true);
    setSheetError(null);
    try {
      if (connectedSheet?.scriptUrl) {
        const { meta, transactions: updatedList } =
          await updateTransactionViaAppsScript(
            connectedSheet.scriptUrl,
            connectedSheet.sheetName,
            updatedTx
          );
        setConnectedSheet(meta);
        setTransactions(updatedList);
        showToast(
          `Koreksi transaksi "${updatedTx.merchantOrDescription}" berhasil diperbarui di Google Sheets!`
        );
      } else {
        setTransactions((prev) =>
          prev.map((item) => (item.id === updatedTx.id ? updatedTx : item))
        );
        showToast(
          `Koreksi transaksi "${updatedTx.merchantOrDescription}" berhasil disimpan.`
        );
      }
    } catch (err: any) {
      setSheetError(
        err?.message || 'Gagal memperbarui koreksi transaksi di Google Sheets.'
      );
    } finally {
      setIsSheetBusy(false);
    }
  };

  // Sync unsynced local transactions to Apps Script
  const handleSyncLocalToSheet = async () => {
    if (!connectedSheet?.scriptUrl) return;
    const unsynced = transactions.filter((t) => !t.syncedToSheets);
    if (unsynced.length === 0) return;

    setIsSheetBusy(true);
    setSheetError(null);
    try {
      const { meta, transactions: updatedList } =
        await appendTransactionsViaAppsScript(
          connectedSheet.scriptUrl,
          connectedSheet.sheetName,
          unsynced
        );
      setConnectedSheet(meta);
      setTransactions(updatedList);
      showToast(
        `${unsynced.length} transaksi lokal berhasil dikirim ke Google Sheets.`
      );
    } catch (err: any) {
      setSheetError(
        err?.message || 'Gagal mengirim transaksi lokal ke Google Sheets.'
      );
    } finally {
      setIsSheetBusy(false);
    }
  };

  // Update existing row from Ledger Edit Modal
  const handleRequestUpdateTransaction = (updatedTx: FinanceTransaction) => {
    setEditingTx(null);

    if (connectedSheet?.scriptUrl && updatedTx.syncedToSheets) {
      setConfirmModal({
        isOpen: true,
        title: `Perbarui Transaksi (${updatedTx.id}) di Google Sheets?`,
        description: `Perubahan ini akan langsung memperbarui baris transaksi pada tab "${connectedSheet.sheetName}" melalui Google Apps Script.`,
        details: [
          { label: 'ID Transaksi', value: updatedTx.id },
          { label: 'Deskripsi Baru', value: updatedTx.merchantOrDescription },
          {
            label: 'Nominal Baru',
            value: `Rp ${updatedTx.amount.toLocaleString('id-ID')}`,
          },
        ],
        confirmLabel: 'Simpan Perubahan',
        variant: 'primary',
        onConfirm: async () => {
          setIsSheetBusy(true);
          try {
            const { meta, transactions: updatedList } =
              await updateTransactionViaAppsScript(
                connectedSheet.scriptUrl,
                connectedSheet.sheetName,
                updatedTx
              );
            setConnectedSheet(meta);
            setTransactions(updatedList);
            showToast('Data transaksi berhasil diperbarui di Google Sheets.');
          } catch (err: any) {
            setSheetError(
              err?.message || 'Gagal memperbarui baris di Google Sheets.'
            );
          } finally {
            setIsSheetBusy(false);
            setConfirmModal(null);
          }
        },
      });
    } else {
      setTransactions((prev) =>
        prev.map((item) => (item.id === updatedTx.id ? updatedTx : item))
      );
      showToast(
        `Transaksi "${updatedTx.merchantOrDescription}" berhasil diperbarui.`
      );
    }
  };

  // Delete transaction row
  const handleRequestDeleteTransaction = (tx: FinanceTransaction) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Transaksi Ini?',
      description:
        connectedSheet?.scriptUrl && tx.syncedToSheets
          ? `Tindakan ini akan menghapus transaksi "${tx.merchantOrDescription}" dari lembar kerja "${connectedSheet.sheetName}" di Google Sheets Anda.`
          : 'Transaksi ini akan dihapus dari daftar catatan buku kas Anda.',
      details: [
        { label: 'ID Transaksi', value: tx.id },
        { label: 'Deskripsi / Toko', value: tx.merchantOrDescription },
        {
          label: 'Nominal',
          value: `Rp ${tx.amount.toLocaleString('id-ID')}`,
        },
      ],
      confirmLabel: 'Ya, Hapus Transaksi',
      variant: 'danger',
      onConfirm: async () => {
        setIsSheetBusy(true);
        try {
          if (connectedSheet?.scriptUrl && tx.syncedToSheets) {
            const { meta, transactions: updatedList } =
              await deleteTransactionViaAppsScript(
                connectedSheet.scriptUrl,
                connectedSheet.sheetName,
                tx
              );
            setConnectedSheet(meta);
            setTransactions(updatedList);
            showToast('Transaksi telah dihapus dari Google Sheets.');
          } else {
            setTransactions((prev) => prev.filter((item) => item.id !== tx.id));
            showToast('Transaksi telah dihapus.');
          }
        } catch (err: any) {
          setSheetError(
            err?.message || 'Gagal menghapus baris dari Google Sheets.'
          );
        } finally {
          setIsSheetBusy(false);
          setConfirmModal(null);
        }
      },
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
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
      'Catatan',
    ];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.date,
      tx.time,
      tx.type === TransactionType.INCOME ? 'PEMASUKAN' : 'PENGELUARAN',
      tx.category,
      `"${tx.merchantOrDescription.replace(/"/g, '""')}"`,
      tx.paymentMethod,
      tx.amount,
      tx.source === EntrySource.BILL_PHOTO ? 'FOTO BILL' : 'INPUT MANUAL',
      `"${(tx.itemsSummary || '-').replace(/"/g, '""')}"`,
      `"${(tx.notes || '-').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sakusheet-keuangan-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Computed Financial Metrics
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let billPhotoCount = 0;
    let manualCount = 0;

    const expenseByCategory: Record<string, number> = {};

    for (const tx of transactions) {
      if (tx.type === TransactionType.INCOME) {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
        expenseByCategory[tx.category] =
          (expenseByCategory[tx.category] || 0) + tx.amount;
      }
      if (tx.source === EntrySource.BILL_PHOTO) {
        billPhotoCount++;
      } else {
        manualCount++;
      }
    }

    const netBalance = totalIncome - totalExpense;
    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percentage:
          totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
      }));

    return {
      totalIncome,
      totalExpense,
      netBalance,
      billPhotoCount,
      manualCount,
      topCategories,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (sourceFilter !== 'ALL' && tx.source !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMerchant = tx.merchantOrDescription
          .toLowerCase()
          .includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchNotes = tx.notes.toLowerCase().includes(q);
        const matchItems = tx.itemsSummary.toLowerCase().includes(q);
        const matchId = tx.id.toLowerCase().includes(q);
        return matchMerchant || matchCat || matchNotes || matchItems || matchId;
      }
      return true;
    });
  }, [transactions, typeFilter, sourceFilter, searchQuery]);

  const unsyncedCount = useMemo(
    () => transactions.filter((t) => !t.syncedToSheets).length,
    [transactions]
  );

  const isSheetConnected = Boolean(connectedSheet?.scriptUrl);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: Strictly 3 Zones */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#ledger"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('ledger');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          SakuSheet
        </a>

        {/* Zone 2: 4 Clean Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Buku Kas & Ringkasan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan-bill')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'scan-bill'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Foto Bill (Otomatis Catat)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual-input')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'manual-input'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Input Manual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheets-config')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'sheets-config'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Integrasi Apps Script
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('sheets-config')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate max-w-[170px]">
              {connectedSheet
                ? connectedSheet.spreadsheetTitle
                : 'Kode & Setup Apps Script'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scan-bill')}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            <span>Foto Bill</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Buku Kas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scan-bill')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
            activeTab === 'scan-bill'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Foto Bill (Otomatis)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual-input')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
            activeTab === 'manual-input'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Input Manual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sheets-config')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
            activeTab === 'sheets-config'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Kode Apps Script
        </button>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-900 text-white text-xs font-medium flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-200 hover:text-white text-xs"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Apps Script Status Banner */}
        <section className="border border-slate-200 bg-white rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">
                Status Google Sheets (Apps Script)
              </span>
              <span aria-hidden="true">·</span>
              {connectedSheet ? (
                <span className="text-emerald-700 font-medium">
                  Terhubung ke "{connectedSheet.spreadsheetTitle}" (Tab:{' '}
                  {connectedSheet.sheetName})
                </span>
              ) : (
                <span>
                  Belum dihubungkan — Ambil kode Google Apps Script di menu "Integrasi Apps Script"
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Saat Anda memasukkan foto bill/struk, pengeluaran akan langsung diekstrak dan tercatat otomatis tanpa perlu mengetik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {connectedSheet ? (
              <>
                <button
                  type="button"
                  disabled={isSheetBusy}
                  onClick={() =>
                    loadFromAppsScript(
                      connectedSheet.scriptUrl,
                      connectedSheet.sheetName
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isSheetBusy ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Sinkronkan Sheet</span>
                </button>
                {connectedSheet.spreadsheetUrl && (
                  <a
                    href={connectedSheet.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Buka Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('sheets-config')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                <Code2 className="w-4 h-4" />
                <span>Lihat Kode & Hubungkan Apps Script →</span>
              </button>
            )}
          </div>
        </section>

        {/* Tab 1: Ledger & Financial Overview */}
        {activeTab === 'ledger' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: KPI Metrics Grid */}
              <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 text-balance">
                      Ringkasan Arus Kas Pribadi
                    </h1>
                    <p className="text-xs text-slate-500">
                      Rekapitulasi pemasukan dan pengeluaran real-time
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {transactions.length} Transaksi
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-5 border-b border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 block">
                      Total Pemasukan
                    </span>
                    <p className="mt-1.5 text-xl font-mono font-bold text-emerald-700 tabular-nums">
                      +Rp {summary.totalIncome.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">
                      Total Pengeluaran
                    </span>
                    <p className="mt-1.5 text-xl font-mono font-bold text-red-600 tabular-nums">
                      -Rp {summary.totalExpense.toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">
                      Saldo Kas Bersih
                    </span>
                    <p
                      className={`mt-1.5 text-xl font-mono font-bold tabular-nums ${
                        summary.netBalance >= 0
                          ? 'text-slate-900'
                          : 'text-red-600'
                      }`}
                    >
                      {summary.netBalance < 0 ? '-' : ''}Rp{' '}
                      {Math.abs(summary.netBalance).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div>
                    <span>Otomatis dari Foto Bill: </span>
                    <strong className="font-mono text-slate-900">
                      {summary.billPhotoCount}
                    </strong>
                    <span className="mx-2" aria-hidden="true">
                      ·
                    </span>
                    <span>Input Manual: </span>
                    <strong className="font-mono text-slate-900">
                      {summary.manualCount}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV</span>
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Two Primary Workflows */}
              <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Catat Transaksi Baru
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Pilih metode pencatatan sesuai kondisi transaksi Anda:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('scan-bill')}
                    className="group text-left p-4 rounded-xl border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 transition-colors flex flex-col justify-between min-h-[124px]"
                  >
                    <div className="flex items-center justify-between">
                      <Camera className="w-5 h-5 text-emerald-400" />
                      <span className="text-[11px] font-mono text-emerald-300">
                        Auto-Record
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-semibold">
                        Ada Bill? Tinggal Foto
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-300 leading-snug">
                        Masukkan foto struk, pengeluaran langsung tercatat otomatis ke Sheet.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('manual-input')}
                    className="group text-left p-4 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors flex flex-col justify-between min-h-[124px]"
                  >
                    <div className="flex items-center justify-between">
                      <PenLine className="w-5 h-5 text-slate-700" />
                      <span className="text-[11px] font-mono text-slate-500">
                        Tanpa Struk
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-semibold">
                        Tanpa Bill? Input Sendiri
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                        Ketik nominal pemasukan atau pengeluaran harian secara manual.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Breakdown Bar */}
            {summary.topCategories.length > 0 && (
              <div className="border border-slate-200 bg-white rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Distribusi Pengeluaran per Kategori
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    Total Pengeluaran: Rp{' '}
                    {summary.totalExpense.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {summary.topCategories.map((cat) => (
                    <div
                      key={cat.category}
                      className="space-y-1.5 pt-2 sm:pt-0 sm:border-r last:border-r-0 border-slate-100 sm:pr-4"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 truncate">
                          {cat.category}
                        </span>
                        <span className="font-mono text-slate-500">
                          {cat.percentage}%
                        </span>
                      </div>
                      <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                        Rp {cat.amount.toLocaleString('id-ID')}
                      </p>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${Math.max(4, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High-Density Real-Time Ledger Table */}
            <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Buku Kas Transaksi (Real-Time Ledger)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menampilkan {filteredTransactions.length} dari{' '}
                    {transactions.length} catatan transaksi
                    {connectedSheet
                      ? ` · Terhubung ke tab "${connectedSheet.sheetName}"`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 sm:flex-initial sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari toko, kategori, item..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTypeFilter('ALL')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        typeFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter('EXPENSE')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        typeFilter === 'EXPENSE'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pengeluaran
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter('INCOME')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        typeFilter === 'INCOME'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pemasukan
                    </button>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSourceFilter('ALL')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        sourceFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Sumber
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('BILL_PHOTO')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        sourceFilter === 'BILL_PHOTO'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Foto Bill
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('MANUAL')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        sourceFilter === 'MANUAL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
              </div>

              {isSheetBusy ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-10 bg-slate-100 animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-16 px-4 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Belum Ada Transaksi yang Sesuai
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Mulai catat keuangan Anda dengan memfoto struk/bill belanja (otomatis tercatat) atau menginput transaksi secara manual.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('scan-bill')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Foto Bill Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual-input')}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Input Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">Tanggal & Waktu</th>
                        <th className="py-3 px-4">
                          Deskripsi / Merchant & Rincian Bill
                        </th>
                        <th className="py-3 px-4">Kategori & Metode</th>
                        <th className="py-3 px-4">Sumber Catatan</th>
                        <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                        <th className="py-3 px-4 text-right w-24">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id + (tx.sheetRowIndex || '')}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap align-top">
                            <div className="font-medium text-slate-900">
                              {tx.date}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tx.time} · {tx.id}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top max-w-md">
                            <div className="font-semibold text-slate-900">
                              {tx.merchantOrDescription}
                            </div>
                            {tx.itemsSummary && tx.itemsSummary !== '-' && (
                              <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                                Item Bill: {tx.itemsSummary}
                              </p>
                            )}
                            {tx.notes && tx.notes !== '-' && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Catatan: {tx.notes}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-4 align-top whitespace-nowrap text-slate-600">
                            <div className="font-medium text-slate-800">
                              {tx.category}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tx.paymentMethod}
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                              <span>
                                {tx.type === TransactionType.INCOME
                                  ? 'Pemasukan'
                                  : 'Pengeluaran'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top whitespace-nowrap text-slate-600">
                            <div className="text-slate-800">
                              {tx.source === EntrySource.BILL_PHOTO
                                ? 'Foto Bill (Otomatis)'
                                : 'Input Manual'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {tx.syncedToSheets
                                ? `Tersinkron Sheet${
                                    tx.sheetRowIndex
                                      ? ` #${tx.sheetRowIndex}`
                                      : ''
                                  }`
                                : 'Tersimpan Lokal'}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                            <span
                              className={
                                tx.type === TransactionType.INCOME
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }
                            >
                              {tx.type === TransactionType.INCOME ? '+' : '-'}Rp{' '}
                              {tx.amount.toLocaleString('id-ID')}
                            </span>
                          </td>

                          <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingTx(tx)}
                                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                                title="Edit Transaksi"
                                aria-label="Edit Transaksi"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRequestDeleteTransaction(tx)
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                title="Hapus Transaksi"
                                aria-label="Hapus Transaksi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Bill Photo Scanner (Automatically records expense upon photo upload!) */}
        {activeTab === 'scan-bill' && (
          <BillScannerPanel
            onAutoRecordTransaction={(tx) => handleRecordTransaction(tx, true)}
            onUpdateRecordedTransaction={handleUpdateAutoRecordedBill}
            onNavigateToLedger={() => setActiveTab('ledger')}
            isSaving={isSheetBusy}
            isSheetConnected={isSheetConnected}
          />
        )}

        {/* Tab 3: Manual Input */}
        {activeTab === 'manual-input' && (
          <ManualEntryPanel
            onSaveTransaction={(tx) => handleRecordTransaction(tx, false)}
            isSaving={isSheetBusy}
            isSheetConnected={isSheetConnected}
            onSwitchToScanner={() => setActiveTab('scan-bill')}
          />
        )}

        {/* Tab 4: Google Apps Script Setup & Code */}
        {activeTab === 'sheets-config' && (
          <SheetsConfigPanel
            connectedSheet={connectedSheet}
            isBusy={isSheetBusy}
            sheetError={sheetError}
            unsyncedCount={unsyncedCount}
            onRefreshFromSheet={async () => {
              await loadFromAppsScript(
                PERMANENT_APPS_SCRIPT_URL,
                connectedSheet.sheetName
              );
              showToast('Data Google Sheets berhasil dimuat ulang via Apps Script.');
            }}
            onSyncLocalToSheet={handleSyncLocalToSheet}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-6 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            SakuSheet — Manajemen Keuangan Pribadi Terintegrasi Google Sheets (Apps Script)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('scan-bill')}
              className="hover:text-slate-900 transition-colors"
            >
              Foto Bill (Otomatis Catat)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('manual-input')}
              className="hover:text-slate-900 transition-colors"
            >
              Input Manual
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('sheets-config')}
              className="hover:text-slate-900 transition-colors"
            >
              Kode Google Apps Script
            </button>
          </div>
        </div>
      </footer>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
        onRequestSave={handleRequestUpdateTransaction}
      />

      {/* Confirmation Dialog for Sheet Updates/Deletions */}
      {confirmModal && (
        <ConfirmActionModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          description={confirmModal.description}
          details={confirmModal.details}
          confirmLabel={confirmModal.confirmLabel}
          variant={confirmModal.variant}
          isLoading={isSheetBusy}
          onConfirm={() => void confirmModal.onConfirm()}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  EntrySource,
  EXPENSE_CATEGORIES,
  FinanceTransaction,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TransactionType,
} from '../types/finance';

interface ManualEntryPanelProps {
  onSaveTransaction: (tx: FinanceTransaction) => Promise<void>;
  isSaving: boolean;
  isSheetConnected: boolean;
  onSwitchToScanner: () => void;
}

const QUICK_AMOUNTS = [20000, 50000, 100000, 250000, 500000, 1000000];

export const ManualEntryPanel: React.FC<ManualEntryPanelProps> = ({
  onSaveTransaction,
  isSaving,
  isSheetConnected,
  onSwitchToScanner,
}) => {
  const [txType, setTxType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [merchantOrDesc, setMerchantOrDesc] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );
  const [notes, setNotes] = useState<string>('');

  const activeCategories =
    txType === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const numericAmount = Math.max(0, parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0);

  const handleQuickAdd = (delta: number) => {
    setAmount(String(numericAmount + delta));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantOrDesc.trim() || numericAmount <= 0) return;

    const newTx: FinanceTransaction = {
      id: `MAN-${Date.now().toString().slice(-6)}`,
      date,
      time,
      type: txType,
      category,
      merchantOrDescription: merchantOrDesc.trim(),
      paymentMethod,
      amount: numericAmount,
      source: EntrySource.MANUAL,
      itemsSummary: '-',
      notes: notes.trim() || '-',
    };

    await onSaveTransaction(newTx);

    setMerchantOrDesc('');
    setAmount('');
    setNotes('');
  };

  return (
    <div className="max-w-3xl mx-auto border border-slate-200 bg-white rounded-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Input Transaksi Manual (Tanpa Bill)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Catat pemasukan atau pengeluaran yang tidak memiliki struk fisik langsung ke lembar Google Sheets Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={onSwitchToScanner}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          Ada struk? Pindai Foto Bill →
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Segmented Transaction Type */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2">
            Jenis Transaksi
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.EXPENSE);
                setCategory(EXPENSE_CATEGORIES[0]);
              }}
              className={`py-2.5 px-4 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                txType === TransactionType.EXPENSE
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengeluaran (Uang Keluar)
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.INCOME);
                setCategory(INCOME_CATEGORIES[0]);
              }}
              className={`py-2.5 px-4 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                txType === TransactionType.INCOME
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pemasukan (Uang Masuk)
            </button>
          </div>
        </div>

        {/* Amount Input with Quick Presets */}
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-slate-700">
            Nominal Transaksi (Rupiah)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-semibold text-slate-500">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={numericAmount > 0 ? numericAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, '');
                setAmount(digits);
              }}
              placeholder="0"
              className="w-full pl-11 pr-4 py-3 text-lg font-mono font-semibold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {QUICK_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleQuickAdd(preset)}
                className="px-2.5 py-1.5 text-xs font-mono font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                +Rp {preset.toLocaleString('id-ID')}
              </button>
            ))}
            {numericAmount > 0 && (
              <button
                type="button"
                onClick={() => setAmount('')}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap"
              >
                Reset Nominal
              </button>
            )}
          </div>
        </div>

        {/* Description & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {txType === TransactionType.INCOME
                ? 'Sumber Pemasukan / Deskripsi'
                : 'Keperluan / Nama Pedagang / Deskripsi'}
            </label>
            <input
              type="text"
              required
              value={merchantOrDesc}
              onChange={(e) => setMerchantOrDesc(e.target.value)}
              placeholder={
                txType === TransactionType.INCOME
                  ? 'Contoh: Gaji Bulanan Oktober / Proyek Desain'
                  : 'Contoh: Makan Siang Warteg / Parkir / Bensin'
              }
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
            >
              {activeCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date, Time, Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Waktu
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Metode Pembayaran
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan keterangan singkat bila perlu..."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
          />
        </div>

        {/* Submit Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Status pencatatan:{' '}
            <span className="font-medium text-slate-800">
              {isSheetConnected
                ? 'Tersinkronisasi Real-Time ke Google Sheets'
                : 'Mode Lokal (Hubungkan Google Sheets untuk sinkronisasi otomatis)'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving || !merchantOrDesc.trim() || numericAmount <= 0}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:bg-slate-300 transition-colors whitespace-nowrap"
          >
            {isSaving
              ? 'Menyimpan...'
              : isSheetConnected
              ? 'Catat ke Google Sheets Sekarang'
              : 'Simpan Transaksi Manual'}
          </button>
        </div>
      </form>
    </div>
  );
};

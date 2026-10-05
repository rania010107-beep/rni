import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  FinanceTransaction,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TransactionType,
} from '../types/finance';

interface EditTransactionModalProps {
  transaction: FinanceTransaction | null;
  onClose: () => void;
  onRequestSave: (updated: FinanceTransaction) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
  onRequestSave,
}) => {
  const [txType, setTxType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [merchantOrDescription, setMerchantOrDescription] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (transaction) {
      setTxType(transaction.type);
      setMerchantOrDescription(transaction.merchantOrDescription);
      setCategory(transaction.category);
      setPaymentMethod(transaction.paymentMethod);
      setAmount(transaction.amount);
      setDate(transaction.date);
      setTime(transaction.time);
      setNotes(transaction.notes);
    }
  }, [transaction]);

  if (!transaction) return null;

  const activeCategories =
    txType === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantOrDescription.trim() || amount <= 0) return;

    onRequestSave({
      ...transaction,
      type: txType,
      merchantOrDescription: merchantOrDescription.trim(),
      category,
      paymentMethod,
      amount: Math.round(amount),
      date,
      time,
      notes: notes.trim() || '-',
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Edit Transaksi ({transaction.id})
            </h3>
            <p className="text-xs text-slate-500">
              {transaction.sheetRowIndex
                ? `Terhubung ke Baris #${transaction.sheetRowIndex} di Google Sheets`
                : 'Transaksi tersimpan lokal'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.EXPENSE);
                setCategory(EXPENSE_CATEGORIES[0]);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                txType === TransactionType.EXPENSE
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.INCOME);
                setCategory(INCOME_CATEGORIES[0]);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                txType === TransactionType.INCOME
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Pemasukan
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Merchant / Deskripsi
            </label>
            <input
              type="text"
              required
              value={merchantOrDescription}
              onChange={(e) => setMerchantOrDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nominal (Rp)
              </label>
              <input
                type="number"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
              >
                {activeCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Waktu
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Metode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              Lanjut Konfirmasi Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

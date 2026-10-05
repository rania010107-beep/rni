import React, { useState } from 'react';
import {
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Copy,
  Check,
  Code2,
  ShieldCheck,
} from 'lucide-react';
import { ConnectedAppsScriptSheet } from '../types/finance';
import {
  APPS_SCRIPT_CODE_GS,
  PERMANENT_APPS_SCRIPT_URL,
} from '../services/appsScriptService';

interface SheetsConfigPanelProps {
  connectedSheet: ConnectedAppsScriptSheet;
  isBusy: boolean;
  sheetError: string | null;
  unsyncedCount: number;
  onRefreshFromSheet: () => Promise<void>;
  onSyncLocalToSheet: () => Promise<void>;
}

export const SheetsConfigPanel: React.FC<SheetsConfigPanelProps> = ({
  connectedSheet,
  isBusy,
  sheetError,
  unsyncedCount,
  onRefreshFromSheet,
  onSyncLocalToSheet,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE_GS);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = APPS_SCRIPT_CODE_GS;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(PERMANENT_APPS_SCRIPT_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Permanent Connection Card */}
      <div className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Penyimpanan Tetap Google Sheets (Apps Script Aktif)
                </h2>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Aplikasi ini telah dikunci secara permanen ke endpoint Google Apps Script Anda tanpa perlu memasukkan tautan secara manual.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {unsyncedCount > 0 && (
              <button
                type="button"
                disabled={isBusy}
                onClick={onSyncLocalToSheet}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Kirim {unsyncedCount} Transaksi Lokal ke Sheet</span>
              </button>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={onRefreshFromSheet}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`}
              />
              <span>{isBusy ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
            </button>

            {connectedSheet.spreadsheetUrl &&
              !connectedSheet.spreadsheetUrl.includes('script.google.com') && (
                <a
                  href={connectedSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Buka Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
          </div>
        </div>

        {sheetError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{sheetError}</span>
          </div>
        )}

        {/* Permanent Endpoint Details */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="md:col-span-8 space-y-1 min-w-0">
            <span className="text-[11px] font-medium text-slate-500 block">
              Endpoint Penyimpanan Tetap (Google Apps Script Web App)
            </span>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono font-medium text-slate-900 truncate">
                {PERMANENT_APPS_SCRIPT_URL}
              </p>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="text-xs text-slate-500 hover:text-slate-900 shrink-0 p-1 rounded hover:bg-slate-200/60"
                title="Salin URL"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="md:col-span-4 md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
            <span className="text-[11px] text-slate-500 block">
              Nama Sheet & Sinkronisasi Terakhir
            </span>
            <span className="text-xs font-mono font-semibold text-slate-900">
              {connectedSheet.spreadsheetTitle} · {connectedSheet.sheetName} (
              {connectedSheet.lastSyncedAt})
            </span>
          </div>
        </div>
      </div>

      {/* Ready-to-Use Apps Script Code */}
      <div className="border border-slate-200 bg-white rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kode Google Apps Script (`Code.gs`) untuk Sheet Anda
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Pastikan kode di bawah ini terpasang pada proyek Apps Script yang terhubung dengan URL tetap Anda, lalu pilih <strong>Deploy &gt; Kelola deployment &gt; Edit &gt; Versi baru</strong> jika Anda memperbarui kodenya.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Kode Berhasil Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Kode Apps Script</span>
              </>
            )}
          </button>
        </div>

        {/* Code Block */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span>Code.gs — Google Apps Script</span>
            <span>Otomatis membuat tab "Catatan_Keuangan" & Header Tabel</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[460px] leading-relaxed select-all">
            <code>{APPS_SCRIPT_CODE_GS}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  FileText,
  X,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import {
  BillLineItem,
  EntrySource,
  EXPENSE_CATEGORIES,
  FinanceTransaction,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  ScannedBillResult,
  TransactionType,
} from '../types/finance';
import {
  generateSampleReceiptDataUrl,
  SAMPLE_RECEIPT_PRESETS,
  SampleReceiptPreset,
} from '../utils/sampleReceiptGenerator';

interface BillScannerPanelProps {
  onAutoRecordTransaction: (tx: FinanceTransaction) => Promise<void>;
  onUpdateRecordedTransaction: (tx: FinanceTransaction) => Promise<void>;
  onNavigateToLedger: () => void;
  isSaving: boolean;
  isSheetConnected: boolean;
}

export const BillScannerPanel: React.FC<BillScannerPanelProps> = ({
  onAutoRecordTransaction,
  onUpdateRecordedTransaction,
  onNavigateToLedger,
  isSaving,
  isSheetConnected,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Auto-record toggle (Default: ON as requested by user)
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(true);
  const [autoRecordedTx, setAutoRecordedTx] =
    useState<FinanceTransaction | null>(null);
  const [isEditingRecorded, setIsEditingRecorded] = useState(false);

  // Extracted & editable fields
  const [hasExtractedData, setHasExtractedData] = useState(false);
  const [currentTxId, setCurrentTxId] = useState<string>('');
  const [merchantName, setMerchantName] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [transactionTime, setTransactionTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [txType, setTxType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<BillLineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [confidence, setConfidence] = useState<string>('Tinggi');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setCameraError(
        'Kamera tidak dapat diakses pada perangkat/browser ini. Silakan unggah foto bill dari galeri atau klik contoh struk di bawah.'
      );
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setImagePreview(dataUrl);
    setImageMimeType('image/jpeg');
    void runBillScan(dataUrl, 'image/jpeg');
  };

  const compressImageDataUrl = (rawDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width || 800;
        let height = img.height || 600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    setScanError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const rawStr = String(reader.result || '');
      const compressed = await compressImageDataUrl(rawStr);
      setImagePreview(compressed);
      setImageMimeType('image/jpeg');
      void runBillScan(compressed, 'image/jpeg');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectSampleReceipt = (preset: SampleReceiptPreset) => {
    stopCamera();
    setScanError(null);
    const dataUrl = generateSampleReceiptDataUrl(preset);
    setImagePreview(dataUrl);
    setImageMimeType('image/png');
    void runBillScan(dataUrl, 'image/png');
  };

  const buildTransactionObject = (params: {
    id: string;
    date: string;
    time: string;
    type: TransactionType;
    cat: string;
    merchant: string;
    method: string;
    amt: number;
    lineItems: BillLineItem[];
    noteStr: string;
    tax: number;
  }): FinanceTransaction => {
    const itemsSummary =
      params.lineItems.length > 0
        ? params.lineItems
            .map(
              (it) =>
                `${it.name} (${it.qty}x Rp${Number(it.price || 0).toLocaleString('id-ID')})`
            )
            .join('; ')
        : '-';

    return {
      id: params.id,
      date: params.date,
      time: params.time,
      type: params.type,
      category: params.cat,
      merchantOrDescription: params.merchant.trim() || 'Pengeluaran Bill',
      paymentMethod: params.method,
      amount: Math.round(params.amt),
      source: EntrySource.BILL_PHOTO,
      itemsSummary,
      notes:
        params.noteStr.trim() ||
        (params.tax > 0
          ? `Pajak/Layanan: Rp${params.tax.toLocaleString('id-ID')}`
          : '-'),
    };
  };

  const runBillScan = async (base64DataUrl: string, mime: string) => {
    setIsScanning(true);
    setScanError(null);
    setAutoRecordedTx(null);
    setIsEditingRecorded(false);

    try {
      const response = await fetch('/api/scan-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          mimeType: mime,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal membaca foto struk/bill.');
      }

      const result: ScannedBillResult = data.result;
      const newId = `BILL-${Date.now().toString().slice(-6)}`;
      const parsedMerchant = result.merchantName || 'Pengeluaran Struk Belanja';
      const parsedDate =
        result.transactionDate || new Date().toISOString().slice(0, 10);
      const parsedTime =
        result.transactionTime || new Date().toTimeString().slice(0, 5);
      // Default to EXPENSE when scanning a bill as requested
      const parsedType = TransactionType.EXPENSE;
      const parsedCategory =
        result.category &&
        EXPENSE_CATEGORIES.includes(result.category as any)
          ? result.category
          : EXPENSE_CATEGORIES[0];
      const parsedMethod = result.paymentMethod || 'QRIS';
      const parsedTotal = Math.round(Number(result.totalAmount) || 0);
      const parsedTax = Math.round(Number(result.taxOrServiceAmount) || 0);
      const parsedDiscount = Math.round(Number(result.discountAmount) || 0);
      const parsedItems = Array.isArray(result.items) ? result.items : [];
      const parsedNotes = result.notes || '';

      setCurrentTxId(newId);
      setMerchantName(parsedMerchant);
      setTransactionDate(parsedDate);
      setTransactionTime(parsedTime);
      setTxType(parsedType);
      setCategory(parsedCategory);
      setPaymentMethod(parsedMethod);
      setTotalAmount(parsedTotal);
      setTaxAmount(parsedTax);
      setDiscountAmount(parsedDiscount);
      setItems(parsedItems);
      setNotes(parsedNotes);
      setConfidence(result.confidence || 'Tinggi');
      setHasExtractedData(true);

      // AUTOMATICALLY RECORD EXPENSE UPON BILL PHOTO UPLOAD
      if (autoRecordEnabled && parsedTotal > 0) {
        const autoTx = buildTransactionObject({
          id: newId,
          date: parsedDate,
          time: parsedTime,
          type: parsedType,
          cat: parsedCategory,
          merchant: parsedMerchant,
          method: parsedMethod,
          amt: parsedTotal,
          lineItems: parsedItems,
          noteStr: parsedNotes,
          tax: parsedTax,
        });
        await onAutoRecordTransaction(autoTx);
        setAutoRecordedTx(autoTx);
      }
    } catch (err: any) {
      setScanError(
        err?.message ||
          'Gagal mengekstrak data dari gambar struk. Anda tetap dapat mengisi rincian secara manual di bawah.'
      );
      setCurrentTxId(`BILL-${Date.now().toString().slice(-6)}`);
      setHasExtractedData(true);
    } finally {
      setIsScanning(false);
    }
  };

  const recalculateTotalFromItems = (
    updatedItems: BillLineItem[],
    tax: number,
    discount: number
  ) => {
    if (updatedItems.length === 0) return;
    const sum = updatedItems.reduce(
      (acc, item) => acc + (Number(item.subtotal) || 0),
      0
    );
    setTotalAmount(Math.max(0, sum + tax - discount));
  };

  const handleItemChange = (
    index: number,
    field: keyof BillLineItem,
    value: string | number
  ) => {
    const next = [...items];
    const current = { ...next[index] };
    if (field === 'name') {
      current.name = String(value);
    } else if (field === 'qty') {
      current.qty = Math.max(1, Number(value) || 1);
      current.subtotal = current.qty * current.price;
    } else if (field === 'price') {
      current.price = Math.max(0, Number(value) || 0);
      current.subtotal = current.qty * current.price;
    } else if (field === 'subtotal') {
      current.subtotal = Math.max(0, Number(value) || 0);
    }
    next[index] = current;
    setItems(next);
    recalculateTotalFromItems(next, taxAmount, discountAmount);
  };

  const handleAddItem = () => {
    const next = [
      ...items,
      { name: 'Item Baru', qty: 1, price: 10000, subtotal: 10000 },
    ];
    setItems(next);
    recalculateTotalFromItems(next, taxAmount, discountAmount);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    recalculateTotalFromItems(next, taxAmount, discountAmount);
  };

  const handleSubmitOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim() || totalAmount <= 0) return;

    const txObj = buildTransactionObject({
      id: currentTxId || `BILL-${Date.now().toString().slice(-6)}`,
      date: transactionDate,
      time: transactionTime,
      type: txType,
      cat: category,
      merchant: merchantName,
      method: paymentMethod,
      amt: totalAmount,
      lineItems: items,
      noteStr: notes,
      tax: taxAmount,
    });

    if (autoRecordedTx) {
      await onUpdateRecordedTransaction(txObj);
      setAutoRecordedTx(txObj);
      setIsEditingRecorded(false);
    } else {
      await onAutoRecordTransaction(txObj);
      setAutoRecordedTx(txObj);
    }
  };

  const handleResetScanner = () => {
    setImagePreview(null);
    setHasExtractedData(false);
    setAutoRecordedTx(null);
    setIsEditingRecorded(false);
    setScanError(null);
    setMerchantName('');
    setTotalAmount(0);
    setTaxAmount(0);
    setDiscountAmount(0);
    setItems([]);
    setNotes('');
  };

  const activeCategories =
    txType === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Capture / Upload Bill Photo */}
      <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Masukkan Foto Bill / Struk
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Begitu foto bill dimasukkan, pengeluaran Anda akan langsung dibaca dan tercatat otomatis ke Buku Kas & Google Sheets.
            </p>
          </div>
          {imagePreview && (
            <button
              type="button"
              onClick={handleResetScanner}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Foto Baru
            </button>
          )}
        </div>

        {/* Auto-Record Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="pr-3">
            <p className="text-xs font-semibold text-slate-900">
              Catat Pengeluaran Otomatis Saat Foto Masuk
            </p>
            <p className="text-[11px] text-slate-500">
              Tanpa perlu klik simpan manual setelah foto bill diunggah
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoRecordEnabled}
            onClick={() => setAutoRecordEnabled((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              autoRecordEnabled ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ${
                autoRecordEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Action Buttons for Camera vs Upload */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={isCameraOpen ? stopCamera : startCamera}
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>{isCameraOpen ? 'Tutup Kamera' : 'Buka Kamera'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Pilih Foto Bill</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {cameraError && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Live Camera Viewfinder */}
        {isCameraOpen && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-slate-950 aspect-4/3 border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border border-dashed border-white/50 rounded-md pointer-events-none flex items-end justify-center pb-2">
                <span className="text-[11px] text-white/90 bg-black/60 px-2.5 py-0.5 rounded">
                  Posisikan struk/bill di dalam bingkai
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={captureFromCamera}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              Jepret Foto & Catat Pengeluaran Otomatis
            </button>
          </div>
        )}

        {/* Image Preview Slot */}
        {!isCameraOpen && imagePreview && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-[380px] flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Pratinjau foto struk atau bill"
                referrerPolicy="no-referrer"
                className="max-h-[360px] w-auto object-contain"
              />
            </div>
          </div>
        )}

        {/* Sample Receipts for Quick Verification */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <span className="text-xs font-medium text-slate-700 block">
            Uji coba instan (klik contoh struk untuk langsung mencatat otomatis):
          </span>
          <div className="space-y-2">
            {SAMPLE_RECEIPT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isScanning || isSaving}
                onClick={() => handleSelectSampleReceipt(preset)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {preset.label}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {preset.subtitle}
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-700 shrink-0 ml-2">
                  Masukkan Bill →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Auto-Recorded Receipt Summary or Manual Edit Mode */}
      <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              2. Status Pencatatan Pengeluaran Bill
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hasil pembacaan struk otomatis dicatat sebagai pengeluaran Anda.
            </p>
          </div>
          {hasExtractedData && !isScanning && (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Akurasi: {confidence}
            </span>
          )}
        </div>

        {isScanning || isSaving ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-slate-900 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {isScanning
                  ? 'Membaca foto bill & mengekstrak pengeluaran...'
                  : 'Mencatat pengeluaran otomatis ke Google Sheets...'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Mendeteksi toko, daftar belanja, pajak, dan langsung menyimpan ke catatan keuangan Anda.
              </p>
            </div>
          </div>
        ) : !hasExtractedData && !imagePreview ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-semibold text-slate-900">
                Siap Mencatat Otomatis dari Foto Bill
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ambil foto struk dengan kamera, pilih gambar bill dari galeri, atau klik salah satu contoh struk di sebelah kiri. Pengeluaran akan langsung tercatat otomatis tanpa perlu mengetik.
              </p>
            </div>
          </div>
        ) : autoRecordedTx && !isEditingRecorded ? (
          /* AUTO-RECORDED CONFIRMATION SUMMARY CARD */
          <div className="mt-5 space-y-6">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Pengeluaran Berhasil Tercatat Otomatis!
                  </h3>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    {isSheetConnected
                      ? 'Data dari foto bill telah langsung ditambahkan ke Google Sheets Anda via Apps Script.'
                      : 'Data dari foto bill telah langsung tercatat di Buku Kas Anda.'}
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-900 shrink-0">
                {autoRecordedTx.id}
              </span>
            </div>

            {/* Key Recorded Details */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs text-slate-500">
                    Merchant / Toko
                  </span>
                  <h4 className="text-base font-bold text-slate-900">
                    {autoRecordedTx.merchantOrDescription}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {autoRecordedTx.date} · {autoRecordedTx.time} ·{' '}
                    {autoRecordedTx.category} · {autoRecordedTx.paymentMethod}
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs text-slate-500 block">
                    Total Pengeluaran Tercatat
                  </span>
                  <span className="text-xl font-mono font-bold text-red-600 tabular-nums">
                    -Rp {autoRecordedTx.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Rincian Item dari Foto Bill ({items.length} item):
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="py-2 px-3 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-800 font-medium">
                          {it.name}{' '}
                          <span className="text-slate-400 font-mono">
                            ({it.qty}x Rp{it.price.toLocaleString('id-ID')})
                          </span>
                        </span>
                        <span className="font-mono font-medium text-slate-900 tabular-nums">
                          Rp {it.subtotal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {autoRecordedTx.notes && autoRecordedTx.notes !== '-' && (
                <p className="text-xs text-slate-500">
                  Catatan: <span className="text-slate-700">{autoRecordedTx.notes}</span>
                </p>
              )}
            </div>

            {/* Post-Auto-Record Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingRecorded(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Koreksi / Edit Rincian Ini</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Foto Bill Lainnya
                </button>
                <button
                  type="button"
                  onClick={onNavigateToLedger}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <span>Lihat di Buku Kas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT / REVIEW FORM */
          <form onSubmit={handleSubmitOrUpdate} className="mt-5 space-y-5">
            {scanError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Toko / Merchant / Instansi
                </label>
                <input
                  type="text"
                  required
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Contoh: Kopi Senja / Indomaret / PLN"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tanggal Bill
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Waktu
                </label>
                <input
                  type="time"
                  required
                  value={transactionTime}
                  onChange={(e) => setTransactionTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kategori Pengeluaran
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Rincian Item pada Bill ({items.length} baris)
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Item</span>
                </button>
              </div>

              {items.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
                        <th className="py-2 px-3">Nama Item</th>
                        <th className="py-2 px-2 w-16 text-right">Qty</th>
                        <th className="py-2 px-2 w-28 text-right">Harga (Rp)</th>
                        <th className="py-2 px-3 w-32 text-right">Subtotal (Rp)</th>
                        <th className="py-2 px-2 w-9"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleItemChange(idx, 'name', e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-slate-400 rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(idx, 'qty', e.target.value)
                              }
                              className="w-full px-1.5 py-1 text-xs font-mono text-right border border-transparent hover:border-slate-200 focus:border-slate-400 rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min={0}
                              value={item.price}
                              onChange={(e) =>
                                handleItemChange(idx, 'price', e.target.value)
                              }
                              className="w-full px-1.5 py-1 text-xs font-mono text-right border border-transparent hover:border-slate-200 focus:border-slate-400 rounded focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5 font-mono text-right font-medium text-slate-900 px-3">
                            {item.subtotal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              aria-label="Hapus item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tax, Discount, and Final Total */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pajak / Layanan (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={taxAmount}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    setTaxAmount(val);
                    recalculateTotalFromItems(items, val, discountAmount);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Diskon / Potongan (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    setDiscountAmount(val);
                    recalculateTotalFromItems(items, taxAmount, val);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Total Pengeluaran (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={totalAmount}
                  onChange={(e) =>
                    setTotalAmount(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-400 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              {autoRecordedTx && (
                <button
                  type="button"
                  onClick={() => setIsEditingRecorded(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || !merchantName.trim() || totalAmount <= 0}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:bg-slate-300 transition-colors whitespace-nowrap"
              >
                {autoRecordedTx
                  ? 'Simpan Koreksi Pengeluaran'
                  : 'Catat Pengeluaran Sekarang'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

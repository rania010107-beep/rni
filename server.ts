import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const PERMANENT_APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbw-nKZ5FvR1NsRuFXbN1Bvx-2nyROJsAEF43R77tYmcogmCZmwFBWAS4GFO0ZB3Ciqw/exec';

  // Proxy endpoint for Google Apps Script Web App (avoids browser CORS & handles 302 redirects cleanly)
  app.post('/api/apps-script', async (req, res) => {
    try {
      const { scriptUrl, payload } = req.body;
      const targetUrl =
        typeof scriptUrl === 'string' && scriptUrl.trim()
          ? scriptUrl.trim()
          : PERMANENT_APPS_SCRIPT_URL;

      if (!targetUrl.startsWith('https://script.google.com/macros/s/')) {
        res.status(400).json({
          error:
            'Format URL tidak valid. Pastikan URL diawali dengan https://script.google.com/macros/s/.../exec',
        });
        return;
      }

      const action = payload?.action || 'list';

      const postToSheetTab = async (tabName: string, customPayload: any) => {
        const res = await fetch(targetUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            ...customPayload,
            sheetName: tabName,
          }),
        });
        return res;
      };

      let response: Response;
      if (action === 'list') {
        const sep = targetUrl.includes('?') ? '&' : '?';
        response = await fetch(
          `${targetUrl}${sep}action=list&sheetName=Catatan_Keuangan&t=${Date.now()}`,
          {
            method: 'GET',
            redirect: 'follow',
            headers: {
              Accept: 'application/json',
            },
          }
        );
      } else {
        // Execute on primary tab (Catatan_Keuangan)
        response = await postToSheetTab(
          payload?.sheetName || 'Catatan_Keuangan',
          payload
        );

        // Also mirror mutating actions (append, update, delete) to Sheet1 so the first default tab in Google Sheets is always populated!
        if (['append', 'update', 'delete'].includes(action)) {
          postToSheetTab('Sheet1', payload).catch((err) =>
            console.warn('Mirror to Sheet1 warning:', err)
          );
        }
      }

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // Usually happens if the user deployed with access restricted to "Only myself" instead of "Anyone"
        if (text.includes('<!DOCTYPE html>') || text.includes('accounts.google.com')) {
          res.status(403).json({
            error:
              'Google Apps Script meminta login. Pastikan saat Deploy di Apps Script, bagian "Siapa yang memiliki akses (Who has access)" diatur ke "Siapa saja (Anyone)" dan gunakan URL berakhiran /exec.',
          });
          return;
        }
        res.status(502).json({
          error: 'Respons dari Apps Script bukan format JSON yang valid. Pastikan kode Apps Script sudah disimpan dan di-deploy ulang.',
        });
        return;
      }

      if (data?.status === 'error') {
        res.status(400).json({ error: data.message || 'Terjadi kesalahan pada Google Apps Script.' });
        return;
      }

      // If this was initial setup and Catatan_Keuangan has transactions, ensure Sheet1 is also populated
      if (
        action === 'setup' &&
        Array.isArray(data?.transactions) &&
        data.transactions.length > 0
      ) {
        fetch(`${targetUrl}?action=list&sheetName=Sheet1&t=${Date.now()}`, {
          method: 'GET',
          redirect: 'follow',
        })
          .then((r) => r.json())
          .then((sheet1Data) => {
            if (
              Array.isArray(sheet1Data?.transactions) &&
              sheet1Data.transactions.length === 0
            ) {
              return postToSheetTab('Sheet1', {
                action: 'append',
                transactions: data.transactions,
              });
            }
          })
          .catch(() => {});
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error communicating with Apps Script:', error);
      res.status(500).json({
        error:
          error?.message ||
          'Gagal menghubungi URL Google Apps Script. Periksa koneksi dan URL Web App Anda.',
      });
    }
  });

  // Endpoint for scanning receipt / bill photo via Gemini Vision
  app.post('/api/scan-bill', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        res.status(400).json({ error: 'Data gambar struk/bill tidak ditemukan.' });
        return;
      }

      // Clean base64 prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const resolvedMimeType = mimeType || 'image/jpeg';

      const todayStr = new Date().toISOString().slice(0, 10);

      const prompt = `Anda adalah asisten akuntan keuangan pribadi yang ahli membaca foto struk belanja, nota, kuitansi, tagihan (listrik/air/internet), dan bukti transfer di Indonesia.
Analisis gambar struk/bill ini secara teliti dan ekstrak seluruh informasinya ke dalam format JSON yang diminta.

Aturan ekstraksi:
1. merchantName: Nama toko, restoran, penyedia layanan, atau pengirim/penerima pada nota.
2. transactionDate: Tanggal transaksi dalam format YYYY-MM-DD. Jika tidak tercantum tahun atau tanggal lengkap, gunakan "${todayStr}".
3. transactionTime: Waktu transaksi dalam format HH:mm (contoh "14:30"). Jika tidak tercantum, gunakan "12:00".
4. type: Pilih "EXPENSE" jika ini adalah pengeluaran (struk belanja, makan, tagihan, transfer keluar) atau "INCOME" jika ini adalah bukti pemasukan (slip gaji, bukti pembayaran diterima, pemasukan usaha).
5. category: Pilih satu kategori yang paling tepat dari daftar berikut:
   - untuk EXPENSE: "Makanan & Minuman", "Belanja Harian", "Transportasi", "Tagihan & Utilitas", "Kesehatan", "Hiburan & Gaya Hidup", "Pendidikan", "Keluarga & Rumah", "Lainnya"
   - untuk INCOME: "Gaji & Upah", "Bonus & Komisi", "Hasil Usaha", "Investasi", "Transfer Masuk", "Lainnya"
6. totalAmount: Total akhir yang dibayarkan dalam angka bulat Rupiah (tanpa titik/koma ribuan, contoh: 125500). Perhatikan di Indonesia titik (.) sering dipakai sebagai pemisah ribuan (misal 50.000 berarti lima puluh ribu, bukan lima puluh).
7. taxOrServiceAmount: Jumlah pajak (PPN/PB1) ditambah biaya layanan/admin jika ada dalam angka bulat Rupiah (0 jika tidak ada).
8. discountAmount: Jumlah total diskon/potongan harga dalam angka bulat Rupiah (0 jika tidak ada).
9. paymentMethod: Metode pembayaran yang tertera, pilih salah satu dari: "Tunai", "QRIS", "Transfer Bank", "Kartu Debit/Kredit", "E-Wallet", "Lainnya".
10. items: Daftar setiap barang/layanan yang dibeli beserta kuantitas (qty), harga satuan (price), dan subtotal dalam angka bulat Rupiah.
11. notes: Ringkasan singkat atau nomor struk/referensi jika ada.
12. confidence: Tingkat kejelasan pembacaan ("Tinggi", "Sedang", atau "Rendah").`;

      const candidateModels = [
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite',
      ];

      let rawText: string | undefined;
      let lastModelError: any = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: resolvedMimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  merchantName: {
                    type: Type.STRING,
                    description: 'Nama merchant, toko, atau instansi pada bill/struk.',
                  },
                  transactionDate: {
                    type: Type.STRING,
                    description: 'Tanggal transaksi dalam format YYYY-MM-DD.',
                  },
                  transactionTime: {
                    type: Type.STRING,
                    description: 'Waktu transaksi dalam format HH:mm.',
                  },
                  type: {
                    type: Type.STRING,
                    description: 'EXPENSE untuk pengeluaran atau INCOME untuk pemasukan.',
                  },
                  category: {
                    type: Type.STRING,
                    description: 'Kategori transaksi yang paling relevan.',
                  },
                  totalAmount: {
                    type: Type.NUMBER,
                    description: 'Total akhir transaksi dalam Rupiah (angka bulat).',
                  },
                  taxOrServiceAmount: {
                    type: Type.NUMBER,
                    description: 'Total pajak dan biaya layanan jika ada (angka bulat).',
                  },
                  discountAmount: {
                    type: Type.NUMBER,
                    description: 'Total potongan/diskon jika ada (angka bulat).',
                  },
                  paymentMethod: {
                    type: Type.STRING,
                    description: 'Metode pembayaran: Tunai, QRIS, Transfer Bank, Kartu Debit/Kredit, E-Wallet, atau Lainnya.',
                  },
                  items: {
                    type: Type.ARRAY,
                    description: 'Rincian item barang atau jasa pada struk.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        qty: { type: Type.NUMBER },
                        price: { type: Type.NUMBER },
                        subtotal: { type: Type.NUMBER },
                      },
                      required: ['name', 'qty', 'price', 'subtotal'],
                    },
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Catatan tambahan atau nomor struk.',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'Tingkat keakuratan pembacaan: Tinggi, Sedang, atau Rendah.',
                  },
                },
                required: [
                  'merchantName',
                  'transactionDate',
                  'transactionTime',
                  'type',
                  'category',
                  'totalAmount',
                  'paymentMethod',
                  'items',
                  'confidence',
                ],
              },
            },
          });

          if (response.text) {
            rawText = response.text;
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed, trying fallback:`, err?.message || err);
          lastModelError = err;
        }
      }

      if (!rawText) {
        throw lastModelError || new Error('Model tidak mengembalikan hasil pembacaan struk.');
      }

      const parsed = JSON.parse(rawText.trim());
      res.json({ result: parsed });
    } catch (error: any) {
      console.error('Error scanning bill:', error);
      res.status(500).json({
        error: error?.message || 'Gagal memindai foto bill/struk. Pastikan gambar jelas dan coba lagi.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

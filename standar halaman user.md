# Standar UI Halaman Tabel Data User

Dokumen ini adalah pedoman dan acuan standar resmi untuk seluruh halaman tabel data pengguna di aplikasi Marketplace Report. Seluruh halaman berbasis tabel harus menerapkan struktur dan gaya ini agar pengalaman pengguna (UX) konsisten, modern, ultra-compact, dan proporsional.

---

## 1. Prinsip Utama Desain

1. **Pemanfaatan Layar Penuh (100% Full-Width & Full-Height):**
   - Halaman tabel tidak dibatasi oleh `maxWidth: 1400px` (menggunakan `100%`).
   - Tinggi halaman memanfaatkan seluruh tinggi layar monitor (*viewport-fill*), sehingga tabel memanjang penuh ke dasar layar tanpa menyisakan ruang putih kosong di bawah paginasi dan tanpa memicu scrollbar ganda pada browser.
2. **Dua Kartu Mandiri Terpisah (Header & Tabel):**
   - **Kartu Header:** Berdiri sendiri sebagai kartu putih elegan di bagian atas (`borderRadius: 12px`, `border: 1px solid #e2e8f0`, `marginBottom: 0.5rem`).
   - **Kartu Tabel:** Berdiri sendiri di bawah kartu header, membentang mengisi seluruh sisa ruang vertikal layar (`flex: 1`, `minHeight: 0`).
3. **Penataan Toolbar Ergonomis:**
   - **Sisi Kiri:** Identitas halaman (Icon dengan gradien, Judul Halaman tebal, Badge total data).
   - **Sisi Kanan (Pepet Kanan):** Input pencarian (*Search Bar*) berjejer rapat di sisi kanan bersama tombol-tombol filter (Tanggal, Status, Kategori), tombol Reset cepat, pemisah vertikal, dan tombol Export.

---

## 2. Struktur Kode Komponen (Blueprint)

### A. Container Utama Halaman (`return (...)`)
```jsx
<div style={{
    display: 'flex',
    flexDirection: 'column',
    height: isMobile ? 'calc(100vh - 8.35rem)' : 'calc(100vh - 1.3rem)',
    overflow: 'hidden',
}}>
```

### B. Kartu Header & Filter Toolbar (Separate Card)
```jsx
{/* ── Top Header Toolbar (Separate Card) ── */}
<div
    style={{
        flexShrink: 0,
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        padding: isMobile ? '0.55rem 0.65rem' : '0.55rem 0.85rem',
        marginBottom: '0.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '0.5rem' : '0.85rem',
    }}
>
    {/* Sisi Kiri: Icon + Judul + Total Badge */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.65rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div
                style={{
                    width: isMobile ? 28 : 32,
                    height: isMobile ? 28 : 32,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.22)',
                }}
            >
                <ModuleIcon size={isMobile ? 15 : 17} strokeWidth={2.3} />
            </div>
            <h2
                style={{
                    margin: 0,
                    fontSize: isMobile ? '0.925rem' : '1.025rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                }}
            >
                {JudulHalaman}
            </h2>
        </div>
        <span
            style={{
                fontSize: isMobile ? '0.675rem' : '0.725rem',
                fontWeight: 600,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '2px 8px',
                borderRadius: '9999px',
                whiteSpace: 'nowrap',
            }}
        >
            {totalData.toLocaleString('id-ID')} data
        </span>
    </div>

    {/* Sisi Kanan: Search Bar (Pepet Kanan) + Action Buttons */}
    <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        width: isMobile ? '100%' : 'auto',
        justifyContent: isMobile ? 'stretch' : 'flex-end',
    }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: isMobile ? '100%' : '240px', flexShrink: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: searchQuery ? '#6366f1' : '#94a3b8', pointerEvents: 'none' }} />
            <input
                type="text"
                placeholder="Cari data..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 1.8rem 0 2.2rem',
                    borderRadius: '8px',
                    border: searchQuery ? '1px solid #6366f1' : '1px solid #e2e8f0',
                    background: searchQuery ? '#f5f3ff' : '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.775rem',
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'all 0.15s ease',
                }}
            />
            {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.15rem', display: 'flex' }}>
                    <X size={13} />
                </button>
            )}
        </div>

        {/* Filter Tombol (Tanggal / Dropdown) */}
        {/* Tinggi standar: 34px, radius: 8px, font-size: 0.75rem, font-weight: 600 */}

        {/* Tombol Reset Filter (Otomatis muncul jika ada filter aktif) */}
        {hasAnyFilter && (
            <button
                type="button"
                onClick={handleResetAllFilters}
                title="Reset semua filter"
                style={{
                    height: '34px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}
            >
                <RotateCcw size={12} />
                <span>Reset</span>
            </button>
        )}

        {/* Pembatas Vertikal */}
        {!isMobile && <div style={{ height: '20px', width: '1px', background: '#e2e8f0', margin: '0 2px' }} />}

        {/* Tombol Export */}
        <button
            type="button"
            onClick={handleExport}
            style={{
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.28)',
                whiteSpace: 'nowrap',
            }}
        >
            <Download size={13} />
            <span>Export</span>
        </button>
    </div>
</div>
```

### C. Kartu Tabel Data (`modern-table-wrapper`)

Terdapat 3 variasi struktur isi tabel yang didukung, seluruhnya wajib dibungkus dalam container standar berikut:

```jsx
{/* ── Table Container (Separate Card Filling All Remaining Space) ── */}
<div
    className="modern-table-wrapper"
    style={{
        flex: 1,
        minHeight: 0,
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    }}
>
    {/* Single Table Scroll Container (both horizontal and vertical scroll) */}
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="modern-table compact-table" style={{ width: '100%', minWidth: isMobile ? '700px' : '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Header Columns */}
            </thead>
            <tbody>
                {/* Data Rows */}
            </tbody>
        </table>
    </div>

    {/* Integrated Footer (Paginasi atau Status Info) */}
    <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.4rem',
        padding: isMobile ? '0.35rem 0.6rem' : '0.4rem 0.85rem',
        background: '#fcfdfe',
        borderTop: '1px solid #eef0f6',
        fontSize: isMobile ? '0.7rem' : '0.75rem',
    }}>
        {/* Row count selector & page navigation */}
    </div>
</div>
```

#### Variasi Tabel:
1. **Tabel Flat Standar (Single-Tier Header):**
   - Diterapkan pada `/rangkuman`, `/return`, `/pengembalian`.
   - Satu baris `<th>` di `<thead>`, seluruh kolom dapat disortir langsung.
2. **Tabel Matriks Berkelompok (Multi-Tier Header):**
   - Diterapkan pada `/olahan` (Analisis Pesanan).
   - Baris 1: Grup metrik utama (`PESANAN`, `DIBATALKAN`, dsb.) menggunakan `colSpan={2}`, atau metrik tunggal (`PENERIMAAN BERSIH`, `MARGIN KONTRIBUSI`) menggunakan `rowSpan={2}`.
   - Baris 2: Sub-kolom rincian (`Order`, `PCS`).
   - Baris 3 (Header/Awal Body): Baris rangkuman `Jumlah` dengan warna latar lembut (`#ede9fe` / `var(--bg-card)`).
   - Sticky Kolom Kiri: Kolom `No` (`left: 0`) dan Dimensi/Tanggal (`left: 3rem`) terkunci saat scroll horizontal.
3. **Tabel Hirarkis (Expandable Drill-down):**
   - Diterapkan pada `/analisis` (Wawasan Produk).
   - Baris induk (SKU / Provinsi) dapat diklik untuk membuka baris anak rincian (Variasi Produk / Daftar Kota).
   - Memiliki toggle tampilan mode `Flat List` vs `Hierarchical`.

---

## 3. Konfigurasi Padding pada `src/App.js`

Agar seluruh halaman memanfaatkan 100% lebar layar dan kartu pas membentang ke bawah tanpa menyisakan ruang kosong atau scrollbar ganda:
```javascript
// Konfigurasi container <main> di src/App.js untuk SELURUH halaman aplikasi
padding: isDesktop ? '0.65rem 1rem' : '0.5rem',
paddingTop: isDesktop ? '0.65rem' : '3.65rem',
paddingBottom: isDesktop ? '0.65rem' : '4.5rem',
maxWidth: '100%', // Bebas dari batasan 1400px agar tidak ada sisa ruang kosong di sisi kiri/kanan monitor desktop
```

---

## 4. Standar Tipografi & Perataan Kolom

1. **Nomor Urut (`No`):** Rata tengah (`center`), lebar sempit (`width: 2.5rem` / `width: 3rem`).
2. **Order ID / Resi / Kode Unik:** Font monospace (`ui-monospace, SFMono-Regular, monospace`), `letterSpacing: -0.02em`, `color: #7c3aed`.
3. **Nilai Angka / Keuangan (Rupiah, HPP, Pencairan, Margin, dsb.):** Rata kanan (`right`), tabular numbers (`fontVariantNumeric: tabular-nums`).
4. **Status / Status Pengiriman / Qty:** Rata tengah (`center`).
5. **Nama Produk / Alamat / Catatan:** Rata kiri (`left`), dengan ellipsis jika melebihi batas.

---

## 5. Daftar Halaman yang Telah Menerapkan Standar Penuh

1. `/` — **Dashboard Utama** (`Dashboard.js`) — `[SELESAI - 100% Full Width & Compact]`
2. `/upload` — **Upload File** (`UploadFile.js`) — `[SELESAI - Separate Card & Full Width]`
3. `/rangkuman` — **Rekap Transaksi** (`RangkumanTransaksi.js`) — `[SELESAI & TERUJI]`
4. `/olahan` — **Analisis Pesanan** (`OlahanDataPesanan.js`) — `[SELESAI & TERUJI]`
5. `/return` — **Retur Penjualan** (`ReturnTable.js`) — `[SELESAI & TERUJI]`
6. `/pengembalian` — **Pengembalian Dana** (`PengembalianTable.js`) — `[SELESAI & TERUJI]`
7. `/analisis` — **Analisis Produk** (`ProductAnalysis.js`) — `[SELESAI & TERUJI]`
8. `/aset` — **Aset Barang** (`AsetTable.js`) — `[SELESAI - Standard Card & Viewport Table]`
9. `/operasional` — **Biaya Operasional** (`OperasionalTable.js`) — `[SELESAI - Standard Card & Viewport Table]`
10. `/stores` — **Kelola Toko** (`StoreManagement.js`) — `[SELESAI - Standard Card Header]`

---

## 6. Penanganan Cache Browser (Anti-Cache)
Karena aplikasi ini adalah Single Page Application (SPA), browser (Chrome/Edge) dapat menyimpan cache file JavaScript lama di memori saat berpindah halaman via navigasi internal:
1. **Server Header HTTP:** `marketplace-api/routes/web.php` menyematkan header `Cache-Control: no-cache, no-store, must-revalidate` pada respons HTML agar browser selalu memeriksa versi bundle terbaru.
2. **HTML Meta Tags:** `public/index.html` dilengkapi meta tag anti-cache (`<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />`).
3. **Penyegaran Pengguna:** Jika pengguna masih melihat tampilan lama setelah kompilasi, lakukan **Hard Refresh** (`Ctrl + Shift + R` atau `Ctrl + F5`) untuk membersihkan cache chunk lama.

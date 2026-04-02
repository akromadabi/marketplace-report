import React from 'react';

function Nav({ currentPage, setCurrentPage }) {
    const menuItems = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'upload', label: 'Upload File' },
        { key: 'orders', label: 'Tabel Pesanan' },
        { key: 'payments', label: 'Tabel Pembayaran' },
        { key: 'productAnalysis', label: 'Produk Analisis' },
        { key: 'rangkuman', label: 'Rekap Transaksi' },
        { key: 'return', label: 'Retur' },
    ];

    return (
        <nav className="bg-white shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-14 items-center">
                    <h1 className="text-xl font-semibold text-indigo-600 select-none">FlatDesignApp</h1>
                    <div className="hidden md:flex space-x-4">
                        {menuItems.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setCurrentPage(key)}
                                className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${currentPage === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-indigo-100 hover:text-indigo-600'}`}
                                aria-current={currentPage === key ? 'page' : undefined}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Nav;
import React, { useState, useMemo } from 'react';
import DataTable from './DataTable';
import { Search, CreditCard } from 'lucide-react';

function PaymentsTable({ paymentsData, search, setSearch }) {
  const normalizedPayments = useMemo(() => {
    return paymentsData.map((row) => {
      const newRow = {};
      Object.entries(row).forEach(([k, v]) => {
        newRow[k.trim()] = v;
      });
      return newRow;
    });
  }, [paymentsData]);

  const columns = useMemo(() => {
    if (normalizedPayments.length === 0) return [];
    const keysSet = new Set();
    normalizedPayments.forEach((row) => Object.keys(row).forEach((k) => keysSet.add(k)));
    return Array.from(keysSet);
  }, [normalizedPayments]);

  const filteredPayments = useMemo(() => {
    if (!search.trim()) return normalizedPayments;
    const s = search.toLowerCase();
    return normalizedPayments.filter((row) =>
      Object.values(row).some((val) => val && val.toString().toLowerCase().includes(s))
    );
  }, [normalizedPayments, search]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={24} style={{ color: '#7c3aed' }} />
            Tabel Pembayaran
          </h2>
          <p>{filteredPayments.length.toLocaleString('id-ID')} pembayaran</p>
        </div>
        <div style={{ position: 'relative', maxWidth: '20rem', flex: '1' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Cari pembayaran..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      <DataTable columns={columns} data={filteredPayments} />
    </div>
  );
}

export default PaymentsTable;
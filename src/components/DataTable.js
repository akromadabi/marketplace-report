import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from 'lucide-react';

function DataTable({ columns, data, children }) {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
    const [columnFilters, setColumnFilters] = useState({});
    const [filterPopupOpen, setFilterPopupOpen] = useState(null);
    const [filterPopupPos, setFilterPopupPos] = useState({ top: 0, left: 0 });
    const filterPopupRef = useRef(null);
    const filterButtonRefs = useRef({});

    const openFilterPopup = useCallback((colKey, buttonEl) => {
        if (filterPopupOpen === colKey) {
            setFilterPopupOpen(null);
            return;
        }
        const rect = buttonEl.getBoundingClientRect();
        setFilterPopupPos({
            top: rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - 240),
        });
        setFilterPopupOpen(colKey);
    }, [filterPopupOpen]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                filterPopupRef.current && !filterPopupRef.current.contains(event.target) &&
                !Object.values(filterButtonRefs.current).some(btn => btn && btn.contains(event.target))
            ) {
                setFilterPopupOpen(null);
            }
        }
        if (filterPopupOpen !== null) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterPopupOpen]);

    function getUniqueValuesForColumn(col) {
        const valuesSet = new Set();
        data.forEach((row) => {
            let val = row[col];
            if (val !== undefined && val !== null) {
                val = val.toString();
                valuesSet.add(val);
            }
        });
        return Array.from(valuesSet).sort((a, b) => a.localeCompare(b));
    }

    function toggleFilterValue(col, val) {
        setColumnFilters((prev) => {
            const prevSet = prev[col] ? new Set(prev[col]) : new Set();
            if (prevSet.has(val)) prevSet.delete(val);
            else prevSet.add(val);
            return { ...prev, [col]: prevSet.size > 0 ? prevSet : undefined };
        });
    }

    function clearFilterForColumn(col) {
        setColumnFilters((prev) => {
            const newFilters = { ...prev };
            delete newFilters[col];
            return newFilters;
        });
    }

    const filteredData = useMemo(() => {
        return data.filter((row) => {
            for (const [col, filterSet] of Object.entries(columnFilters)) {
                if (filterSet && filterSet.size > 0) {
                    let val = row[col];
                    if (val === undefined || val === null) val = "";
                    val = val.toString();
                    if (!filterSet.has(val)) return false;
                }
            }
            return true;
        });
    }, [data, columnFilters]);

    function sortValues(a, b) {
        if (a == null) a = "";
        if (b == null) b = "";
        const aNum = parseFloat(a.toString().replace(/[^0-9.-]+/g, ""));
        const bNum = parseFloat(b.toString().replace(/[^0-9.-]+/g, ""));
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.toString().localeCompare(b.toString());
    }

    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;
        const { key, direction } = sortConfig;
        return [...filteredData].sort((a, b) => {
            const cmp = sortValues(a[key], b[key]);
            return direction === "asc" ? cmp : -cmp;
        });
    }, [filteredData, sortConfig]);

    function requestSort(key) {
        let direction = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });
    }

    function SortIcon({ columnKey }) {
        const size = 12;
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={size} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        return sortConfig.direction === "asc"
            ? <ArrowUp size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />
            : <ArrowDown size={size} style={{ color: '#a78bfa', marginLeft: '4px' }} />;
    }

    function FilterPopup({ columnKey, values, selectedValues, onToggleValue, onClear, onClose, position }) {
        return ReactDOM.createPortal(
            <div ref={filterPopupRef} className="filter-popup" role="dialog" aria-modal="true"
                style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Filter: {columnKey}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }} type="button">
                        <X size={14} />
                    </button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {values.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Tidak ada nilai.</p>
                    ) : (
                        values.map((val) => (
                            <label key={val} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem 0',
                                color: 'var(--text-secondary)',
                            }}>
                                <input type="checkbox" checked={selectedValues.has(val)} onChange={() => onToggleValue(val)}
                                    style={{ accentColor: 'var(--accent-primary)' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                            </label>
                        ))
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', gap: '0.5rem' }}>
                    <button type="button" onClick={onClear} style={{
                        background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.6875rem',
                        fontWeight: 600, cursor: 'pointer', padding: '0.25rem',
                    }}>Clear</button>
                    <button type="button" onClick={onClose} className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.6875rem' }}>
                        Close
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    const platformIcons = {
        Tiktok: "https://static.vecteezy.com/system/resources/previews/023/986/939/non_2x/tiktok-logo-tiktok-logo-transparent-tiktok-icon-transparent-free-free-png.png",
        Shopee: "https://static.vecteezy.com/system/resources/previews/053/407/516/non_2x/shopee-logo-shopee-icon-transparent-social-media-icons-free-png.png",
        Lazada: "https://static.cdnlogo.com/logos/l/48/lazada-icon800x800.png",
        Tokopedia: "https://freelogopng.com/images/all_img/1691990957tokopedia-icon-png.png",
        Unknown: "https://icons.iconarchive.com/icons/custom-icon-design/flatastic-1/512/delete-icon.png",
    };

    return (
        <div className="modern-table-wrapper">
            <div style={{ overflowX: 'auto' }}>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ width: '3rem' }}>No</th>
                                <th style={{ cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <span onClick={() => requestSort("Channel Marketplace")}>Channel</span>
                                        <button type="button" ref={el => filterButtonRefs.current["Channel Marketplace"] = el} onClick={(e) => {
                                            e.stopPropagation();
                                            openFilterPopup("Channel Marketplace", e.currentTarget);
                                        }} style={{
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem',
                                            color: columnFilters["Channel Marketplace"]?.size > 0 ? '#a78bfa' : 'var(--text-tertiary)',
                                        }}>
                                            <Filter size={11} />
                                        </button>
                                        <SortIcon columnKey="Channel Marketplace" />
                                    </div>
                                </th>
                                {columns.map((col) => {
                                    const uniqueValues = getUniqueValuesForColumn(col);
                                    const selectedValues = columnFilters[col] || new Set();
                                    const isFilterActive = selectedValues.size > 0;
                                    return (
                                        <th key={col} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span onClick={() => requestSort(col)}>{col}</span>
                                                <button type="button" ref={el => filterButtonRefs.current[col] = el} onClick={(e) => {
                                                    e.stopPropagation();
                                                    openFilterPopup(col, e.currentTarget);
                                                }} style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem',
                                                    color: isFilterActive ? '#a78bfa' : 'var(--text-tertiary)',
                                                }}>
                                                    <Filter size={11} />
                                                </button>
                                                <SortIcon columnKey={col} />
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
                                        Tidak ada data untuk ditampilkan.
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((row, i) => {
                                    const channel = row["Channel Marketplace"] || "Unknown";
                                    const iconSrc = platformIcons[channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase()] || platformIcons.Unknown;
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</td>
                                            <td title={channel}>
                                                <img src={iconSrc} alt={channel} style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }} loading="lazy" />
                                            </td>
                                            {children
                                                ? children(row, i)
                                                : columns.map((col) => (
                                                    <td key={col} title={row[col]}>{row[col]}</td>
                                                ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {filterPopupOpen && (
                <FilterPopup
                    columnKey={filterPopupOpen}
                    values={getUniqueValuesForColumn(filterPopupOpen)}
                    selectedValues={columnFilters[filterPopupOpen] || new Set()}
                    onToggleValue={(val) => toggleFilterValue(filterPopupOpen, val)}
                    onClear={() => clearFilterForColumn(filterPopupOpen)}
                    onClose={() => setFilterPopupOpen(null)}
                    position={filterPopupPos}
                />
            )}
        </div>
    );
}

export default DataTable;
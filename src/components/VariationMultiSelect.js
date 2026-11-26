import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * Check if a variation value/part matches the selected filter.
 * Supports:
 * - 'Semua' / 'Semua Variasi' / null / undefined / [] => matches all
 * - string (single selection, e.g. 'Jumbo') => exact match
 * - array (multi selection, e.g. ['Jumbo', 'Standar']) => includes match
 */
export function isVarMatch(sel, part) {
  if (!sel || sel === 'Semua' || sel === 'Semua Variasi') return true;
  if (Array.isArray(sel)) {
    if (sel.length === 0 || sel.includes('Semua') || sel.includes('Semua Variasi')) return true;
    return sel.includes(part);
  }
  return sel === part;
}

/**
 * Clean and format SKU/product name:
 * - Removes '__NS__' prefix
 * - Replaces hyphens '-' and underscores '_' with space
 * - Capitalizes each word neatly (Title Case, e.g. 'celana-strip' -> 'Celana Strip', 'ETTA-PANT' -> 'Etta Pant')
 * - Preserves short acronyms (e.g. 'HW', 'XL', 'BB')
 */
export function formatDisplayName(str) {
  if (!str) return '';
  let clean = String(str).replace(/^__NS__/, '').trim();
  clean = clean.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(' ').map(word => {
    if (!word) return '';
    if (word.length <= 3 && word === word.toUpperCase() && !/\d/.test(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export default function VariationMultiSelect({
  values = [],
  selected = [],
  onChange,
  allLabel = 'Semua',
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Normalize selected to an array
  const isAll = !selected ||
    selected === 'Semua' ||
    selected === 'Semua Variasi' ||
    (Array.isArray(selected) && (selected.length === 0 || selected.includes('Semua') || selected.includes('Semua Variasi')));

  const selectedList = isAll
    ? []
    : (Array.isArray(selected) ? selected : [selected]).filter(Boolean);

  // Close when clicked outside or Escape pressed
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleAll = () => {
    onChange([]);
  };

  const toggleItem = (val) => {
    let next;
    if (isAll) {
      // From "Semua", clicking a specific variation selects only that one
      next = [val];
    } else {
      if (selectedList.includes(val)) {
        next = selectedList.filter(x => x !== val);
        if (next.length === 0) next = [];
      } else {
        next = [...selectedList, val];
        // If all items are selected, reset to "Semua" (empty array)
        if (next.length === values.length) {
          next = [];
        }
      }
    }
    onChange(next);
  };

  // Determine button display label
  let displayLabel = allLabel;
  if (!isAll && selectedList.length > 0) {
    if (selectedList.length === 1) {
      displayLabel = selectedList[0];
    } else if (selectedList.length <= 2) {
      const joined = selectedList.join(', ');
      displayLabel = joined.length > 16 ? `${selectedList.length} variasi` : joined;
    } else {
      displayLabel = `${selectedList.length} variasi`;
    }
  }

  const filteredValues = search.trim()
    ? values.filter(v => v.toLowerCase().includes(search.trim().toLowerCase()))
    : values;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 60 : 1,
        ...style
      }}
    >
      <button
        type="button"
        className={`im-bulk-select ${className}`}
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.4rem',
          minWidth: '85px',
          height: '30px',
          padding: '0 0.55rem',
          fontSize: '0.75rem',
          background: isAll ? '#ffffff' : 'rgba(108, 92, 231, 0.08)',
          borderColor: isAll ? '#cbd5e1' : '#6c5ce7',
          color: isAll ? '#0f172a' : '#6c5ce7',
          fontWeight: isAll ? 500 : 700,
          cursor: 'pointer',
          borderRadius: '6px',
          border: '1px solid',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease'
        }}
        title={!isAll ? `Variasi terpilih: ${selectedList.join(', ')}` : allLabel}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
          {displayLabel}
        </span>
        {!isAll && selectedList.length > 1 && (
          <span
            style={{
              background: '#6c5ce7',
              color: '#ffffff',
              borderRadius: '99px',
              fontSize: '0.625rem',
              padding: '1px 5px',
              lineHeight: '1.2',
              fontWeight: 700
            }}
          >
            {selectedList.length}
          </span>
        )}
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
            color: isAll ? '#64748b' : '#6c5ce7'
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1050,
            minWidth: '160px',
            maxWidth: '260px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '0.35rem 0',
            fontSize: '0.75rem'
          }}
        >
          {/* Optional Search if many items */}
          {values.length > 6 && (
            <div style={{ padding: '0.25rem 0.5rem 0.35rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={11} style={{ position: 'absolute', left: '0.45rem', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Cari opsi..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '24px',
                    padding: '0 1.25rem 0 1.35rem',
                    fontSize: '0.7rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Header "Semua" option */}
          <div
            onClick={toggleAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              background: isAll ? 'rgba(108, 92, 231, 0.08)' : 'transparent',
              fontWeight: isAll ? 700 : 500,
              color: isAll ? '#6c5ce7' : '#1e293b',
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => { if (!isAll) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { if (!isAll) e.currentTarget.style.background = 'transparent'; }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: isAll ? '1px solid #6c5ce7' : '1px solid #cbd5e1',
                background: isAll ? '#6c5ce7' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isAll && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span style={{ flex: 1 }}>{allLabel}</span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>({values.length})</span>
          </div>

          <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0' }} />

          {/* Individual options */}
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {filteredValues.length === 0 ? (
              <div style={{ padding: '0.5rem 0.65rem', color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center' }}>
                Tidak ada opsi cocok
              </div>
            ) : (
              filteredValues.map(val => {
                const isChecked = selectedList.includes(val);
                return (
                  <div
                    key={val}
                    onClick={() => toggleItem(val)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0.65rem',
                      cursor: 'pointer',
                      background: isChecked ? 'rgba(108, 92, 231, 0.05)' : 'transparent',
                      color: isChecked ? '#6c5ce7' : '#334155',
                      fontWeight: isChecked ? 600 : 400,
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isChecked ? 'rgba(108, 92, 231, 0.08)' : '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isChecked ? 'rgba(108, 92, 231, 0.05)' : 'transparent'; }}
                  >
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: isChecked ? '1px solid #6c5ce7' : '1px solid #cbd5e1',
                        background: isChecked ? '#6c5ce7' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isChecked && <Check size={10} color="#ffffff" strokeWidth={3} />}
                    </div>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={val}
                    >
                      {val}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {!isAll && (
            <div
              style={{
                padding: '0.35rem 0.65rem 0.1rem',
                borderTop: '1px solid #f1f5f9',
                marginTop: '0.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '0.65rem', color: '#6c5ce7', fontWeight: 600 }}>
                {selectedList.length} terpilih
              </span>
              <button
                type="button"
                onClick={toggleAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6c5ce7',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Reset ke {allLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

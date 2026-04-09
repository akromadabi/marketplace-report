// Format helpers extracted for general use
export function fmtRp(val) {
  if (!val && val !== 0) return '';
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) || n === 0 ? '' : 'Rp' + n.toLocaleString('id-ID');
}

export function toRawNum(val) {
  if (val === undefined || val === null) return null;
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

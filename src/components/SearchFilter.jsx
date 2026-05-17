import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

/*  Reusable search + filter bar for all dashboard tabs.
 *
 *  Props:
 *    data          – full array from Supabase
 *    onFilter      – callback(filteredArray)  — called on every change
 *    searchFields  – string[]  fields to search against  (default: ['commodity','hs4','hs8'])
 *    filters       – array of { key, label, options?, valuesFn? }
 *                     If `options` is provided it's used directly; else unique values are auto‑derived.
 *                     A special value '__verdict__' auto-fills EXCELLENT/GOOD/MODERATE/THIN/NEGATIVE/NO_DATA.
 *    placeholder   – search box placeholder text
 *    counts        – bool  show match count badge (default true)
 */

const inputStyle = {
  background: 'rgba(17,24,39,0.7)',
  border: '1px solid rgba(148,163,184,0.15)',
  color: '#e2e8f0',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  outline: 'none',
  minWidth: 0,
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  maxWidth: 200,
  appearance: 'auto',
};

const barStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  padding: '10px 16px',
  background: 'rgba(17,24,39,0.6)',
  border: '1px solid rgba(148,163,184,0.08)',
  borderRadius: 10,
  marginBottom: 16,
};

const VERDICT_OPTIONS = ['All', 'EXCELLENT', 'GOOD', 'MODERATE', 'THIN', 'NEGATIVE', 'NO_DATA'];

export default function SearchFilter({ data = [], onFilter, searchFields, filters = [], placeholder, counts = true }) {
  const sf = searchFields || ['commodity', 'hs4', 'hs8', 'company_name', 'hs2', 'description'];
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dropdowns, setDropdowns] = useState({});
  const debounceRef = useRef(null);

  // Debounce search input — 300ms delay prevents filtering on every keystroke
  const handleSearch = useCallback((val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  // build options for each filter (only recompute when data/filters change)
  const filterMeta = useMemo(() => filters.map(f => {
    if (f.options) return { ...f, opts: f.options };
    if (f.key === '__verdict__' || f.label?.toLowerCase().includes('verdict')) {
      return { ...f, key: f.key === '__verdict__' ? 'margin_verdict' : f.key, opts: VERDICT_OPTIONS };
    }
    const vals = [...new Set(data.map(r => r[f.key]).filter(Boolean))].sort();
    return { ...f, opts: ['All', ...vals] };
  }), [data, filters]);

  // apply filters using debounced search value
  const filtered = useMemo(() => {
    let f = data;
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      f = f.filter(r => sf.some(k => String(r[k] ?? '').toLowerCase().includes(s)));
    }
    filterMeta.forEach(fm => {
      const val = dropdowns[fm.key];
      if (val && val !== 'All') {
        f = f.filter(r => String(r[fm.key]) === val);
      }
    });
    return f;
  }, [data, debouncedSearch, dropdowns, filterMeta, sf]);

  // notify parent via useEffect (proper side-effect, not useMemo)
  const onFilterRef = useRef(onFilter);
  onFilterRef.current = onFilter;
  useEffect(() => { if (onFilterRef.current) onFilterRef.current(filtered); }, [filtered]);

  const clear = () => { setSearch(''); setDebouncedSearch(''); setDropdowns({}); };
  const hasActive = search || Object.values(dropdowns).some(v => v && v !== 'All');

  return (
    <div style={barStyle}>
      <input
        type="text"
        value={search}
        onChange={e => handleSearch(e.target.value)}
        placeholder={placeholder || `Search ${data.length} records...`}
        style={{ ...inputStyle, flex: '1 1 200px', minWidth: 180 }}
      />
      {filterMeta.map(fm => (
        <select
          key={fm.key}
          value={dropdowns[fm.key] || 'All'}
          onChange={e => setDropdowns(d => ({ ...d, [fm.key]: e.target.value }))}
          style={selectStyle}
        >
          {fm.opts.map(o => <option key={o} value={o}>{o === 'All' ? `All ${fm.label}` : o}</option>)}
        </select>
      ))}
      {counts && (
        <span style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>
          {filtered.length}{filtered.length !== data.length ? ` / ${data.length}` : ''}
        </span>
      )}
      {hasActive && (
        <button onClick={clear} style={{ ...inputStyle, cursor: 'pointer', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', padding: '5px 10px', fontSize: 11 }}>
          Clear
        </button>
      )}
    </div>
  );
}

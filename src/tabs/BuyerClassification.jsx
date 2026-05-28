import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import SearchFilter from '../components/SearchFilter';

const card = { background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, padding: 20 };

const CLASS_COLORS = {
  TRADER: '#f87171',
  LIKELY_TRADER: '#fbbf24',
  AMBIGUOUS: '#94a3b8',
  MANUFACTURER: '#34d399',
  CONTRACT_MANUFACTURER: '#60a5fa',
};

const CLASS_ORDER = ['TRADER', 'LIKELY_TRADER', 'AMBIGUOUS', 'MANUFACTURER', 'CONTRACT_MANUFACTURER'];

const badge = (cls) => {
  const c = CLASS_COLORS[cls] || '#94a3b8';
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    background: `rgba(${c === '#f87171' ? '248,113,113' : c === '#fbbf24' ? '251,191,36' : c === '#34d399' ? '52,211,153' : c === '#60a5fa' ? '96,165,250' : '148,163,184'},0.15)`,
    color: c, border: `1px solid rgba(${c === '#f87171' ? '248,113,113' : c === '#fbbf24' ? '251,191,36' : c === '#34d399' ? '52,211,153' : c === '#60a5fa' ? '96,165,250' : '148,163,184'},0.3)`,
  };
};

const fmt = (v) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v?.toFixed(0) || 0}`;

export default function BuyerClassification() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtered, setFiltered] = useState([]);
  const [sort, setSort] = useState({ col: 'total_cif_usd', dir: 'desc' });
  const [view, setView] = useState('traders');

  useEffect(() => {
    supabase.from('buyer_classifications').select('*').order('total_cif_usd', { ascending: false }).limit(3000)
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, []);

  const summary = useMemo(() => {
    const s = {};
    CLASS_ORDER.forEach(c => { s[c] = { count: 0, cif: 0 }; });
    data.forEach(r => {
      const cls = r.classification || 'AMBIGUOUS';
      if (!s[cls]) s[cls] = { count: 0, cif: 0 };
      s[cls].count++;
      s[cls].cif += r.total_cif_usd || 0;
    });
    return s;
  }, [data]);

  const pieData = useMemo(() => CLASS_ORDER.map(c => ({
    name: c.replace('_', ' '), value: summary[c]?.count || 0,
  })), [summary]);

  const cifBarData = useMemo(() => CLASS_ORDER.map(c => ({
    name: c === 'CONTRACT_MANUFACTURER' ? 'CONTRACT MFR' : c.replace('_', ' '),
    cif: summary[c]?.cif || 0,
  })), [summary]);

  const traders = useMemo(() => data.filter(r => r.classification === 'TRADER'), [data]);
  const likelyTraders = useMemo(() => data.filter(r => r.classification === 'LIKELY_TRADER'), [data]);
  const contractMfrs = useMemo(() => data.filter(r => r.classification === 'CONTRACT_MANUFACTURER'), [data]);
  const manufacturers = useMemo(() => data.filter(r => r.classification === 'MANUFACTURER'), [data]);

  const viewData = useMemo(() => {
    if (view === 'traders') return [...traders, ...likelyTraders];
    if (view === 'manufacturers') return [...contractMfrs, ...manufacturers];
    return data;
  }, [view, traders, likelyTraders, contractMfrs, manufacturers, data]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sort.col] ?? -Infinity, bv = b[sort.col] ?? -Infinity;
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const toggleSort = col => setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));

  const thStyle = {
    textAlign: 'left', padding: '8px 10px', color: '#94a3b8', fontSize: 11,
    borderBottom: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer',
    position: 'sticky', top: 0, background: 'rgba(17,24,39,0.95)', textTransform: 'uppercase',
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading buyer classifications...</div>;

  const totalCIF = data.reduce((a, b) => a + (b.total_cif_usd || 0), 0);

  const kpis = [
    { label: 'Total Classified', value: data.length, color: '#60a5fa' },
    { label: 'Confirmed Traders', value: traders.length, color: '#f87171' },
    { label: 'Likely Traders', value: likelyTraders.length, color: '#fbbf24' },
    { label: 'Contract Mfrs', value: contractMfrs.length, color: '#60a5fa' },
    { label: 'Manufacturers', value: manufacturers.length, color: '#34d399' },
    { label: 'Total CIF', value: fmt(totalCIF), color: '#a78bfa' },
  ];

  const viewBtns = [
    { id: 'traders', label: 'Traders & Likely Traders', count: traders.length + likelyTraders.length },
    { id: 'manufacturers', label: 'Manufacturers & Contract Mfrs', count: contractMfrs.length + manufacturers.length },
    { id: 'all', label: 'All Buyers', count: data.length },
  ];

  const columns = view === 'traders'
    ? [['company_name', 'Company'], ['classification', 'Class'], ['middleman_score', 'Score'], ['total_cif_usd', 'CIF $'], ['total_shipments', 'Shipments'], ['hs4_count', 'HS4s'], ['avg_china_pct', 'China%'], ['total_suppliers', 'Suppliers'], ['confidence', 'Confidence'], ['notable_signals', 'Signals']]
    : view === 'manufacturers'
    ? [['company_name', 'Company'], ['classification', 'Class'], ['middleman_score', 'Score'], ['total_cif_usd', 'CIF $'], ['total_shipments', 'Shipments'], ['hs4_codes', 'HS4 Codes'], ['avg_china_pct', 'China%'], ['total_suppliers', 'Suppliers'], ['notes', 'Notes']]
    : [['company_name', 'Company'], ['classification', 'Class'], ['middleman_score', 'Score'], ['total_cif_usd', 'CIF $'], ['total_shipments', 'Shipments'], ['hs4_count', 'HS4s'], ['avg_china_pct', 'China%'], ['total_suppliers', 'Suppliers'], ['confidence', 'Confidence']];

  return (
    <div style={{ padding: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, borderTop: `3px solid ${k.color}` }}>
            <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={card}>
          <h3 style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 12 }}>Classification Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((_, i) => <Cell key={i} fill={Object.values(CLASS_COLORS)[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 12 }}>CIF Value by Classification</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cifBarData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `$${(v / 1e9).toFixed(1)}B`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#e2e8f0' }} formatter={v => [`$${fmt(v)}`, 'CIF']} />
              <Bar dataKey="cif">
                {cifBarData.map((_, i) => <Cell key={i} fill={Object.values(CLASS_COLORS)[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Confirmed Traders Highlight */}
      {view === 'traders' && traders.length > 0 && (
        <div style={{ ...card, marginBottom: 16, borderLeft: '4px solid #f87171' }}>
          <h3 style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>Confirmed Traders ({traders.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {traders.sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0)).map(t => (
              <div key={t.company_name} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: 12 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company_name}</div>
                <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700 }}>${fmt(t.total_cif_usd || 0)}</div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Score: {t.middleman_score} | {t.total_shipments} shipments | {t.hs4_count} HS4s</div>
                <div style={{ color: '#fbbf24', fontSize: 10, marginTop: 4 }}>{t.notable_signals}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Contract Manufacturers Highlight */}
      {view === 'manufacturers' && contractMfrs.length > 0 && (
        <div style={{ ...card, marginBottom: 16, borderLeft: '4px solid #60a5fa' }}>
          <h3 style={{ color: '#60a5fa', fontSize: 14, marginBottom: 12 }}>Contract Manufacturers — Buying Through Middlemen ({contractMfrs.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {contractMfrs.sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0)).slice(0, 12).map(m => (
              <div key={m.company_name} style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: 12 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.company_name}</div>
                <div style={{ color: '#60a5fa', fontSize: 18, fontWeight: 700 }}>${fmt(m.total_cif_usd || 0)}</div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{m.total_shipments} shipments | China: {m.avg_china_pct?.toFixed(0)}% | {m.total_suppliers} suppliers</div>
                <div style={{ color: '#34d399', fontSize: 10, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HS4: {m.hs4_codes}</div>
                {m.notes && <div style={{ color: '#a78bfa', fontSize: 10, marginTop: 2 }}>{m.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {viewBtns.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: view === v.id ? 'rgba(96,165,250,0.2)' : 'rgba(17,24,39,0.6)',
            color: view === v.id ? '#60a5fa' : '#94a3b8',
            border: `1px solid ${view === v.id ? 'rgba(96,165,250,0.4)' : 'rgba(148,163,184,0.1)'}`,
          }}>
            {v.label} ({v.count})
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div style={card}>
        <SearchFilter
          data={viewData}
          onFilter={setFiltered}
          searchFields={['company_name', 'hs4_codes', 'cities', 'notable_signals', 'notes']}
          filters={[
            { key: 'classification', label: 'Classification' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'trading_model', label: 'Trading Model' },
          ]}
          placeholder={`Search ${viewData.length} classified buyers...`}
        />
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)} style={thStyle}>
                    {label}{sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 300).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                  {columns.map(([col]) => {
                    if (col === 'company_name') return (
                      <td key={col} style={{ padding: '6px 10px', color: '#e2e8f0', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[col]}</td>
                    );
                    if (col === 'classification') return (
                      <td key={col} style={{ padding: '6px 10px' }}><span style={badge(r[col])}>{r[col]?.replace('_', ' ')}</span></td>
                    );
                    if (col === 'total_cif_usd') return (
                      <td key={col} style={{ padding: '6px 10px', color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' }}>${fmt(r[col] || 0)}</td>
                    );
                    if (col === 'middleman_score') return (
                      <td key={col} style={{ padding: '6px 10px', color: r[col] >= 70 ? '#f87171' : r[col] >= 40 ? '#fbbf24' : '#34d399', fontSize: 12, fontWeight: 700 }}>{r[col]}</td>
                    );
                    if (col === 'avg_china_pct') return (
                      <td key={col} style={{ padding: '6px 10px', color: r[col] > 80 ? '#f87171' : '#94a3b8', fontSize: 11 }}>{r[col] != null ? `${Number(r[col]).toFixed(0)}%` : '-'}</td>
                    );
                    if (col === 'notable_signals' || col === 'notes' || col === 'hs4_codes') return (
                      <td key={col} style={{ padding: '6px 10px', color: '#94a3b8', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[col] || '-'}</td>
                    );
                    if (col === 'confidence') return (
                      <td key={col} style={{ padding: '6px 10px', color: r[col] === 'HIGH' ? '#34d399' : r[col] === 'MEDIUM' ? '#fbbf24' : '#94a3b8', fontSize: 11 }}>{r[col] || '-'}</td>
                    );
                    return (
                      <td key={col} style={{ padding: '6px 10px', color: '#94a3b8', fontSize: 12 }}>{r[col] ?? '-'}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

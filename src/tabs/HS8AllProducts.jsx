import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const fmt = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtUSD = v => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtINR = v => v == null ? '—' : '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtPct = v => v == null ? '—' : Number(v).toFixed(1) + '%';
const verdictColor = v => ({ EXCELLENT: '#34d399', GOOD: '#60a5fa', MODERATE: '#fbbf24', THIN: '#a78bfa', NEGATIVE: '#f87171', NO_DATA: '#64748b' }[v] || '#94a3b8');
const tierBadge = t => {
  const c = { TIER_1_PREMIUM: '#34d399', TIER_2_HIGH: '#60a5fa', TIER_3_SOLID: '#fbbf24' }[t];
  return t ? <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{t?.replace('TIER_1_','').replace('TIER_2_','').replace('TIER_3_','')}</span> : '—';
};

export default function HS8AllProducts() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hs4Filter, setHs4Filter] = useState('All');
  const [sortCol, setSortCol] = useState('total_cif_usd');
  const [sortDir, setSortDir] = useState('desc');
  const [view, setView] = useState('margins'); // margins | prices | overview

  useEffect(() => {
    supabase.from('hs8_margin_analysis').select('*').then(({ data: d }) => {
      setData(d || []);
      setLoading(false);
    });
  }, []);

  const hs4Options = useMemo(() => ['All', ...new Set(data.map(r => r.hs4).filter(Boolean).sort())], [data]);
  const filtered = useMemo(() => {
    let f = data;
    if (search) {
      const s = search.toLowerCase();
      f = f.filter(r => r.hs8?.toLowerCase().includes(s) || r.hs4?.toLowerCase().includes(s) || r.commodity?.toLowerCase().includes(s));
    }
    if (verdictFilter !== 'All') f = f.filter(r => r.margin_verdict === verdictFilter);
    if (statusFilter !== 'All') f = f.filter(r => r.selling_price_research_status === statusFilter);
    if (hs4Filter !== 'All') f = f.filter(r => r.hs4 === hs4Filter);
    f.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, verdictFilter, statusFilter, hs4Filter, sortCol, sortDir]);

  const stats = useMemo(() => {
    const withMargin = data.filter(r => r.real_margin_pct != null);
    return {
      total: data.length,
      researched: data.filter(r => r.selling_price_research_status === 'completed').length,
      noData: data.filter(r => r.selling_price_research_status === 'no_data').length,
      excellent: data.filter(r => r.margin_verdict === 'EXCELLENT').length,
      good: data.filter(r => r.margin_verdict === 'GOOD').length,
      moderate: data.filter(r => r.margin_verdict === 'MODERATE').length,
      negative: data.filter(r => r.margin_verdict === 'NEGATIVE' || r.margin_verdict === 'THIN').length,
      avgMargin: withMargin.length ? (withMargin.reduce((s, r) => s + r.real_margin_pct, 0) / withMargin.length).toFixed(1) : '—',
    };
  }, [data]);

  const doSort = col => { setSortDir(sortCol === col && sortDir === 'desc' ? 'asc' : 'desc'); setSortCol(col); };
  const Th = ({ col, children, w }) => (
    <th style={{ padding: '8px 6px', cursor: 'pointer', whiteSpace: 'nowrap', width: w, fontSize: 12, borderBottom: '1px solid rgba(148,163,184,0.15)' }} onClick={() => doSort(col)}>
      {children} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading 706 HS8 products...</div>;

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#e2e8f0' }}>📋 All HS8 Products</h2>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Complete margin research data for manual verification</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['overview', 'margins', 'prices'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: view === v ? '#4f8cff' : 'rgba(148,163,184,0.1)', color: view === v ? '#fff' : '#94a3b8'
            }}>{v === 'overview' ? '📊 Overview' : v === 'margins' ? '💰 Margins' : '🏷️ All Prices'}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total HS8', value: stats.total, color: '#60a5fa' },
          { label: 'Researched', value: stats.researched, color: '#34d399' },
          { label: 'No Data', value: stats.noData, color: '#64748b' },
          { label: 'Avg Margin', value: stats.avgMargin + '%', color: '#fbbf24' },
          { label: 'EXCELLENT', value: stats.excellent, color: '#34d399' },
          { label: 'GOOD', value: stats.good, color: '#60a5fa' },
          { label: 'MODERATE', value: stats.moderate, color: '#fbbf24' },
          { label: 'NEG/THIN', value: stats.negative, color: '#f87171' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'rgba(17,24,39,0.6)', borderRadius: 8, padding: '12px 14px', border: `1px solid ${k.color}33` }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search HS8, HS4, or product..." style={{
          padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(17,24,39,0.5)', color: '#e2e8f0', width: 260, fontSize: 13
        }} />
        <select value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(17,24,39,0.5)', color: '#e2e8f0', fontSize: 13 }}>
          <option value="All">All Verdicts</option>
          {['EXCELLENT', 'GOOD', 'MODERATE', 'THIN', 'NEGATIVE', 'NO_DATA'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(17,24,39,0.5)', color: '#e2e8f0', fontSize: 13 }}>
          <option value="All">All Status</option>
          {['completed', 'no_data', 'pending', 'failed'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={hs4Filter} onChange={e => setHs4Filter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(17,24,39,0.5)', color: '#e2e8f0', fontSize: 13, maxWidth: 200 }}>
          {hs4Options.map(v => <option key={v} value={v}>{v === 'All' ? 'All HS4 Categories' : v}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 13 }}>{filtered.length} of {data.length} products</div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'rgba(17,24,39,0.8)', color: '#94a3b8', textAlign: 'left' }}>
              <Th col="hs8">HS8</Th>
              <Th col="hs4">HS4</Th>
              <Th col="commodity">Product</Th>
              {view === 'overview' && <>
                <Th col="real_margin_pct">Margin%</Th>
                <Th col="margin_verdict">Verdict</Th>
                <Th col="median_landed_cost_inr">Landed ₹</Th>
                <Th col="price_consensus_inr">Sell ₹</Th>
                <Th col="real_margin_inr">Margin ₹</Th>
                <Th col="total_cif_usd">CIF ($)</Th>
                <Th col="shipment_count">Ships</Th>
                <Th col="unique_buyers">Buyers</Th>
                <Th col="dominant_unit">Unit</Th>
                <Th col="shortlist_tier">Tier</Th>
                <Th col="source_count">Srcs</Th>
                <Th col="price_confidence">Conf</Th>
              </>}
              {view === 'margins' && <>
                <Th col="median_unit_rate_usd">Med Rate $</Th>
                <Th col="total_duty_pct">Duty%</Th>
                <Th col="median_landed_cost_inr">Landed ₹</Th>
                <Th col="price_consensus_inr">Consensus ₹</Th>
                <Th col="real_margin_pct">Margin%</Th>
                <Th col="real_margin_inr">Margin ₹</Th>
                <Th col="margin_verdict">Verdict</Th>
                <Th col="total_cif_usd">CIF ($)</Th>
                <Th col="unique_buyers">Buyers</Th>
                <Th col="dominant_unit">Unit</Th>
                <Th col="unit_matched">Match</Th>
                <Th col="shortlisted">Listed</Th>
              </>}
              {view === 'prices' && <>
                <Th col="median_landed_cost_inr">Landed ₹</Th>
                <Th col="indiamart_sell_price_inr">IndiaMART ₹</Th>
                <Th col="tradeindia_sell_price_inr">TradeIndia ₹</Th>
                <Th col="amazon_sell_price_inr">Amazon ₹</Th>
                <Th col="moglix_sell_price_inr">Moglix ₹</Th>
                <Th col="industbuy_sell_price_inr">IndBuy ₹</Th>
                <Th col="price_consensus_inr">Consensus ₹</Th>
                <Th col="real_margin_pct">Margin%</Th>
                <Th col="margin_verdict">Verdict</Th>
                <Th col="source_count">Srcs</Th>
                <Th col="price_confidence">Conf</Th>
                <Th col="selling_price_research_status">Status</Th>
              </>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.hs8} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(17,24,39,0.3)' }}>
                <td style={{ padding: '7px 6px', fontWeight: 600, color: '#60a5fa', fontFamily: 'monospace' }}>{r.hs8}</td>
                <td style={{ padding: '7px 6px', color: '#94a3b8', fontFamily: 'monospace' }}>{r.hs4}</td>
                <td style={{ padding: '7px 6px', color: '#e2e8f0', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                {view === 'overview' && <>
                  <td style={{ padding: '7px 6px', color: verdictColor(r.margin_verdict), fontWeight: 700 }}>{fmtPct(r.real_margin_pct)}</td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: verdictColor(r.margin_verdict), background: `${verdictColor(r.margin_verdict)}22`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{r.margin_verdict || '—'}</span></td>
                  <td style={{ padding: '7px 6px', color: '#e2e8f0' }}>{fmtINR(r.median_landed_cost_inr)}</td>
                  <td style={{ padding: '7px 6px', color: '#34d399' }}>{fmtINR(r.price_consensus_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.real_margin_inr > 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{fmtINR(r.real_margin_inr)}</td>
                  <td style={{ padding: '7px 6px', color: '#fbbf24' }}>{fmtUSD(r.total_cif_usd)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8' }}>{fmt(r.shipment_count)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8' }}>{fmt(r.unique_buyers)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8', fontSize: 11 }}>{r.dominant_unit || '—'}</td>
                  <td style={{ padding: '7px 6px' }}>{tierBadge(r.shortlist_tier)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8' }}>{r.source_count || '—'}</td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: r.price_confidence === 'HIGH' ? '#34d399' : r.price_confidence === 'MEDIUM' ? '#fbbf24' : '#f87171', fontSize: 11 }}>{r.price_confidence || '—'}</span></td>
                </>}
                {view === 'margins' && <>
                  <td style={{ padding: '7px 6px', color: '#60a5fa' }}>{r.median_unit_rate_usd != null ? '$' + Number(r.median_unit_rate_usd).toFixed(2) : '—'}</td>
                  <td style={{ padding: '7px 6px', color: '#fbbf24' }}>{fmtPct(r.total_duty_pct)}</td>
                  <td style={{ padding: '7px 6px', color: '#e2e8f0' }}>{fmtINR(r.median_landed_cost_inr)}</td>
                  <td style={{ padding: '7px 6px', color: '#34d399' }}>{fmtINR(r.price_consensus_inr)}</td>
                  <td style={{ padding: '7px 6px', color: verdictColor(r.margin_verdict), fontWeight: 700 }}>{fmtPct(r.real_margin_pct)}</td>
                  <td style={{ padding: '7px 6px', color: r.real_margin_inr > 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{fmtINR(r.real_margin_inr)}</td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: verdictColor(r.margin_verdict), fontSize: 11, fontWeight: 600 }}>{r.margin_verdict || '—'}</span></td>
                  <td style={{ padding: '7px 6px', color: '#fbbf24' }}>{fmtUSD(r.total_cif_usd)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8' }}>{fmt(r.unique_buyers)}</td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8', fontSize: 11 }}>{r.dominant_unit || '—'}</td>
                  <td style={{ padding: '7px 6px' }}>{r.unit_matched ? '✅' : r.unit_matched === false ? '❌' : '—'}</td>
                  <td style={{ padding: '7px 6px' }}>{r.shortlisted ? '🏆' : '—'}</td>
                </>}
                {view === 'prices' && <>
                  <td style={{ padding: '7px 6px', color: '#e2e8f0' }}>{fmtINR(r.median_landed_cost_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.indiamart_sell_price_inr ? '#34d399' : '#64748b' }}>{fmtINR(r.indiamart_sell_price_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.tradeindia_sell_price_inr ? '#60a5fa' : '#64748b' }}>{fmtINR(r.tradeindia_sell_price_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.amazon_sell_price_inr ? '#fbbf24' : '#64748b' }}>{fmtINR(r.amazon_sell_price_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.moglix_sell_price_inr ? '#a78bfa' : '#64748b' }}>{fmtINR(r.moglix_sell_price_inr)}</td>
                  <td style={{ padding: '7px 6px', color: r.industbuy_sell_price_inr ? '#fb923c' : '#64748b' }}>{fmtINR(r.industbuy_sell_price_inr)}</td>
                  <td style={{ padding: '7px 6px', color: '#34d399', fontWeight: 600 }}>{fmtINR(r.price_consensus_inr)}</td>
                  <td style={{ padding: '7px 6px', color: verdictColor(r.margin_verdict), fontWeight: 700 }}>{fmtPct(r.real_margin_pct)}</td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: verdictColor(r.margin_verdict), fontSize: 11 }}>{r.margin_verdict || '—'}</span></td>
                  <td style={{ padding: '7px 6px', color: '#94a3b8' }}>{r.source_count || '—'}</td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: r.price_confidence === 'HIGH' ? '#34d399' : r.price_confidence === 'MEDIUM' ? '#fbbf24' : '#f87171', fontSize: 11 }}>{r.price_confidence || '—'}</span></td>
                  <td style={{ padding: '7px 6px' }}><span style={{ color: r.selling_price_research_status === 'completed' ? '#34d399' : '#64748b', fontSize: 11 }}>{r.selling_price_research_status || '—'}</span></td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import SearchFilter from '../components/SearchFilter';

const fmt = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtUSD = v => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtINR = v => v == null ? '—' : '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtPct = v => v == null ? '—' : Number(v).toFixed(1) + '%';
const dispColor = v => ({ LOW: '#34d399', MODERATE: '#fbbf24', HIGH: '#f87171' }[v] || '#94a3b8');

export default function HS8VolzaDetail() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sfFiltered, setSfFiltered] = useState([]);
  const [dispFilter, setDispFilter] = useState('ALL');
  const [qualFilter, setQualFilter] = useState('ALL');
  const [sortCol, setSortCol] = useState('total_cif_usd');
  const [sortDir, setSortDir] = useState('desc');
  const [view, setView] = useState('rates');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    supabase.from('hs8_margin_analysis').select('*').then(({ data: d }) => {
      setData(d || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let f = [...sfFiltered];
    if (dispFilter !== 'ALL') f = f.filter(r => r.rate_dispersion === dispFilter);
    if (qualFilter !== 'ALL') f = f.filter(r => r.rate_data_quality === qualFilter);
    f.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [sfFiltered, dispFilter, qualFilter, sortCol, sortDir]);

  const stats = useMemo(() => {
    const withData = data.filter(r => r.median_unit_rate_usd != null);
    const withDuty = data.filter(r => r.total_duty_pct != null);
    const totalCIF = data.reduce((s, r) => s + (r.total_cif_usd || 0), 0);
    const totalShip = data.reduce((s, r) => s + (r.shipment_count || 0), 0);
    const dispCounts = { LOW: 0, MODERATE: 0, HIGH: 0 };
    data.forEach(r => { if (r.rate_dispersion && dispCounts[r.rate_dispersion] !== undefined) dispCounts[r.rate_dispersion]++; });
    return { total: data.length, withData: withData.length, withDuty: withDuty.length, totalCIF, totalShip, dispCounts };
  }, [data]);

  const doSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const sortIcon = col => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: 40 }}>Loading Volza HS8 detail data...</div>;

  const renderUnitSegments = (row) => {
    if (!row.unit_segments) return <span style={{ color: '#64748b' }}>No segment data</span>;
    let segs;
    try { segs = typeof row.unit_segments === 'string' ? JSON.parse(row.unit_segments) : row.unit_segments; } catch { return <span style={{ color: '#64748b' }}>Parse error</span>; }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(segs).map(([unit, s]) => (
          <div key={unit} style={{ background: 'rgba(79,140,255,0.1)', border: '1px solid rgba(79,140,255,0.2)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: 2 }}>{unit}</div>
            <div style={{ color: '#e2e8f0' }}>Count: {s.count || '—'} | Median: {fmtUSD(s.median)} | P25: {fmtUSD(s.p25)} | P75: {fmtUSD(s.p75)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total HS8 Codes', value: fmt(stats.total), cls: 'hl' },
          { label: 'With Volza Data', value: fmt(stats.withData), cls: 'gn' },
          { label: 'With Duty Data', value: fmt(stats.withDuty), cls: 'hl' },
          { label: 'Total CIF', value: '$' + (stats.totalCIF / 1e6).toFixed(1) + 'M', cls: 'yw' },
          { label: 'Total Shipments', value: fmt(stats.totalShip), cls: 'hl' },
          { label: 'Low Dispersion', value: fmt(stats.dispCounts.LOW), cls: 'gn' },
          { label: 'Moderate Disp.', value: fmt(stats.dispCounts.MODERATE), cls: 'yw' },
          { label: 'High Dispersion', value: fmt(stats.dispCounts.HIGH), cls: 'rd' },
        ].map(k => (
          <div key={k.label} className={`kpi ${k.cls}`}><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.value}</div></div>
        ))}
      </div>

      {/* Search & HS4 Filter */}
      <SearchFilter data={data} onFilter={setSfFiltered} searchFields={['hs8','hs4','commodity']} filters={[{key:'hs4',label:'HS4'}]} placeholder="Search HS8, HS4, commodity..." />

      {/* Specialized Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={dispFilter} onChange={e => setDispFilter(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--tx1)', fontSize: 13 }}>
          <option value="ALL">All Dispersion</option>
          <option value="LOW">LOW</option>
          <option value="MODERATE">MODERATE</option>
          <option value="HIGH">HIGH</option>
        </select>
        <select value={qualFilter} onChange={e => setQualFilter(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--tx1)', fontSize: 13 }}>
          <option value="ALL">All Quality</option>
          <option value="GOOD">GOOD</option>
          <option value="FAIR">FAIR</option>
          <option value="POOR">POOR</option>
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['rates', 'Unit Rates'], ['costs', 'Landed Costs'], ['buyers', 'Buyers & Shippers']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? 'rgba(79,140,255,0.3)' : 'rgba(148,163,184,0.1)', color: view === v ? '#60a5fa' : '#94a3b8' }}>{l}</button>
          ))}
        </div>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{filtered.length} of {data.length} codes</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            {view === 'rates' && (
              <tr>
                {[['hs8','HS8'],['commodity','Product'],['shipment_count','Ship.'],['filtered_shipment_count','Filtered'],
                  ['median_unit_rate_usd','Median Rate'],['p25_unit_rate_usd','P25'],['p75_unit_rate_usd','P75'],
                  ['avg_unit_rate_usd','Avg Rate'],['min_unit_rate_usd','Min'],['max_unit_rate_usd','Max'],
                  ['iqr_ratio','IQR Ratio'],['rate_dispersion','Dispersion'],['dominant_unit','Unit'],['captive_pct','Captive%'],['rate_data_quality','Quality']
                ].map(([c,l]) => (
                  <th key={c} onClick={() => doSort(c)} style={{ padding: '10px 8px', textAlign: c === 'commodity' ? 'left' : 'right', cursor: 'pointer', color: '#94a3b8', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>{l}{sortIcon(c)}</th>
                ))}
              </tr>
            )}
            {view === 'costs' && (
              <tr>
                {[['hs8','HS8'],['commodity','Product'],['median_unit_rate_usd','Median Rate $'],['total_duty_pct','Total Duty%'],['bcd_pct','BCD%'],['igst_pct','IGST%'],
                  ['median_landed_cost_inr','Median Landed INR'],['volza_landed_cost_inr','Avg Landed INR'],['volza_cost_per_unit_inr','Cost/Unit INR'],
                  ['cif_per_unit_usd','CIF/Unit $'],['exchange_rate','FX Rate'],['total_cif_usd','Total CIF $'],
                  ['regulatory_risk','Reg. Risk'],['bis_required','BIS'],['add_applicable','ADD']
                ].map(([c,l]) => (
                  <th key={c} onClick={() => doSort(c)} style={{ padding: '10px 8px', textAlign: c === 'commodity' ? 'left' : 'right', cursor: 'pointer', color: '#94a3b8', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>{l}{sortIcon(c)}</th>
                ))}
              </tr>
            )}
            {view === 'buyers' && (
              <tr>
                {[['hs8','HS8'],['commodity','Product'],['unique_buyers','Buyers'],['unique_shippers','Shippers'],
                  ['china_pct','China%'],['total_cif_usd','Total CIF $'],['shipment_count','Shipments'],
                  ['median_unit_rate_usd','Median Rate $'],['dominant_unit','Unit'],
                  ['rate_dispersion','Dispersion'],['captive_pct','Captive%']
                ].map(([c,l]) => (
                  <th key={c} onClick={() => doSort(c)} style={{ padding: '10px 8px', textAlign: c === 'commodity' ? 'left' : 'right', cursor: 'pointer', color: '#94a3b8', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>{l}{sortIcon(c)}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(r => (
              <>
                <tr key={r.hs8} onClick={() => setExpanded(expanded === r.hs8 ? null : r.hs8)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {view === 'rates' && <>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 600 }}>{r.hs8}</td>
                    <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(r.shipment_count)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(r.filtered_shipment_count)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: 600 }}>{fmtUSD(r.median_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmtUSD(r.p25_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmtUSD(r.p75_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24' }}>{fmtUSD(r.avg_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{fmtUSD(r.min_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{fmtUSD(r.max_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{r.iqr_ratio != null ? Number(r.iqr_ratio).toFixed(1) + 'x' : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}><span style={{ color: dispColor(r.rate_dispersion), background: `${dispColor(r.rate_dispersion)}22`, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{r.rate_dispersion || '—'}</span></td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.dominant_unit || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtPct(r.captive_pct)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}><span style={{ color: r.rate_data_quality === 'GOOD' ? '#34d399' : r.rate_data_quality === 'FAIR' ? '#fbbf24' : '#f87171', fontSize: 11 }}>{r.rate_data_quality || '—'}</span></td>
                  </>}
                  {view === 'costs' && <>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 600 }}>{r.hs8}</td>
                    <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: 600 }}>{fmtUSD(r.median_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>{fmtPct(r.total_duty_pct)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtPct(r.bcd_pct)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtPct(r.igst_pct)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmtINR(r.median_landed_cost_inr)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24' }}>{fmtINR(r.volza_landed_cost_inr)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtINR(r.volza_cost_per_unit_inr)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtUSD(r.cif_per_unit_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.exchange_rate || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{r.total_cif_usd ? '$' + (r.total_cif_usd / 1e6).toFixed(2) + 'M' : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}><span style={{ color: r.regulatory_risk === 'LOW' ? '#34d399' : r.regulatory_risk === 'MEDIUM' ? '#fbbf24' : '#f87171', fontSize: 11 }}>{r.regulatory_risk || '—'}</span></td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{r.bis_required ? '✓' : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{r.add_applicable ? '⚠' : '—'}</td>
                  </>}
                  {view === 'buyers' && <>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 600 }}>{r.hs8}</td>
                    <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: 600 }}>{fmt(r.unique_buyers)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#60a5fa' }}>{fmt(r.unique_shippers)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#fbbf24' }}>{fmtPct(r.china_pct)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{r.total_cif_usd ? '$' + (r.total_cif_usd / 1e6).toFixed(2) + 'M' : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(r.shipment_count)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#34d399' }}>{fmtUSD(r.median_unit_rate_usd)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.dominant_unit || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}><span style={{ color: dispColor(r.rate_dispersion), fontSize: 11 }}>{r.rate_dispersion || '—'}</span></td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtPct(r.captive_pct)}</td>
                  </>}
                </tr>
                {expanded === r.hs8 && (
                  <tr key={r.hs8 + '-exp'}>
                    <td colSpan={view === 'rates' ? 15 : view === 'costs' ? 15 : 11} style={{ padding: '12px 16px', background: 'rgba(79,140,255,0.03)', borderBottom: '2px solid rgba(79,140,255,0.15)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        <div>
                          <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Rate Percentiles</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12 }}>
                            <div><span style={{ color: '#94a3b8' }}>Min:</span> <span style={{ color: '#e2e8f0' }}>{fmtUSD(r.min_unit_rate_usd)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>P25:</span> <span style={{ color: '#e2e8f0' }}>{fmtUSD(r.p25_unit_rate_usd)}</span></div>
                            <div><span style={{ color: '#34d399', fontWeight: 600 }}>Median:</span> <span style={{ color: '#34d399', fontWeight: 600 }}>{fmtUSD(r.median_unit_rate_usd)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>P75:</span> <span style={{ color: '#e2e8f0' }}>{fmtUSD(r.p75_unit_rate_usd)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Max:</span> <span style={{ color: '#e2e8f0' }}>{fmtUSD(r.max_unit_rate_usd)}</span></div>
                            <div><span style={{ color: '#fbbf24' }}>Avg:</span> <span style={{ color: '#fbbf24' }}>{fmtUSD(r.avg_unit_rate_usd)}</span></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Duty & Landed Cost</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                            <div><span style={{ color: '#94a3b8' }}>BCD:</span> <span style={{ color: '#e2e8f0' }}>{fmtPct(r.bcd_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>IGST:</span> <span style={{ color: '#e2e8f0' }}>{fmtPct(r.igst_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Total Duty:</span> <span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmtPct(r.total_duty_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Avg Duty:</span> <span style={{ color: '#e2e8f0' }}>{fmtPct(r.avg_duty_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Median Landed:</span> <span style={{ color: '#60a5fa', fontWeight: 600 }}>{fmtINR(r.median_landed_cost_inr)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Avg Landed:</span> <span style={{ color: '#e2e8f0' }}>{fmtINR(r.volza_landed_cost_inr)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>FX Rate:</span> <span style={{ color: '#e2e8f0' }}>{r.exchange_rate || '—'}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Compliance:</span> <span style={{ color: '#e2e8f0' }}>{r.compliance_cost_inr ? fmtINR(r.compliance_cost_inr) : '—'}</span></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Market Data</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                            <div><span style={{ color: '#94a3b8' }}>Buyers:</span> <span style={{ color: '#34d399' }}>{fmt(r.unique_buyers)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Shippers:</span> <span style={{ color: '#e2e8f0' }}>{fmt(r.unique_shippers)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>China%:</span> <span style={{ color: '#fbbf24' }}>{fmtPct(r.china_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Captive%:</span> <span style={{ color: '#e2e8f0' }}>{fmtPct(r.captive_pct)}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>Total CIF:</span> <span style={{ color: '#e2e8f0' }}>{r.total_cif_usd ? '$' + (r.total_cif_usd / 1e6).toFixed(2) + 'M' : '—'}</span></div>
                            <div><span style={{ color: '#94a3b8' }}>IQR Ratio:</span> <span style={{ color: '#e2e8f0' }}>{r.iqr_ratio ? Number(r.iqr_ratio).toFixed(1) + 'x' : '—'}</span></div>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Unit Segments</div>
                        {renderUnitSegments(r)}
                      </div>
                      {r.notes && <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>Notes: {r.notes}</div>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && <div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 12 }}>Showing 200 of {filtered.length} — use filters to narrow down</div>}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ckjnrebfbhshmihysmjf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

function clean(value) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function human(value) {
  return String(clean(value)).replaceAll('_', ' ');
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-';
  return 'INR ' + fmt.format(Number(value));
}

function usdMn(value) {
  if (value === null || value === undefined || value === '') return '-';
  return '$' + fmt1.format(Number(value)) + 'M';
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-';
  return fmt1.format(Number(value)) + '%';
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('pass') || text.includes('verified') || text.includes('fresh') || text.includes('keep') || text.includes('buyer_led')) return 'good';
  if (text.includes('required') || text.includes('watch') || text.includes('quote') || text.includes('proxy') || text.includes('open')) return 'watch';
  if (text.includes('reject') || text.includes('fail') || text.includes('mismatch') || text.includes('not_usable') || text.includes('not_passed')) return 'bad';
  return 'muted';
}

function useData() {
  const empty = { loading: true, error: '', buySell: [], inflow: [], audit: [], evidence: [], unit: [], spot: [], rejects: [], products: [] };
  const [state, setState] = useState(empty);

  async function load() {
    if (!supabase) {
      setState({ ...empty, loading: false, error: 'Supabase publishable key is missing in Vercel environment.' });
      return;
    }
    setState((old) => ({ ...old, loading: true, error: '' }));
    const [buySell, inflow, audit, evidence, unit, spot, rejects, products] = await Promise.all([
      supabase.from('component_dashboard_buy_sell_hs_codes').select('*').order('sorting_rank', { ascending: true }).limit(2000),
      supabase.from('component_researched_sku_inflow').select('*').order('researched_at', { ascending: false }).limit(500),
      supabase.from('component_hs8_research_audit').select('*').order('final_score', { ascending: false, nullsFirst: false }).limit(1000),
      supabase.from('component_research_evidence_refs').select('*').order('checked_at', { ascending: false }).limit(1000),
      supabase.from('component_unit_margin_audits').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_spot_buy_opportunities').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('component_rejection_register').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('component_dashboard_products').select('*').order('priority_rank', { ascending: true }).limit(500)
    ]);
    const error = buySell.error || inflow.error || audit.error || evidence.error || unit.error || spot.error || rejects.error || products.error;
    if (error) {
      setState({ ...empty, loading: false, error: error.message });
      return;
    }
    setState({
      loading: false,
      error: '',
      buySell: buySell.data || [],
      inflow: inflow.data || [],
      audit: audit.data || [],
      evidence: evidence.data || [],
      unit: unit.data || [],
      spot: spot.data || [],
      rejects: rejects.data || [],
      products: products.data || []
    });
  }

  useEffect(() => { load(); }, []);
  return { ...state, reload: load };
}

function Badge({ value }) {
  return <span className={'badge ' + tone(value)}>{human(value)}</span>;
}

function Metric({ label, value, color = '' }) {
  return <div className={'metric ' + color}><span>{label}</span><strong>{value}</strong></div>;
}

function FilterSelect({ value, onChange, options, allLabel }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="ALL">{allLabel}</option>{options.map((item) => <option key={item} value={item}>{human(item)}</option>)}</select>;
}

function Stack({ primary, secondary }) {
  return <div className="stack"><strong>{clean(primary)}</strong>{secondary ? <span>{clean(secondary)}</span> : null}</div>;
}

function BuySellMap({ rows, inflow }) {
  const [filters, setFilters] = useState({ search: '', category: 'ALL', priority: 'ALL', gate: 'ALL', risk: 'ALL', sort: 'rank' });
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category_pod).filter(Boolean))).sort(), [rows]);
  const priorities = useMemo(() => Array.from(new Set(rows.map((row) => row.research_priority).filter(Boolean))).sort(), [rows]);
  const gates = useMemo(() => Array.from(new Set(rows.map((row) => row.final_classification).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const out = rows.filter((row) => {
      if (filters.category !== 'ALL' && row.category_pod !== filters.category) return false;
      if (filters.priority !== 'ALL' && row.research_priority !== filters.priority) return false;
      if (filters.gate !== 'ALL' && row.final_classification !== filters.gate) return false;
      if (filters.risk === 'unit' && !String(row.unit_risk || '').toLowerCase().includes('risk')) return false;
      if (filters.risk === 'margin' && !String(row.margin_risk || '').toLowerCase().includes('required')) return false;
      if (filters.risk === 'researched' && !Number(row.researched_sku_count || 0)) return false;
      if (!q) return true;
      const haystack = [row.hs8, row.hs6, row.hs4, row.category_pod, row.category_label, row.buy_category, row.sell_category, row.typical_products, row.target_buyer_layer, row.target_supplier_layer, row.commodity, row.next_action, row.filter_tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    const copy = [...out];
    if (filters.sort === 'value') return copy.sort((a, b) => Number(b.val_2024_25 || 0) - Number(a.val_2024_25 || 0));
    if (filters.sort === 'buyers') return copy.sort((a, b) => Number(b.unique_buyers || 0) - Number(a.unique_buyers || 0));
    if (filters.sort === 'margin') return copy.sort((a, b) => Number(b.real_margin_pct || -999) - Number(a.real_margin_pct || -999));
    if (filters.sort === 'evidence') return copy.sort((a, b) => Number(b.researched_sku_count || 0) - Number(a.researched_sku_count || 0));
    return copy.sort((a, b) => Number(a.sorting_rank || 99999) - Number(b.sorting_rank || 99999));
  }, [rows, filters]);

  return <>
    <section className="filters wide">
      <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search HS8, category, what to buy, how to sell, buyer layer..." />
      <FilterSelect value={filters.category} onChange={(category) => setFilters({ ...filters, category })} options={categories} allLabel="All categories" />
      <FilterSelect value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} options={priorities} allLabel="All priority" />
      <FilterSelect value={filters.gate} onChange={(gate) => setFilters({ ...filters, gate })} options={gates} allLabel="All gates" />
      <select value={filters.risk} onChange={(event) => setFilters({ ...filters, risk: event.target.value })}>
        <option value="ALL">All risks</option><option value="unit">Unit risk</option><option value="margin">Margin open</option><option value="researched">Has SKU inflow</option>
      </select>
      <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
        <option value="rank">Plan rank</option><option value="value">Import value</option><option value="buyers">Buyers</option><option value="margin">Margin</option><option value="evidence">Evidence</option>
      </select>
      <button onClick={() => setFilters({ search: '', category: 'ALL', priority: 'ALL', gate: 'ALL', risk: 'ALL', sort: 'rank' })}>Reset</button>
    </section>
    <main className="split buy-sell-split">
      <section>
        <div className="section-title"><h2>HS Code Buy / Sell Map</h2><span>{fmt.format(filtered.length)} rows</span></div>
        <div className="table-wrap buy-sell-table"><table><thead><tr><th>HS</th><th>Category</th><th>What to buy</th><th>How to sell</th><th>Buyer layer</th><th>Supplier layer</th><th>Demand</th><th>Risk / gate</th><th>Next action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.hs8}><td><Stack primary={row.hs8} secondary={`${row.hs4} | ${row.research_priority || 'P3'}`} /></td><td><Stack primary={row.category_pod} secondary={row.category_label || row.commodity} /></td><td><Stack primary={row.buy_category} secondary={row.typical_products} /></td><td><Stack primary={row.sell_category} secondary={row.research_lane} /></td><td>{clean(row.target_buyer_layer)}</td><td>{clean(row.target_supplier_layer)}</td><td><Stack primary={`${fmt.format(Number(row.unique_buyers || 0))} buyers`} secondary={`${fmt.format(Number(row.shipment_count || 0))} shipments | ${usdMn(row.val_2024_25)}`} /></td><td><Badge value={row.final_classification || row.margin_risk} /><span>{human(row.unit_risk)} | {human(row.compliance_risk)}</span><span>{fmt.format(Number(row.researched_sku_count || 0))} researched SKU</span></td><td>{clean(row.next_action || row.latest_preliminary_verdict || 'Queue exact product research')}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="panel"><div className="panel-title"><span>Researched SKU Inflow</span><Badge value={`${inflow.length} rows`} /></div><h2>Latest Evidence Rows</h2><div className="mini-list">{inflow.slice(0, 16).map((row) => <span key={row.id}><strong>{row.product_or_sku}</strong>{row.hs8} | {human(row.preliminary_verdict)} | evidence: {human(row.evidence_status)} | margin: {human(row.margin_gate_status)}</span>)}</div></aside>
    </main>
  </>;
}

function AuditGates({ audit, evidence, unit, spot, rejects }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.filter((row) => !q || [row.hs8, row.hs4, row.commodity, row.evidence_quality_status, row.margin_gate_status, row.final_classification, row.notes].join(' ').toLowerCase().includes(q));
  }, [audit, query]);
  const selected = picked || rows[0];
  return <>
    <section className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search HS8, commodity, gate status..." /><span>{fmt.format(rows.length)} rows</span></section>
    <main className="split"><section><div className="section-title"><h2>Evidence-First Gate Register</h2><span>No winner without exact evidence, unit match, normalized margin, capital and buyer gates.</span></div><div className="table-wrap"><table><thead><tr><th>HS8</th><th>Commodity</th><th>Evidence</th><th>Unit</th><th>Margin</th><th>Capital</th><th>Buyer</th><th>Final</th><th>Score</th></tr></thead><tbody>{rows.map((row) => <tr key={row.hs8} className={selected?.hs8 === row.hs8 ? 'selected' : ''} onClick={() => setPicked(row)}><td><Stack primary={row.hs8} secondary={row.hs4} /></td><td><Stack primary={row.commodity} secondary={row.notes} /></td><td><Badge value={row.evidence_quality_status} /></td><td><Badge value={row.unit_gate_status} /></td><td><Badge value={row.margin_gate_status} /></td><td><Badge value={row.working_capital_status} /></td><td><Badge value={row.buyer_validation_status} /></td><td><Badge value={row.final_classification} /></td><td>{clean(row.final_score)}</td></tr>)}</tbody></table></div></section><GateDetail row={selected} evidence={evidence} unit={unit} spot={spot} rejects={rejects} /></main>
  </>;
}

function GateDetail({ row, evidence, unit, spot, rejects }) {
  if (!row) return <aside className="panel empty">Select a row.</aside>;
  const ev = evidence.filter((item) => item.hs8 === row.hs8).slice(0, 10);
  const un = unit.filter((item) => item.hs8 === row.hs8).slice(0, 5);
  const sp = spot.filter((item) => item.hs8 === row.hs8).slice(0, 5);
  const rj = rejects.filter((item) => item.hs8 === row.hs8).slice(0, 5);
  return <aside className="panel"><div className="panel-title"><span>Gate Detail</span><Badge value={row.final_classification} /></div><h2>{row.hs8}</h2><p>{row.commodity}</p><div className="gate-grid">{[['Evidence', row.evidence_quality_status], ['Unit', row.unit_gate_status], ['Margin', row.margin_gate_status], ['Capital', row.working_capital_status], ['Buyer', row.buyer_validation_status], ['Final', row.final_classification]].map(([label, value]) => <div className={'gate ' + tone(value)} key={label}><span>{label}</span><strong>{human(value || 'not started')}</strong></div>)}</div><div className="detail-grid"><div><span>Normalized margin</span><strong>{pct(row.normalized_margin_pct)}</strong></div><div><span>Test capital</span><strong>{money(row.first_test_capital_inr)}</strong></div><div><span>Blind cap</span><strong>{money(row.max_blind_test_budget_inr || 300000)}</strong></div><div><span>Inventory risk</span><strong>{human(row.inventory_risk)}</strong></div></div><section className="note"><strong>Score notes</strong><p>{row.final_score_notes || row.notes || 'No notes yet.'}</p></section><Mini title="Evidence refs" rows={ev.map((x) => `${x.source_name || x.evidence_phase} | ${human(x.evidence_quality)} | ${human(x.unit_basis)} | ${String(x.checked_at || '').slice(0, 10)}`)} /><Mini title="Unit audits" rows={un.map((x) => `${human(x.unit_match_status)} | ${human(x.audit_status)} | ${pct(x.normalized_margin_pct)} | ${human(x.audit_notes)}`)} /><Mini title="Spot / rejection" rows={[...sp.map((x) => `${x.product_or_sku || x.product_family} | ${human(x.spot_buy_fit || x.verdict)} | ${human(x.brand_risk)}`), ...rj.map((x) => `${x.product_or_sku || row.hs8} | ${human(x.rejection_phase)} | ${x.rejection_reason}`)]} /></aside>;
}

function Mini({ title, rows }) {
  return <section className="mini"><strong>{title}</strong>{rows.length ? rows.map((row, index) => <span key={index}>{row}</span>) : <span>No rows yet</span>}</section>;
}

function SimpleTable({ title, rows, type }) {
  return <section><div className="section-title"><h2>{title}</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr>{type === 'products' ? <><th>Rank</th><th>Product</th><th>SKU / spec</th><th>Proof</th><th>Margin</th><th>Landed</th><th>Verdict</th></> : <><th>SKU</th><th>HS8</th><th>Family</th><th>Evidence</th><th>Unit</th><th>Margin</th><th>Verdict</th></>}</tr></thead><tbody>{rows.map((row) => type === 'products' ? <tr key={row.id}><td>{clean(row.priority_rank)}</td><td><Stack primary={row.product_name} secondary={row.research_lane || row.product_family} /></td><td><Stack primary={row.exact_sku} secondary={row.product_spec} /></td><td><Badge value={row.proof_status} /></td><td>{pct(row.gross_margin_pct)}</td><td>{money(row.volza_landed_cost_inr || row.landed_cost_model_inr)}</td><td><Badge value={row.verdict} /></td></tr> : <tr key={row.id}><td><Stack primary={row.product_or_sku} secondary={row.brand} /></td><td>{row.hs8}</td><td>{row.product_family}</td><td><Badge value={row.evidence_status} /></td><td><Badge value={row.unit_gate_status} /></td><td><Badge value={row.margin_gate_status} /></td><td><Badge value={row.preliminary_verdict} /></td></tr>)}</tbody></table></div></section>;
}

function App() {
  const data = useData();
  const [tab, setTab] = useState('buySell');
  const usable = data.evidence.filter((row) => row.evidence_quality && row.evidence_quality !== 'not_usable').length;
  const p1 = data.buySell.filter((row) => row.research_priority === 'P1').length;
  const marginOpen = data.buySell.filter((row) => String(row.margin_risk || row.margin_gate_status || '').toLowerCase().includes('required') || String(row.margin_gate_status || '').toLowerCase().includes('not')).length;
  const importValue = data.buySell.reduce((sum, row) => sum + Number(row.val_2024_25 || 0), 0);

  if (data.loading) return <div className="boot">Loading live Supabase research workspace...</div>;

  return <div className="app"><header><div><h1>Naresh Exim Component Research</h1><p>Supabase-first HS code, evidence, unit, margin and buyer-gate dashboard.</p></div><button onClick={data.reload}>Refresh</button></header>{data.error ? <div className="error">{data.error}</div> : null}<section className="metrics"><Metric label="HS buy/sell codes" value={fmt.format(data.buySell.length)} color="blue" /><Metric label="P1 categories" value={fmt.format(p1)} color="green" /><Metric label="SKU inflow rows" value={fmt.format(data.inflow.length)} color="green" /><Metric label="Usable evidence refs" value={fmt.format(usable)} color="green" /><Metric label="Margin open" value={fmt.format(marginOpen)} color="amber" /><Metric label="Import value" value={usdMn(importValue)} color="blue" /></section><nav><button className={tab === 'buySell' ? 'active' : ''} onClick={() => setTab('buySell')}>HS Buy/Sell Map</button><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit Gates</button><button className={tab === 'inflow' ? 'active' : ''} onClick={() => setTab('inflow')}>Researched SKU Inflow</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Validated Products</button></nav>{tab === 'buySell' ? <BuySellMap rows={data.buySell} inflow={data.inflow} /> : null}{tab === 'audit' ? <AuditGates audit={data.audit} evidence={data.evidence} unit={data.unit} spot={data.spot} rejects={data.rejects} /> : null}{tab === 'inflow' ? <SimpleTable title="Researched SKU Inflow" rows={data.inflow} /> : null}{tab === 'products' ? <SimpleTable title="Validated Products" rows={data.products} type="products" /> : null}</div>;
}

createRoot(document.getElementById('root')).render(<App />);

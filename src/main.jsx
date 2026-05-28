import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ckjnrebfbhshmihysmjf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function human(value) {
  return String(clean(value)).replaceAll('_', ' ');
}

function listText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
  return clean(value);
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-';
  return 'INR ' + fmt.format(Number(value));
}

function usdMn(value) {
  if (value === null || value === undefined || value === '') return '-';
  return '$' + fmt1.format(Number(value)) + 'M';
}

function shortDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function rowText(row, keys) {
  return keys.map((key) => row?.[key] ?? '').join(' ').toLowerCase();
}

function scopeValues(row) {
  const values = [];
  if (row?.primary_hs4) values.push(String(row.primary_hs4));
  if (Array.isArray(row?.hs4_scope)) row.hs4_scope.filter(Boolean).forEach((hs4) => values.push(String(hs4)));
  if (!Array.isArray(row?.hs4_scope) && row?.hs4_scope) String(row.hs4_scope).split(',').map((hs4) => hs4.trim()).filter(Boolean).forEach((hs4) => values.push(hs4));
  return Array.from(new Set(values));
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('complete') || text.includes('verified') || text.includes('fresh') || text.includes('pass') || text.includes('ready') || text.includes('allowed') || text.includes('rankable')) return 'good';
  if (text.includes('progress') || text.includes('partial') || text.includes('open') || text.includes('blocked') || text.includes('stale') || text.includes('revisit') || text.includes('needs') || text.includes('pending')) return 'watch';
  if (text.includes('fail') || text.includes('reject') || text.includes('missing') || text.includes('not_usable') || text.includes('not usable') || text.includes('mismatch')) return 'bad';
  return 'muted';
}

const baseEmpty = {
  loading: true,
  error: '',
  phase1Counts: [],
  planTodos: [],
  nextActions: [],
  hs4Progress: [],
  hs8Backlog: [],
  phaseWaveLog: [],
  hsBuySell: [],
  relatedCategories: [],
  categoryPolicy: [],
  researchedInflow: [],
  priceStatus: [],
  supplierQueue: [],
  exactUnits: [],
  supplierAudit: [],
  demandAudit: [],
  workingCapital: [],
  complianceAudit: [],
  noVolza: [],
  finalGuardrails: [],
  finalShortlist: [],
  rejections: [],
  buyerClassifications: [],
  loadedTabs: {},
  loadingTabs: {},
  tabErrors: {}
};

function baseQueries() {
  return [
    ['phase1Counts', 'Phase 1 counts', supabase.from('component_dashboard_phase1_control_counts').select('*').order('metric', { ascending: true })],
    ['planTodos', 'Plan todos', supabase.from('component_plan_phase_wave_todos').select('*').order('phase_number', { ascending: true }).order('wave_number', { ascending: true, nullsFirst: true }).order('task_order', { ascending: true }).limit(250)],
    ['nextActions', 'Next actions', supabase.from('component_plan_next_actions').select('*').order('action_priority', { ascending: true }).order('phase_number', { ascending: true }).limit(150)],
    ['hs4Progress', 'Wave HS4 progress', supabase.from('component_wave_hs4_scope_progress').select('*').order('hs4', { ascending: true })],
    ['hs8Backlog', 'HS8 pricing backlog', supabase.from('component_hs8_pricing_backlog_dashboard').select('*').order('wave_number', { ascending: true }).order('research_priority', { ascending: true }).limit(800)],
    ['phaseWaveLog', 'Phase execution log', supabase.from('component_phase_wave_execution_log').select('*').order('id', { ascending: false }).limit(80)]
  ];
}

const tabQueries = {
  buySell: () => [
    ['hsBuySell', 'HS buy/sell map', supabase.from('component_dashboard_buy_sell_hs_codes').select('*').order('sorting_rank', { ascending: true }).limit(1200)]
  ],
  relatedCategories: () => [
    ['relatedCategories', 'Related SKU category dashboard', supabase.from('component_related_sku_category_dashboard').select('*').order('priority_score', { ascending: false }).order('hs8_count', { ascending: false }).limit(300)],
    ['categoryPolicy', 'Related SKU category policy', supabase.from('component_related_sku_category_policy').select('*').order('id', { ascending: true }).limit(50)]
  ],
  inflow: () => [
    ['researchedInflow', 'Researched SKU inflow', supabase.from('component_researched_sku_inflow').select('*').order('researched_at', { ascending: false }).limit(700)]
  ],
  prices: () => [
    ['priceStatus', 'Price research status', supabase.from('component_price_research_status').select('*').order('checked_at', { ascending: false }).limit(1200)]
  ],
  supplierQueue: () => [
    ['supplierQueue', 'Supplier landed quote queue', supabase.from('component_supplier_landed_quote_queue_dashboard').select('*').order('quote_priority', { ascending: true }).order('hs4', { ascending: true }).order('hs8', { ascending: true }).limit(1200)]
  ],
  units: () => [
    ['exactUnits', 'Exact unit recheck', supabase.from('component_wave1_exact_unit_recheck_dashboard').select('*').order('validation_id', { ascending: true }).limit(700)]
  ],
  suppliers: () => [
    ['supplierAudit', 'Supplier verification audit', supabase.from('component_supplier_verification_audit').select('*').order('checked_at', { ascending: false }).limit(700)]
  ],
  demand: () => [
    ['demandAudit', 'Demand verification', supabase.from('component_demand_verification_audit').select('*').order('checked_at', { ascending: false }).limit(700)]
  ],
  capital: () => [
    ['workingCapital', 'Working capital gate', supabase.from('component_working_capital_audit').select('*').order('checked_at', { ascending: false }).limit(700)]
  ],
  compliance: () => [
    ['complianceAudit', 'Compliance audit', supabase.from('component_compliance_audit').select('*').order('checked_at', { ascending: false }).limit(700)]
  ],
  noVolza: () => [
    ['noVolza', 'No-Volza revisit register', supabase.from('component_no_volza_revisit_register').select('*').order('checked_at', { ascending: false }).limit(700)]
  ],
  guardrails: () => [
    ['finalGuardrails', 'Final ranking guardrails', supabase.from('component_final_ranking_guardrail').select('*').order('guardrail_status', { ascending: true }).limit(700)]
  ],
  shortlist: () => [
    ['finalShortlist', 'Final shortlist candidates', supabase.from('component_final_shortlist_candidates').select('*').order('total_score', { ascending: false, nullsFirst: false }).limit(700)]
  ],
  rejections: () => [
    ['rejections', 'Rejection register', supabase.from('component_rejection_register').select('*').order('updated_at', { ascending: false }).limit(700)]
  ],
  classification: () => [
    ['buyerClassifications', 'Buyer classifications', (async () => {
      const all = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('buyer_classifications').select('*').order('middleman_score', { ascending: false }).range(from, from + pageSize - 1);
        if (error) return { data: all, error };
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return { data: all, error: null };
    })()]
  ]
};

async function fetchSet(entries) {
  const results = await Promise.all(entries.map(async ([key, label, query]) => {
    const { data, error } = await query;
    return { key, label, data: data || [], error };
  }));
  const next = {};
  const errors = [];
  results.forEach((result) => {
    next[result.key] = result.error ? [] : result.data;
    if (result.error) errors.push(`${result.label}: ${result.error.message}`);
  });
  return { next, errors };
}

function useData() {
  const [state, setState] = useState(baseEmpty);

  async function loadBase() {
    if (!supabase) {
      setState({ ...baseEmpty, loading: false, error: 'Supabase publishable key is missing in Vercel environment.' });
      return;
    }
    setState((old) => ({ ...old, loading: true, error: '' }));
    const { next, errors } = await fetchSet(baseQueries());
    setState((old) => ({ ...old, ...next, loading: false, error: errors.join(' | ') }));
  }

  async function loadTab(tab, force = false) {
    if (!supabase || !tabQueries[tab]) return;
    if (!force && state.loadedTabs[tab]) return;
    setState((old) => ({ ...old, loadingTabs: { ...old.loadingTabs, [tab]: true }, tabErrors: { ...old.tabErrors, [tab]: '' } }));
    const { next, errors } = await fetchSet(tabQueries[tab]());
    setState((old) => ({
      ...old,
      ...next,
      loadedTabs: { ...old.loadedTabs, [tab]: errors.length === 0 },
      loadingTabs: { ...old.loadingTabs, [tab]: false },
      tabErrors: { ...old.tabErrors, [tab]: errors.join(' | ') }
    }));
  }

  async function reload(tab) {
    await loadBase();
    if (tab && tabQueries[tab]) await loadTab(tab, true);
  }

  useEffect(() => {
    loadBase();
  }, []);

  return { ...state, reload, loadTab };
}

function Badge({ value }) {
  return <span className={'badge ' + tone(value)}>{human(value)}</span>;
}

function Metric({ label, value, color = '' }) {
  return <div className={'metric ' + color}><span>{label}</span><strong>{value}</strong></div>;
}

function Stack({ primary, secondary }) {
  return <div className="stack"><strong>{clean(primary)}</strong>{secondary ? <span>{clean(secondary)}</span> : null}</div>;
}

function Metrics({ data }) {
  const counts = Object.fromEntries(data.phase1Counts.map((row) => [row.metric, n(row.rows)]));
  const backlog = data.hs8Backlog || [];
  const needSku = backlog.filter((row) => row.dashboard_status === 'needs_representative_sku_selection').length;
  const priceGate = backlog.filter((row) => row.dashboard_status === 'has_sku_price_gate_pass_pending_supplier_landed_quote').length;
  const oneSource = backlog.filter((row) => row.dashboard_status === 'has_one_source_sku_second_source_required').length;
  const zeroSource = backlog.filter((row) => row.dashboard_status === 'has_sku_but_no_usable_b2b_exact_price').length;
  return <section className="metrics">
    <Metric label="HS8 pricing backlog" value={fmt.format(backlog.length)} color="blue" />
    <Metric label="Need SKU selection" value={fmt.format(needSku)} color="amber" />
    <Metric label="Price gate open" value={fmt.format(priceGate)} color="green" />
    <Metric label="One-source rows" value={fmt.format(oneSource)} color="amber" />
    <Metric label="Zero-source rows" value={fmt.format(zeroSource)} color="bad" />
    <Metric label="Fresh verified pricing" value={fmt.format(counts.fresh_verified_pricing || 0)} color="green" />
  </section>;
}

function LoadingOrError({ loading, error }) {
  if (loading) return <div className="boot">Loading selected Supabase view...</div>;
  if (error) return <div className="error">{error}</div>;
  return null;
}

function Control({ data }) {
  const openTodos = data.planTodos.filter((row) => !['completed', 'verified_complete'].includes(row.status));
  return <>
    <Metrics data={data} />
    <main className="split">
      <section>
        <div className="section-title"><h2>Phase And Wave Plan Control</h2><span>{fmt.format(data.planTodos.length)} rows</span></div>
        <div className="table-wrap"><table><thead><tr><th>Phase</th><th>Wave</th><th>Task</th><th>Status</th><th>Verify</th><th>Blocker</th><th>Next action</th></tr></thead><tbody>{data.planTodos.map((row) => <tr key={row.id}><td><Stack primary={`${row.phase_number}. ${row.phase_name}`} secondary={row.hs4_scope} /></td><td>{clean(row.wave_number)}</td><td>{clean(row.task_name)}</td><td><Badge value={row.status} /></td><td><Badge value={row.verification_status} /></td><td>{clean(row.blocker)}</td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="panel"><div className="panel-title"><span>Immediate Queue</span><Badge value={`${openTodos.length} open`} /></div><h2>Next Actions</h2><div className="mini-list">{data.nextActions.slice(0, 16).map((row) => <span key={`${row.phase_number}-${row.wave_number || 0}-${row.task_order}`}><strong>{row.phase_number}. {clean(row.task_name)}</strong>{clean(row.next_action)}</span>)}</div><div className="mini-list">{data.phaseWaveLog.slice(0, 5).map((row) => <span key={row.id}><strong>{clean(row.status)}</strong>{shortDate(row.created_at)} | {clean(row.notes)}</span>)}</div></aside>
    </main>
  </>;
}

function WaveProgress({ rows }) {
  return <section><div className="section-title"><h2>Wave HS4 Scope Progress</h2><span>{fmt.format(rows.length)} HS4 codes</span></div><div className="table-wrap"><table><thead><tr><th>HS4</th><th>HS8 scope</th><th>Researched SKUs</th><th>Unit checked</th><th>Margin usable</th><th>Buyer positive</th><th>Complete</th><th>Next action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.hs4}><td><strong>{row.hs4}</strong></td><td>{fmt.format(n(row.hs8_codes_in_scope))}</td><td>{fmt.format(n(row.researched_sku_rows))}</td><td>{fmt.format(n(row.exact_unit_rechecked_products))}</td><td>{fmt.format(n(row.margin_usable_products))}</td><td>{fmt.format(n(row.positive_buyer_products))}</td><td><Badge value={row.exact_price_research_complete ? 'complete' : 'incomplete'} /></td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div></section>;
}

function Hs8Backlog({ rows }) {
  const [filters, setFilters] = useState({ search: '', wave: 'ALL', hs4: 'ALL', status: 'ALL', sort: 'priority' });
  const waves = useMemo(() => Array.from(new Set(rows.map((row) => row.wave_number).filter((value) => value !== null && value !== undefined))).sort((a, b) => n(a) - n(b)), [rows]);
  const hs4s = useMemo(() => Array.from(new Set(rows.map((row) => row.hs4).filter(Boolean))).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.dashboard_status).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (filters.wave !== 'ALL' && String(row.wave_number) !== filters.wave) return false;
      if (filters.hs4 !== 'ALL' && String(row.hs4) !== filters.hs4) return false;
      if (filters.status !== 'ALL' && row.dashboard_status !== filters.status) return false;
      if (!q) return true;
      return rowText(row, ['hs8', 'hs4', 'commodity', 'pricing_wave', 'dashboard_status', 'current_blocker', 'next_action']).includes(q);
    });
    const copy = [...result];
    if (filters.sort === 'import') return copy.sort((a, b) => n(b.val_2024_25) - n(a.val_2024_25));
    if (filters.sort === 'buyers') return copy.sort((a, b) => n(b.unique_buyers) - n(a.unique_buyers));
    if (filters.sort === 'sources') return copy.sort((a, b) => n(b.max_usable_source_count) - n(a.max_usable_source_count) || n(b.usable_price_evidence_rows) - n(a.usable_price_evidence_rows));
    if (filters.sort === 'blocked') return copy.sort((a, b) => n(b.rejection_rows) - n(a.rejection_rows) || n(b.zero_source_sku_rows) - n(a.zero_source_sku_rows));
    return copy.sort((a, b) => n(a.wave_number) - n(b.wave_number) || n(a.research_priority) - n(b.research_priority));
  }, [rows, filters]);
  return <>
    <section className="filters wide">
      <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search HS8, HS4, product, blocker, action..." />
      <select value={filters.wave} onChange={(event) => setFilters({ ...filters, wave: event.target.value })}><option value="ALL">All waves</option>{waves.map((wave) => <option key={wave} value={String(wave)}>Wave {wave}</option>)}</select>
      <select value={filters.hs4} onChange={(event) => setFilters({ ...filters, hs4: event.target.value })}><option value="ALL">All HS4</option>{hs4s.map((hs4) => <option key={hs4} value={hs4}>{hs4}</option>)}</select>
      <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="ALL">All status</option>{statuses.map((status) => <option key={status} value={status}>{human(status)}</option>)}</select>
      <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="priority">Plan priority</option><option value="import">Import value high</option><option value="buyers">Buyer count high</option><option value="sources">Source strength high</option><option value="blocked">Blocked/revisit high</option></select>
      <span>{fmt.format(filtered.length)} / {fmt.format(rows.length)} rows</span>
      <button type="button" onClick={() => setFilters({ search: '', wave: 'ALL', hs4: 'ALL', status: 'ALL', sort: 'priority' })}>Reset</button>
    </section>
    <section><div className="section-title"><h2>HS8 Pricing Backlog</h2><span>{fmt.format(filtered.length)} HS8 rows</span></div><div className="table-wrap buy-sell-table"><table><thead><tr><th>HS</th><th>Category</th><th>Wave</th><th>Market signal</th><th>SKU gate</th><th>Pricing evidence</th><th>Status</th><th>Blocker</th><th>Next action</th></tr></thead><tbody>{filtered.map((row) => <tr key={`${row.hs8}-${row.wave_number}`}><td><Stack primary={row.hs8} secondary={`HS4 ${row.hs4}`} /></td><td><Stack primary={row.commodity} secondary={human(row.pricing_wave)} /></td><td><Stack primary={`Wave ${clean(row.wave_number)}`} secondary={`Priority ${fmt.format(n(row.research_priority))}`} /></td><td><Stack primary={usdMn(row.val_2024_25)} secondary={`${fmt.format(n(row.unique_buyers))} buyers / ${fmt.format(n(row.unique_shippers))} shippers`} /></td><td><Stack primary={`${fmt.format(n(row.two_plus_sku_rows))} pass / ${fmt.format(n(row.one_source_sku_rows))} one / ${fmt.format(n(row.zero_source_sku_rows))} zero`} secondary={`${fmt.format(n(row.sku_queue_rows))} SKU queue rows`} /></td><td><Stack primary={`${fmt.format(n(row.usable_price_evidence_rows))} usable / ${fmt.format(n(row.blocked_price_evidence_rows))} blocked`} secondary={`${money(row.min_b2b_price_inr)} - ${money(row.max_b2b_price_inr)}`} /></td><td><Badge value={row.dashboard_status} /></td><td>{clean(row.current_blocker)}</td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div></section>
  </>;
}

function BuySellMap({ rows }) {
  const [filters, setFilters] = useState({ search: '', hs4: 'ALL', category: 'ALL', sort: 'priority' });
  const hs4s = useMemo(() => Array.from(new Set(rows.map((row) => row.hs4).filter(Boolean))).sort(), [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category_pod || row.category_label).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (filters.hs4 !== 'ALL' && String(row.hs4) !== filters.hs4) return false;
      if (filters.category !== 'ALL' && (row.category_pod || row.category_label) !== filters.category) return false;
      if (!q) return true;
      return rowText(row, ['hs8', 'hs4', 'category_pod', 'category_label', 'buy_category', 'sell_category', 'target_buyer_layer', 'commodity', 'next_action']).includes(q);
    });
    const copy = [...result];
    if (filters.sort === 'buyers') return copy.sort((a, b) => n(b.unique_buyers) - n(a.unique_buyers));
    if (filters.sort === 'shipments') return copy.sort((a, b) => n(b.shipment_count) - n(a.shipment_count));
    if (filters.sort === 'value') return copy.sort((a, b) => n(b.val_2024_25) - n(a.val_2024_25));
    return copy.sort((a, b) => n(a.sorting_rank) - n(b.sorting_rank));
  }, [rows, filters]);
  return <>
    <section className="filters wide"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search HS8, buy category, sell use, buyer layer..." /><select value={filters.hs4} onChange={(event) => setFilters({ ...filters, hs4: event.target.value })}><option value="ALL">All HS4</option>{hs4s.map((hs4) => <option key={hs4} value={hs4}>{hs4}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="ALL">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="priority">Plan priority</option><option value="buyers">Buyer count high</option><option value="shipments">Shipments high</option><option value="value">Import value high</option></select><span>{fmt.format(filtered.length)} / {fmt.format(rows.length)} rows</span><span /><button type="button" onClick={() => setFilters({ search: '', hs4: 'ALL', category: 'ALL', sort: 'priority' })}>Reset</button></section>
    <section><div className="section-title"><h2>HS Code Buy / Sell Map</h2><span>{fmt.format(filtered.length)} rows</span></div><div className="table-wrap buy-sell-table"><table><thead><tr><th>HS</th><th>Category</th><th>What to buy</th><th>How to sell</th><th>Buyer layer</th><th>Demand</th><th>Risk / gate</th><th>Next action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.hs8}><td><Stack primary={row.hs8} secondary={`${row.hs4} | ${row.research_priority || 'P3'}`} /></td><td><Stack primary={row.category_pod || row.category_label} secondary={row.commodity} /></td><td>{clean(row.buy_category)}</td><td>{clean(row.sell_category)}</td><td>{clean(row.target_buyer_layer)}</td><td><Stack primary={`${fmt.format(n(row.unique_buyers))} buyers`} secondary={`${fmt.format(n(row.shipment_count))} shipments | ${usdMn(row.val_2024_25)}`} /></td><td><Badge value={row.final_classification || row.margin_risk} /><span>{fmt.format(n(row.researched_sku_count))} researched SKU</span></td><td>{clean(row.next_action || row.latest_preliminary_verdict || 'Queue exact product research')}</td></tr>)}</tbody></table></div></section>
  </>;
}

function RelatedSkuCategories({ rows, policies }) {
  const [filters, setFilters] = useState({ search: '', type: 'ALL', wave: 'ALL', hs4: 'ALL', readiness: 'ALL', sort: 'priority' });
  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.category_type).filter(Boolean))).sort(), [rows]);
  const waves = useMemo(() => Array.from(new Set(rows.map((row) => row.research_wave).filter(Boolean))).sort(), [rows]);
  const readiness = useMemo(() => Array.from(new Set(rows.map((row) => row.category_readiness || row.status).filter(Boolean))).sort(), [rows]);
  const hs4s = useMemo(() => Array.from(new Set(rows.flatMap((row) => scopeValues(row)))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = rows.filter((row) => {
      const ready = row.category_readiness || row.status;
      if (filters.type !== 'ALL' && row.category_type !== filters.type) return false;
      if (filters.wave !== 'ALL' && row.research_wave !== filters.wave) return false;
      if (filters.hs4 !== 'ALL' && !scopeValues(row).includes(filters.hs4)) return false;
      if (filters.readiness !== 'ALL' && ready !== filters.readiness) return false;
      if (!q) return true;
      return rowText(row, ['category_code', 'category_name', 'category_family', 'category_type', 'primary_hs4', 'option_logic', 'target_buyer_layer', 'india_b2b_use_case', 'scale_reason', 'pricing_gate_policy', 'buyer_offer_mode', 'compliance_watch', 'category_readiness', 'next_action']).includes(q) || listText(row.hs4_scope).toLowerCase().includes(q) || listText(row.related_sku_examples).toLowerCase().includes(q) || listText(row.linked_category_pods).toLowerCase().includes(q);
    });
    const copy = [...result];
    if (filters.sort === 'buyers') return copy.sort((a, b) => n(b.unique_buyers) - n(a.unique_buyers));
    if (filters.sort === 'value') return copy.sort((a, b) => n(b.import_value_usd_mn) - n(a.import_value_usd_mn));
    if (filters.sort === 'sku_depth') return copy.sort((a, b) => n(b.researched_sku_rows) - n(a.researched_sku_rows) || n(b.exact_sku_rows) - n(a.exact_sku_rows));
    if (filters.sort === 'usable_price') return copy.sort((a, b) => n(b.usable_b2b_price_rows) - n(a.usable_b2b_price_rows) || n(b.two_plus_source_sku_rows) - n(a.two_plus_source_sku_rows));
    if (filters.sort === 'blocked') return copy.sort((a, b) => n(b.blocked_price_rows) - n(a.blocked_price_rows) || n(b.zero_source_sku_rows) - n(a.zero_source_sku_rows));
    return copy.sort((a, b) => n(b.priority_score) - n(a.priority_score) || n(b.hs8_count) - n(a.hs8_count));
  }, [rows, filters]);
  const totals = useMemo(() => ({
    usable: filtered.reduce((sum, row) => sum + n(row.usable_b2b_price_rows), 0),
    exact: filtered.reduce((sum, row) => sum + n(row.exact_sku_rows), 0),
    twoPlus: filtered.reduce((sum, row) => sum + n(row.two_plus_source_sku_rows), 0),
    blocked: filtered.reduce((sum, row) => sum + n(row.blocked_price_rows), 0),
    quoteQueue: filtered.reduce((sum, row) => sum + n(row.supplier_quote_queue_rows), 0)
  }), [filtered]);
  return <>
    <section className="metrics"><Metric label="Related category ranges" value={fmt.format(filtered.length)} color="blue" /><Metric label="Exact SKU rows" value={fmt.format(totals.exact)} color="green" /><Metric label="Usable B2B prices" value={fmt.format(totals.usable)} color="green" /><Metric label="Two-source SKUs" value={fmt.format(totals.twoPlus)} color="blue" /><Metric label="Blocked prices" value={fmt.format(totals.blocked)} color="bad" /><Metric label="Supplier quote queue" value={fmt.format(totals.quoteQueue)} color="amber" /></section>
    <section className="filters wide"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search category, SKU example, buyer layer, gate, next action..." /><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="ALL">All category types</option>{types.map((type) => <option key={type} value={type}>{human(type)}</option>)}</select><select value={filters.wave} onChange={(event) => setFilters({ ...filters, wave: event.target.value })}><option value="ALL">All waves</option>{waves.map((wave) => <option key={wave} value={wave}>{human(wave)}</option>)}</select><select value={filters.hs4} onChange={(event) => setFilters({ ...filters, hs4: event.target.value })}><option value="ALL">All HS4 scope</option>{hs4s.map((hs4) => <option key={hs4} value={hs4}>{hs4}</option>)}</select><select value={filters.readiness} onChange={(event) => setFilters({ ...filters, readiness: event.target.value })}><option value="ALL">All readiness</option>{readiness.map((item) => <option key={item} value={item}>{human(item)}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="priority">Priority high</option><option value="buyers">Buyer count high</option><option value="value">Import value high</option><option value="sku_depth">SKU depth high</option><option value="usable_price">Usable B2B price high</option><option value="blocked">Blocked price high</option></select><span>{fmt.format(filtered.length)} / {fmt.format(rows.length)} rows</span><button type="button" onClick={() => setFilters({ search: '', type: 'ALL', wave: 'ALL', hs4: 'ALL', readiness: 'ALL', sort: 'priority' })}>Reset</button></section>
    <main className="split"><section><div className="section-title"><h2>Related SKU Category Ranges</h2><span>{fmt.format(filtered.length)} ranges</span></div><div className="table-wrap buy-sell-table"><table><thead><tr><th>Category</th><th>Type / wave</th><th>HS scope</th><th>Related SKU options</th><th>Buyer use</th><th>Market signal</th><th>SKU / price gate</th><th>Readiness</th><th>Next action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.category_code}><td><Stack primary={row.category_name} secondary={row.category_family} /></td><td><Stack primary={human(row.category_type)} secondary={human(row.research_wave)} /></td><td><Stack primary={`Primary ${clean(row.primary_hs4)}`} secondary={listText(row.hs4_scope)} /></td><td><Stack primary={listText(row.related_sku_examples)} secondary={row.option_logic} /></td><td><Stack primary={row.target_buyer_layer} secondary={row.india_b2b_use_case} /></td><td><Stack primary={`${fmt.format(n(row.unique_buyers))} buyers | ${usdMn(row.import_value_usd_mn)}`} secondary={`${fmt.format(n(row.shipment_count))} shipments / ${fmt.format(n(row.hs8_count))} HS8`} /></td><td><Stack primary={`${fmt.format(n(row.exact_sku_rows))} exact SKU / ${fmt.format(n(row.usable_b2b_price_rows))} usable B2B`} secondary={`${fmt.format(n(row.two_plus_source_sku_rows))} two-source / ${fmt.format(n(row.zero_source_sku_rows))} zero-source`} /></td><td><Badge value={row.category_readiness || row.status} /></td><td><Stack primary={row.next_action} secondary={row.pricing_gate_policy} /></td></tr>)}</tbody></table></div></section><aside className="panel"><div className="panel-title"><span>Category Policy</span><Badge value={`${policies.length} rules`} /></div><h2>Scaling Rules</h2><div className="mini-list">{policies.map((row) => <span key={row.id}><strong>{clean(row.policy_name)}</strong>Allowed: {clean(row.allowed_use)}<br />Gate: {clean(row.required_gate)}<br />Blocked: {clean(row.forbidden_use)}</span>)}</div></aside></main>
  </>;
}

function PriceStatus({ rows }) {
  const [filters, setFilters] = useState({ search: '', status: 'ALL', sort: 'checked' });
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.evidence_quality || row.freshness_status).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = rows.filter((row) => {
      const status = row.evidence_quality || row.freshness_status;
      if (filters.status !== 'ALL' && status !== filters.status) return false;
      if (!q) return true;
      return rowText(row, ['product_or_sku', 'hs8', 'source_name', 'source_url', 'price_kind', 'evidence_quality', 'unit_status', 'blocker']).includes(q);
    });
    const copy = [...result];
    if (filters.sort === 'usable') return copy.sort((a, b) => Number(Boolean(b.margin_usable)) - Number(Boolean(a.margin_usable)) || n(b.market_price_inr) - n(a.market_price_inr));
    if (filters.sort === 'price') return copy.sort((a, b) => n(a.market_price_inr) - n(b.market_price_inr));
    return copy;
  }, [rows, filters]);
  return <><section className="filters wide"><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search SKU, HS8, source, evidence, blocker..." /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="ALL">All evidence</option>{statuses.map((status) => <option key={status} value={status}>{human(status)}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="checked">Latest checked</option><option value="usable">Usable first</option><option value="price">Price low</option></select><span>{fmt.format(filtered.length)} / {fmt.format(rows.length)} rows</span><span /><span /><button type="button" onClick={() => setFilters({ search: '', status: 'ALL', sort: 'checked' })}>Reset</button></section><section><div className="section-title"><h2>Price Research Status</h2><span>{fmt.format(filtered.length)} rows</span></div><div className="table-wrap"><table><thead><tr><th>SKU</th><th>HS</th><th>Source</th><th>Price</th><th>Evidence</th><th>Unit</th><th>Margin usable</th><th>Final</th><th>Blocker</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><Stack primary={row.product_or_sku} secondary={shortDate(row.checked_at)} /></td><td>{clean(row.hs8)}</td><td><Stack primary={row.source_name} secondary={row.source_url} /></td><td><Stack primary={money(row.market_price_inr || row.price_inr || row.b2b_price_inr)} secondary={human(row.price_kind)} /></td><td><Badge value={row.evidence_quality || row.freshness_status} /></td><td>{human(row.unit_status)}</td><td><Badge value={row.margin_usable ? 'margin_usable' : 'not_margin_usable'} /></td><td><Badge value={row.final_ranking_allowed ? 'ranking_allowed' : 'ranking_blocked'} /></td><td>{clean(row.blocker)}</td></tr>)}</tbody></table></div></section></>;
}

function SupplierQueue({ rows }) {
  return <section><div className="section-title"><h2>Supplier Landed Quote Queue</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr><th>HS / Product</th><th>Wave</th><th>Source coverage</th><th>Best B2B price</th><th>Quote priority</th><th>Blocker</th><th>Next action</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.hs8}-${row.product_or_sku || row.commodity}`}><td><Stack primary={row.product_or_sku || row.commodity || row.hs8} secondary={`${clean(row.hs8)} | HS4 ${clean(row.hs4)}`} /></td><td>{human(row.pricing_wave)}</td><td><Stack primary={`${fmt.format(n(row.b2b_source_price_rows || row.usable_price_evidence_rows))} usable sources`} secondary={`${fmt.format(n(row.blocked_price_rows || row.blocked_price_evidence_rows))} blocked`} /></td><td>{money(row.best_b2b_price_inr || row.min_b2b_price_inr)}</td><td><Badge value={row.quote_priority || row.dashboard_status} /></td><td>{clean(row.current_blocker || row.blocker)}</td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div></section>;
}

function GenericTable({ title, rows, columns }) {
  return <section><div className="section-title"><h2>{title}</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.validation_id || `${title}-${index}`}>{columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}</tr>)}</tbody></table></div></section>;
}

function SimpleEvidence({ title, rows }) {
  return <GenericTable title={title} rows={rows} columns={[{ label: 'SKU / HS', render: (row) => <Stack primary={row.product_or_sku || row.product_name || row.supplier_name || row.hs8} secondary={row.hs8} /> }, { label: 'Evidence', render: (row) => <Badge value={row.evidence_status || row.proof_status || row.evidence_quality || row.evidence_quality_status || row.supplier_verdict || row.demand_verdict || row.compliance_verdict} /> }, { label: 'Unit', render: (row) => human(row.unit_gate_status || row.exact_unit_status || row.unit_status || row.normalized_unit || row.supplier_unit) }, { label: 'Gate', render: (row) => <Badge value={row.margin_gate_status || row.deal_practicality_status || row.guardrail_status || row.ranking_status || row.preliminary_verdict || row.verdict || row.final_classification} /> }, { label: 'Blocker / Notes', render: (row) => clean(row.blocker || row.unit_blocker || row.notes || row.next_action || row.revisit_trigger) }]} />;
}

function Rejections({ rows }) {
  return <GenericTable title="Rejection Register" rows={rows} columns={[{ label: 'HS / SKU', render: (row) => <Stack primary={row.product_or_sku || row.hs8} secondary={`${clean(row.hs8)} | ${clean(row.hs4)}`} /> }, { label: 'Phase', render: (row) => clean(row.rejection_phase) }, { label: 'Reason', render: (row) => <Badge value={row.rejection_reason} /> }, { label: 'Revisit', render: (row) => <Stack primary={human(row.permanent_or_temporary)} secondary={row.revisit_trigger} /> }, { label: 'Updated', render: (row) => shortDate(row.updated_at) }, { label: 'Next action', render: (row) => clean(row.next_action || row.notes) }]} />;
}

const CLASS_COLORS = { TRADER: '#f87171', LIKELY_TRADER: '#fb923c', AMBIGUOUS: '#fbbf24', LIKELY_MANUFACTURER: '#60a5fa', MANUFACTURER: '#34d399', CONTRACT_MANUFACTURER: '#a78bfa' };

function BuyerClassification({ rows }) {
  const [filters, setFilters] = useState({ search: '', cls: 'ALL', hs4: 'ALL', sort: 'score' });
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.classification).filter(Boolean))).sort(), [rows]);
  const hs4s = useMemo(() => {
    const all = new Set();
    rows.forEach((r) => { if (r.hs4_codes) String(r.hs4_codes).split(',').map(s => s.trim()).filter(Boolean).forEach(c => all.add(c)); });
    return Array.from(all).sort();
  }, [rows]);

  const counts = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.classification] = (m[r.classification] || 0) + 1; });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (filters.cls !== 'ALL' && r.classification !== filters.cls) return false;
      if (filters.hs4 !== 'ALL' && !(r.hs4_codes && String(r.hs4_codes).includes(filters.hs4))) return false;
      if (!q) return true;
      return rowText(r, ['company_name', 'hs4_codes', 'classification', 'cities', 'notable_signals']).includes(q);
    });
    const copy = [...result];
    if (filters.sort === 'cif') return copy.sort((a, b) => n(b.total_cif_usd) - n(a.total_cif_usd));
    if (filters.sort === 'shipments') return copy.sort((a, b) => n(b.total_shipments) - n(a.total_shipments));
    if (filters.sort === 'china') return copy.sort((a, b) => n(b.avg_china_pct) - n(a.avg_china_pct));
    return copy.sort((a, b) => n(b.middleman_score) - n(a.middleman_score));
  }, [rows, filters]);

  const traders = rows.filter((r) => r.classification === 'TRADER' || r.classification === 'LIKELY_TRADER').length;
  const manufacturers = rows.filter((r) => r.classification === 'MANUFACTURER' || r.classification === 'LIKELY_MANUFACTURER').length;
  const contract = rows.filter((r) => r.classification === 'CONTRACT_MANUFACTURER').length;

  return <>
    <section className="metrics">
      <Metric label="Total classified" value={fmt.format(rows.length)} color="blue" />
      <Metric label="Traders + Likely" value={fmt.format(traders)} color="bad" />
      <Metric label="Manufacturers + Likely" value={fmt.format(manufacturers)} color="green" />
      <Metric label="Contract Mfrs" value={fmt.format(contract)} color="amber" />
      <Metric label="Ambiguous" value={fmt.format(counts['AMBIGUOUS'] || 0)} color="amber" />
      <Metric label="Avg middleman score" value={fmt1.format(rows.length ? rows.reduce((s, r) => s + n(r.middleman_score), 0) / rows.length : 0)} color="blue" />
    </section>
    <section className="metrics">
      {classes.map((cls) => <Metric key={cls} label={human(cls)} value={fmt.format(counts[cls] || 0)} color={cls.includes('TRADER') ? 'bad' : cls.includes('MANUFACTURER') ? 'green' : 'amber'} />)}
    </section>
    <section className="filters wide">
      <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search company, HS4, city, classification, signals..." />
      <select value={filters.cls} onChange={(e) => setFilters({ ...filters, cls: e.target.value })}><option value="ALL">All classifications</option>{classes.map((c) => <option key={c} value={c}>{human(c)}</option>)}</select>
      <select value={filters.hs4} onChange={(e) => setFilters({ ...filters, hs4: e.target.value })}><option value="ALL">All HS4</option>{hs4s.map((h) => <option key={h} value={h}>{h}</option>)}</select>
      <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="score">Middleman score high</option><option value="cif">CIF value high</option><option value="shipments">Shipments high</option><option value="china">China % high</option></select>
      <span>{fmt.format(filtered.length)} / {fmt.format(rows.length)} rows</span>
      <button type="button" onClick={() => setFilters({ search: '', cls: 'ALL', hs4: 'ALL', sort: 'score' })}>Reset</button>
    </section>
    <section>
      <div className="section-title"><h2>Buyer Classifications</h2><span>{fmt.format(filtered.length)} companies</span></div>
      <div className="table-wrap buy-sell-table">
        <table><thead><tr><th>Company</th><th>IEC</th><th>HS4 Codes</th><th>Classification</th><th>Confidence</th><th>Score</th><th>Shipments</th><th>CIF USD</th><th>China %</th><th>Suppliers</th><th>Cities</th><th>Trading Model</th><th>Signals</th></tr></thead>
        <tbody>{filtered.map((r, i) => <tr key={r.company_name + '-' + i}>
          <td><strong>{clean(r.company_name)}</strong></td>
          <td style={{ fontSize: '0.75rem' }}>{clean(r.iec)}</td>
          <td style={{ fontSize: '0.75rem' }}>{clean(r.hs4_codes)}</td>
          <td><span className={'badge ' + (r.classification?.includes('TRADER') ? 'bad' : r.classification?.includes('MANUFACTURER') ? 'good' : 'watch')}>{human(r.classification)}</span></td>
          <td><span className={'badge ' + (r.confidence === 'HIGH' ? 'good' : r.confidence === 'MEDIUM' ? 'watch' : 'dim')}>{clean(r.confidence)}</span></td>
          <td><strong>{fmt.format(n(r.middleman_score))}</strong>/100</td>
          <td>{fmt.format(n(r.total_shipments))}</td>
          <td>{'$' + fmt.format(n(r.total_cif_usd))}</td>
          <td style={{ color: n(r.avg_china_pct) > 50 ? '#f87171' : '#94a3b8' }}>{fmt1.format(n(r.avg_china_pct))}%</td>
          <td>{fmt.format(n(r.total_suppliers))}</td>
          <td style={{ fontSize: '0.75rem' }}>{clean(r.cities)}</td>
          <td><span className="badge dim">{clean(r.trading_model)}</span></td>
          <td style={{ fontSize: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notable_signals || ''}>{clean(r.notable_signals)}</td>
        </tr>)}</tbody></table>
      </div>
    </section>
  </>;
}

function App() {
  const data = useData();
  const [tab, setTab] = useState('control');
  useEffect(() => {
    data.loadTab(tab);
  }, [tab]);
  if (data.loading) return <div className="boot">Loading live Supabase research workspace...</div>;
  const tabLoading = Boolean(data.loadingTabs[tab]);
  const tabError = data.tabErrors[tab];
  return <div className="app">
    <header><div><h1>Naresh Exim Component Research</h1><p>Evidence-first HS code, exact-unit, supplier, buyer and final-ranking control dashboard.</p></div><button onClick={() => data.reload(tab)}>Refresh</button></header>
    {data.error ? <div className="error">{data.error}</div> : null}
    <nav><button className={tab === 'control' ? 'active' : ''} onClick={() => setTab('control')}>Plan Control</button><button className={tab === 'hs8Backlog' ? 'active' : ''} onClick={() => setTab('hs8Backlog')}>HS8 Pricing Backlog</button><button className={tab === 'wave' ? 'active' : ''} onClick={() => setTab('wave')}>Wave Progress</button><button className={tab === 'prices' ? 'active' : ''} onClick={() => setTab('prices')}>Price Status</button><button className={tab === 'supplierQueue' ? 'active' : ''} onClick={() => setTab('supplierQueue')}>Supplier Quote Queue</button><button className={tab === 'buySell' ? 'active' : ''} onClick={() => setTab('buySell')}>HS Buy/Sell Map</button><button className={tab === 'relatedCategories' ? 'active' : ''} onClick={() => setTab('relatedCategories')}>Related SKU Categories</button><button className={tab === 'inflow' ? 'active' : ''} onClick={() => setTab('inflow')}>SKU Inflow</button><button className={tab === 'units' ? 'active' : ''} onClick={() => setTab('units')}>Exact Units</button><button className={tab === 'suppliers' ? 'active' : ''} onClick={() => setTab('suppliers')}>Suppliers</button><button className={tab === 'demand' ? 'active' : ''} onClick={() => setTab('demand')}>Demand</button><button className={tab === 'capital' ? 'active' : ''} onClick={() => setTab('capital')}>Capital</button><button className={tab === 'compliance' ? 'active' : ''} onClick={() => setTab('compliance')}>Compliance</button><button className={tab === 'noVolza' ? 'active' : ''} onClick={() => setTab('noVolza')}>No-Volza</button><button className={tab === 'guardrails' ? 'active' : ''} onClick={() => setTab('guardrails')}>Guardrails</button><button className={tab === 'shortlist' ? 'active' : ''} onClick={() => setTab('shortlist')}>Shortlist</button><button className={tab === 'rejections' ? 'active' : ''} onClick={() => setTab('rejections')}>Rejected/Revisit</button><button className={tab === 'classification' ? 'active' : ''} onClick={() => setTab('classification')}>Buyer Classification</button></nav>
    <LoadingOrError loading={tabLoading} error={tabError} />
    {tab === 'control' ? <Control data={data} /> : null}
    {tab === 'hs8Backlog' ? <Hs8Backlog rows={data.hs8Backlog} /> : null}
    {tab === 'wave' ? <WaveProgress rows={data.hs4Progress} /> : null}
    {tab === 'prices' ? <PriceStatus rows={data.priceStatus} /> : null}
    {tab === 'supplierQueue' ? <SupplierQueue rows={data.supplierQueue} /> : null}
    {tab === 'buySell' ? <BuySellMap rows={data.hsBuySell} /> : null}
    {tab === 'relatedCategories' ? <RelatedSkuCategories rows={data.relatedCategories} policies={data.categoryPolicy} /> : null}
    {tab === 'inflow' ? <SimpleEvidence title="Researched SKU Inflow" rows={data.researchedInflow} /> : null}
    {tab === 'units' ? <SimpleEvidence title="Exact-Unit Recheck" rows={data.exactUnits} /> : null}
    {tab === 'suppliers' ? <SimpleEvidence title="Supplier Verification Audit" rows={data.supplierAudit} /> : null}
    {tab === 'demand' ? <SimpleEvidence title="Demand Verification" rows={data.demandAudit} /> : null}
    {tab === 'capital' ? <SimpleEvidence title="Working Capital Gate" rows={data.workingCapital} /> : null}
    {tab === 'compliance' ? <SimpleEvidence title="Compliance Audit" rows={data.complianceAudit} /> : null}
    {tab === 'noVolza' ? <SimpleEvidence title="No-Volza Revisit Register" rows={data.noVolza} /> : null}
    {tab === 'guardrails' ? <SimpleEvidence title="Final Ranking Guardrails" rows={data.finalGuardrails} /> : null}
    {tab === 'shortlist' ? <SimpleEvidence title="Final Shortlist Candidates" rows={data.finalShortlist} /> : null}
    {tab === 'rejections' ? <Rejections rows={data.rejections} /> : null}
    {tab === 'classification' ? <BuyerClassification rows={data.buyerClassifications} /> : null}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

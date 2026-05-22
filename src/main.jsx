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

function usdMn(value) {
  if (value === null || value === undefined || value === '') return '-';
  return '$' + fmt1.format(Number(value)) + 'M';
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('complete') || text.includes('verified') || text.includes('fresh') || text.includes('pass') || text.includes('ready')) return 'good';
  if (text.includes('progress') || text.includes('partial') || text.includes('open') || text.includes('blocked') || text.includes('stale')) return 'watch';
  if (text.includes('fail') || text.includes('reject') || text.includes('missing') || text.includes('not_usable')) return 'bad';
  return 'muted';
}

function useData() {
  const empty = {
    loading: true, error: '', buySell: [], inflow: [], audit: [], evidence: [], rejects: [], products: [],
    phase1Counts: [], planTodos: [], nextActions: [], finalGuardrails: [], exactUnits: [], supplierAudit: [], hs4Progress: []
  };
  const [state, setState] = useState(empty);

  async function load() {
    if (!supabase) {
      setState({ ...empty, loading: false, error: 'Supabase publishable key is missing in Vercel environment.' });
      return;
    }
    setState((old) => ({ ...old, loading: true, error: '' }));
    const [buySell, inflow, audit, evidence, rejects, products, phase1Counts, planTodos, nextActions, finalGuardrails, exactUnits, supplierAudit, hs4Progress] = await Promise.all([
      supabase.from('component_dashboard_buy_sell_hs_codes').select('*').order('sorting_rank', { ascending: true }).limit(2000),
      supabase.from('component_researched_sku_inflow').select('*').order('researched_at', { ascending: false }).limit(500),
      supabase.from('component_hs8_research_audit').select('*').order('updated_at', { ascending: false }).limit(1000),
      supabase.from('component_research_evidence_refs').select('*').order('checked_at', { ascending: false }).limit(1000),
      supabase.from('component_rejection_register').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('component_dashboard_products').select('*').order('priority_rank', { ascending: true }).limit(500),
      supabase.from('component_dashboard_phase1_control_counts').select('*').order('metric', { ascending: true }),
      supabase.from('component_plan_phase_wave_todos').select('*').order('phase_number', { ascending: true }).order('wave_number', { ascending: true, nullsFirst: true }).order('task_order', { ascending: true }).limit(200),
      supabase.from('component_plan_next_actions').select('*').order('action_priority', { ascending: true }).order('phase_number', { ascending: true }).limit(100),
      supabase.from('component_final_ranking_guardrail').select('*').order('guardrail_status', { ascending: true }).limit(500),
      supabase.from('component_wave1_exact_unit_recheck_dashboard').select('*').order('validation_id', { ascending: true }).limit(500),
      supabase.from('component_supplier_verification_audit').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_wave_hs4_scope_progress').select('*').order('hs4', { ascending: true })
    ]);
    const error = buySell.error || inflow.error || audit.error || evidence.error || rejects.error || products.error || phase1Counts.error || planTodos.error || nextActions.error || finalGuardrails.error || exactUnits.error || supplierAudit.error || hs4Progress.error;
    if (error) {
      setState({ ...empty, loading: false, error: error.message });
      return;
    }
    setState({
      loading: false, error: '', buySell: buySell.data || [], inflow: inflow.data || [], audit: audit.data || [],
      evidence: evidence.data || [], rejects: rejects.data || [], products: products.data || [],
      phase1Counts: phase1Counts.data || [], planTodos: planTodos.data || [], nextActions: nextActions.data || [],
      finalGuardrails: finalGuardrails.data || [], exactUnits: exactUnits.data || [], supplierAudit: supplierAudit.data || [],
      hs4Progress: hs4Progress.data || []
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

function Stack({ primary, secondary }) {
  return <div className="stack"><strong>{clean(primary)}</strong>{secondary ? <span>{clean(secondary)}</span> : null}</div>;
}

function Mini({ title, rows }) {
  return <section className="mini"><strong>{title}</strong>{rows.length ? rows.map((row, index) => <span key={index}>{row}</span>) : <span>No rows yet</span>}</section>;
}

function Control({ data }) {
  const counts = useMemo(() => Object.fromEntries(data.phase1Counts.map((row) => [row.metric, Number(row.rows || 0)])), [data.phase1Counts]);
  const blocked = data.finalGuardrails.filter((row) => row.guardrail_status !== 'rankable').length;
  const rankable = data.finalGuardrails.length - blocked;
  return <>
    <section className="metrics">
      <Metric label="Fresh verified pricing" value={fmt.format(counts.fresh_verified_pricing || 0)} color="green" />
      <Metric label="Fresh evidence only" value={fmt.format(counts.fresh_evidence_only || 0)} color="blue" />
      <Metric label="Stale pricing" value={fmt.format(counts.stale_pricing || 0)} color="amber" />
      <Metric label="Blocked shortlist" value={fmt.format(counts.blocked_final_shortlist || 0)} color="amber" />
      <Metric label="Rankable rows" value={fmt.format(rankable)} color="green" />
      <Metric label="Landed suppliers" value={fmt.format(counts.landed_cost_ready_suppliers || 0)} color="green" />
    </section>
    <main className="split">
      <section>
        <div className="section-title"><h2>Plan Todo Control</h2><span>{fmt.format(data.planTodos.length)} rows</span></div>
        <div className="table-wrap"><table><thead><tr><th>Phase</th><th>Wave</th><th>Task</th><th>Status</th><th>Verify</th><th>Blocker</th><th>Next action</th></tr></thead><tbody>{data.planTodos.map((row) => <tr key={row.id}><td><Stack primary={`${row.phase_number}. ${row.phase_name}`} secondary={row.hs4_scope} /></td><td>{clean(row.wave_number)}</td><td>{row.task_name}</td><td><Badge value={row.status} /></td><td><Badge value={row.verification_status} /></td><td>{clean(row.blocker)}</td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="panel"><div className="panel-title"><span>Next Actions</span><Badge value={`${data.nextActions.length} open`} /></div><h2>Immediate Work Queue</h2><div className="mini-list">{data.nextActions.slice(0, 10).map((row) => <span key={`${row.phase_number}-${row.wave_number || 0}-${row.task_order}`}><strong>{row.phase_number}. {row.task_name}</strong>{clean(row.next_action)}</span>)}</div></aside>
    </main>
  </>;
}

function WaveProgress({ rows }) {
  return <section><div className="section-title"><h2>Wave 1 HS4 Scope Progress</h2><span>{fmt.format(rows.length)} HS4 codes</span></div><div className="table-wrap"><table><thead><tr><th>HS4</th><th>HS8 scope</th><th>Researched SKUs</th><th>Unit checked</th><th>Margin usable</th><th>Buyer positive</th><th>Complete</th><th>Next action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.hs4}><td><strong>{row.hs4}</strong></td><td>{fmt.format(row.hs8_codes_in_scope || 0)}</td><td>{fmt.format(row.researched_sku_rows || 0)}</td><td>{fmt.format(row.exact_unit_rechecked_products || 0)}</td><td>{fmt.format(row.margin_usable_products || 0)}</td><td>{fmt.format(row.positive_buyer_products || 0)}</td><td><Badge value={row.exact_price_research_complete ? 'complete' : 'incomplete'} /></td><td>{clean(row.next_action)}</td></tr>)}</tbody></table></div></section>;
}

function ExactUnits({ rows, suppliers }) {
  return <main className="split"><section><div className="section-title"><h2>Exact-Unit Recheck</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr><th>SKU</th><th>HS</th><th>Required unit</th><th>Margin</th><th>Blocker</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.product_or_sku}</strong></td><td>{row.hs8}</td><td>{clean(row.exact_unit_required)}</td><td><Badge value={row.usable_for_margin ? 'margin usable' : row.price_source_status} /></td><td>{clean(row.unit_blocker)}</td></tr>)}</tbody></table></div></section><aside className="panel"><div className="panel-title"><span>Supplier Audit</span><Badge value={`${suppliers.length} rows`} /></div><h2>Landed-Cost Gate</h2><div className="mini-list">{suppliers.slice(0, 14).map((row) => <span key={row.id}><strong>{row.supplier_name}</strong>{row.product_or_sku} | {human(row.exact_unit_status)} | {human(row.supplier_verdict)}</span>)}</div></aside></main>;
}

function Guardrails({ rows }) {
  return <section><div className="section-title"><h2>Final Ranking Guardrail</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr><th>SKU</th><th>HS</th><th>Evidence</th><th>Unit</th><th>Margin</th><th>Buyer</th><th>Guardrail</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.validation_id}-${row.product_or_sku}`}><td><strong>{row.product_or_sku}</strong></td><td>{row.hs8}</td><td><Badge value={row.evidence_quality} /></td><td>{human(row.unit_gate_status)}</td><td>{human(row.margin_gate_status)}</td><td>{human(row.buyer_validation_status)}</td><td><Badge value={row.guardrail_status} /></td></tr>)}</tbody></table></div></section>;
}

function BuySellMap({ rows, inflow }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => !q || [row.hs8, row.hs4, row.category_pod, row.buy_category, row.sell_category, row.target_buyer_layer, row.commodity].join(' ').toLowerCase().includes(q));
  }, [rows, search]);
  return <><section className="filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search HS8, category, buy/sell use, buyer layer..." /><span>{fmt.format(filtered.length)} rows</span></section><main className="split buy-sell-split"><section><div className="section-title"><h2>HS Code Buy / Sell Map</h2><span>{fmt.format(filtered.length)} rows</span></div><div className="table-wrap buy-sell-table"><table><thead><tr><th>HS</th><th>Category</th><th>What to buy</th><th>How to sell</th><th>Buyer layer</th><th>Demand</th><th>Risk / gate</th><th>Next action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.hs8}><td><Stack primary={row.hs8} secondary={`${row.hs4} | ${row.research_priority || 'P3'}`} /></td><td><Stack primary={row.category_pod} secondary={row.category_label || row.commodity} /></td><td>{clean(row.buy_category)}</td><td>{clean(row.sell_category)}</td><td>{clean(row.target_buyer_layer)}</td><td><Stack primary={`${fmt.format(Number(row.unique_buyers || 0))} buyers`} secondary={`${fmt.format(Number(row.shipment_count || 0))} shipments | ${usdMn(row.val_2024_25)}`} /></td><td><Badge value={row.final_classification || row.margin_risk} /><span>{fmt.format(Number(row.researched_sku_count || 0))} researched SKU</span></td><td>{clean(row.next_action || row.latest_preliminary_verdict || 'Queue exact product research')}</td></tr>)}</tbody></table></div></section><aside className="panel"><div className="panel-title"><span>Researched SKU Inflow</span><Badge value={`${inflow.length} rows`} /></div><h2>Latest Evidence Rows</h2><div className="mini-list">{inflow.slice(0, 16).map((row) => <span key={row.id}><strong>{row.product_or_sku}</strong>{row.hs8} | {human(row.unit_gate_status)} | {human(row.margin_gate_status)}</span>)}</div></aside></main></>;
}

function SimpleTable({ title, rows }) {
  return <section><div className="section-title"><h2>{title}</h2><span>{fmt.format(rows.length)} rows</span></div><div className="table-wrap"><table><thead><tr><th>SKU / HS</th><th>Evidence</th><th>Unit</th><th>Margin</th><th>Verdict</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Stack primary={row.product_or_sku || row.product_name || row.hs8} secondary={row.hs8} /></td><td><Badge value={row.evidence_status || row.proof_status || row.evidence_quality_status} /></td><td><Badge value={row.unit_gate_status} /></td><td><Badge value={row.margin_gate_status} /></td><td><Badge value={row.preliminary_verdict || row.verdict || row.final_classification} /></td></tr>)}</tbody></table></div></section>;
}

function App() {
  const data = useData();
  const [tab, setTab] = useState('control');
  const buyerPositive = data.finalGuardrails.filter((row) => row.guardrail_status === 'rankable').length;
  if (data.loading) return <div className="boot">Loading live Supabase research workspace...</div>;
  return <div className="app"><header><div><h1>Naresh Exim Component Research</h1><p>Evidence-first HS code, exact-unit, supplier, buyer and final-ranking control dashboard.</p></div><button onClick={data.reload}>Refresh</button></header>{data.error ? <div className="error">{data.error}</div> : null}<section className="metrics"><Metric label="HS buy/sell codes" value={fmt.format(data.buySell.length)} color="blue" /><Metric label="SKU inflow rows" value={fmt.format(data.inflow.length)} color="green" /><Metric label="Evidence refs" value={fmt.format(data.evidence.length)} color="green" /><Metric label="Exact-unit rows" value={fmt.format(data.exactUnits.length)} color="blue" /><Metric label="Supplier audits" value={fmt.format(data.supplierAudit.length)} color="amber" /><Metric label="Rankable rows" value={fmt.format(buyerPositive)} color="green" /></section><nav><button className={tab === 'control' ? 'active' : ''} onClick={() => setTab('control')}>Plan Control</button><button className={tab === 'wave' ? 'active' : ''} onClick={() => setTab('wave')}>Wave Progress</button><button className={tab === 'units' ? 'active' : ''} onClick={() => setTab('units')}>Exact Units</button><button className={tab === 'guardrails' ? 'active' : ''} onClick={() => setTab('guardrails')}>Guardrails</button><button className={tab === 'buySell' ? 'active' : ''} onClick={() => setTab('buySell')}>HS Buy/Sell Map</button><button className={tab === 'inflow' ? 'active' : ''} onClick={() => setTab('inflow')}>SKU Inflow</button></nav>{tab === 'control' ? <Control data={data} /> : null}{tab === 'wave' ? <WaveProgress rows={data.hs4Progress} /> : null}{tab === 'units' ? <ExactUnits rows={data.exactUnits} suppliers={data.supplierAudit} /> : null}{tab === 'guardrails' ? <Guardrails rows={data.finalGuardrails} /> : null}{tab === 'buySell' ? <BuySellMap rows={data.buySell} inflow={data.inflow} /> : null}{tab === 'inflow' ? <SimpleTable title="Researched SKU Inflow" rows={data.inflow} /> : null}</div>;
}

createRoot(document.getElementById('root')).render(<App />);

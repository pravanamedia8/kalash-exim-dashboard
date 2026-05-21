import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ckjnrebfbhshmihysmjf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

function human(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value).replaceAll('_', ' ');
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-';
  return 'INR ' + fmt.format(Number(value));
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-';
  return fmt1.format(Number(value)) + '%';
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('pass') || text.includes('verified') || text.includes('confirmed') || text.includes('winner') || text.includes('fresh')) return 'good';
  if (text.includes('needs') || text.includes('pending') || text.includes('not_started') || text.includes('watch') || text.includes('quote') || text.includes('proxy')) return 'watch';
  if (text.includes('reject') || text.includes('fail') || text.includes('mismatch') || text.includes('not_usable')) return 'bad';
  return 'muted';
}

function useData() {
  const [state, setState] = useState({ loading: true, error: '', audit: [], evidence: [], unit: [], middlemen: [], spot: [], buyers: [], rejects: [], products: [], hs8: [] });

  async function load() {
    if (!supabase) {
      setState((old) => ({ ...old, loading: false, error: 'Supabase publishable key is missing in Vercel environment.' }));
      return;
    }

    setState((old) => ({ ...old, loading: true, error: '' }));
    const [audit, evidence, unit, middlemen, spot, buyers, rejects, products, hs8] = await Promise.all([
      supabase.from('component_hs8_research_audit').select('*').order('final_score', { ascending: false, nullsFirst: false }).limit(1000),
      supabase.from('component_research_evidence_refs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_unit_margin_audits').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_middleman_verifications').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_spot_buy_opportunities').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('component_buyer_validation_checks').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_rejection_register').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('component_dashboard_products').select('*').order('priority_rank', { ascending: true }).limit(500),
      supabase.from('component_dashboard_hs8').select('*').order('live_score', { ascending: false }).limit(1000)
    ]);

    const error = audit.error || evidence.error || unit.error || middlemen.error || spot.error || buyers.error || rejects.error || products.error || hs8.error;
    if (error) {
      setState({ loading: false, error: error.message, audit: [], evidence: [], unit: [], middlemen: [], spot: [], buyers: [], rejects: [], products: [], hs8: [] });
      return;
    }

    setState({
      loading: false,
      error: '',
      audit: audit.data || [],
      evidence: evidence.data || [],
      unit: unit.data || [],
      middlemen: middlemen.data || [],
      spot: spot.data || [],
      buyers: buyers.data || [],
      rejects: rejects.data || [],
      products: products.data || [],
      hs8: hs8.data || []
    });
  }

  useEffect(() => { load(); }, []);
  return { ...state, reload: load };
}

function Badge({ value }) {
  return <span className={'badge ' + tone(value)}>{human(value)}</span>;
}

function Metric({ label, value, toneName = '' }) {
  return <div className={'metric ' + toneName}><span>{label}</span><strong>{value}</strong></div>;
}

function GateStrip({ row }) {
  const gates = [
    ['Evidence', row?.evidence_quality_status],
    ['Unit', row?.unit_gate_status],
    ['Margin', row?.margin_gate_status],
    ['Capital', row?.working_capital_status],
    ['Buyer', row?.buyer_validation_status],
    ['Final', row?.final_classification]
  ];
  return <div className="gate-strip">{gates.map(([label, value]) => <div className={'gate ' + tone(value)} key={label}><span>{label}</span><strong>{human(value || 'not_started')}</strong></div>)}</div>;
}

function AuditTable({ rows, onPick, selected }) {
  return <div className="table-wrap"><table><thead><tr><th>HS8</th><th>Commodity</th><th>Wave</th><th>Evidence</th><th>Unit</th><th>Margin</th><th>Capital</th><th>Buyer</th><th>Final</th><th>Score</th></tr></thead><tbody>{rows.map((row) => <tr key={row.hs8} className={selected?.hs8 === row.hs8 ? 'selected' : ''} onClick={() => onPick(row)}><td><strong>{row.hs8}</strong><span>{row.hs4}</span></td><td><strong>{row.commodity}</strong><span>{row.notes}</span></td><td>{row.pricing_wave || '-'}</td><td><Badge value={row.evidence_quality_status} /></td><td><Badge value={row.unit_gate_status} /></td><td><Badge value={row.margin_gate_status} /></td><td><Badge value={row.working_capital_status} /></td><td><Badge value={row.buyer_validation_status} /></td><td><Badge value={row.final_classification} /></td><td>{row.final_score || '-'}</td></tr>)}</tbody></table></div>;
}

function Detail({ row, evidence, unit, buyers, middlemen, spot, rejects }) {
  if (!row) return <aside className="panel empty">Select an HS8 row to inspect its evidence gates.</aside>;
  const ev = evidence.filter((item) => item.hs8 === row.hs8).slice(0, 8);
  const un = unit.filter((item) => item.hs8 === row.hs8).slice(0, 4);
  const by = buyers.filter((item) => item.hs8 === row.hs8).slice(0, 5);
  const mm = middlemen.filter((item) => item.hs8 === row.hs8).slice(0, 5);
  const sp = spot.filter((item) => item.hs8 === row.hs8).slice(0, 4);
  const rj = rejects.filter((item) => item.hs8 === row.hs8).slice(0, 4);

  return <aside className="panel"><div className="panel-title"><span>HS8 Audit Detail</span><Badge value={row.final_classification} /></div><h2>{row.hs8}</h2><p>{row.commodity}</p><GateStrip row={row} /><div className="detail-grid"><div><span>Normalized margin</span><strong>{pct(row.normalized_margin_pct)}</strong></div><div><span>First test capital</span><strong>{money(row.first_test_capital_inr)}</strong></div><div><span>Blind budget cap</span><strong>{money(row.max_blind_test_budget_inr || 300000)}</strong></div><div><span>Buyer credit</span><strong>{row.buyer_credit_days ? `${row.buyer_credit_days} days` : '-'}</strong></div><div><span>Inventory risk</span><strong>{human(row.inventory_risk)}</strong></div><div><span>Warranty risk</span><strong>{human(row.warranty_replacement_risk)}</strong></div></div><section className="note"><strong>Score notes</strong><p>{row.final_score_notes || row.notes || 'No notes yet.'}</p></section><MiniList title="Evidence refs" empty="No evidence refs yet" rows={ev.map((item) => `${item.source_name || item.evidence_phase || 'Evidence'} | ${human(item.evidence_quality)} | ${human(item.unit_basis)} | ${String(item.checked_at || '').slice(0, 10)}`)} /><MiniList title="Unit and margin audits" empty="No unit checks yet" rows={un.map((item) => `${human(item.unit_match_status)} | ${item.normalized_unit || 'unit n/a'} | ${pct(item.normalized_margin_pct)} | ${human(item.audit_status)}`)} /><MiniList title="Buyer validation" empty="No buyer checks yet" rows={by.map((item) => `${item.buyer_company || 'Buyer path'} | ${human(item.outcome)} | ${money(item.target_price_inr)} | contact via source: ${item.contact_available_via_source ? 'yes' : 'no'}`)} /><MiniList title="Middleman targets" empty="No middleman checks yet" rows={mm.map((item) => `${item.company_name} | ${human(item.buyer_type)} | ${item.city || '-'} | ${human(item.verification_confidence)}`)} /><MiniList title="Spot-buy / rejection" empty="No spot-buy or rejection rows yet" rows={[...sp.map((item) => `${item.product_or_sku || item.product_family || row.hs8} | ${human(item.spot_buy_fit || item.verdict)} | brand risk: ${human(item.brand_risk)}`), ...rj.map((item) => `${item.product_or_sku || row.hs8} | ${human(item.rejection_phase)} | ${item.rejection_reason || '-'}`)]} /></aside>;
}

function MiniList({ title, rows, empty }) {
  return <section className="mini"><strong>{title}</strong>{rows.length ? rows.map((row, index) => <span key={`${title}-${index}`}>{row}</span>) : <span>{empty}</span>}</section>;
}

function Products({ products }) {
  return <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Product</th><th>SKU / Spec</th><th>Proof</th><th>Margin</th><th>Landed</th><th>Buyer Access</th><th>Verdict</th></tr></thead><tbody>{products.map((row) => <tr key={row.id}><td>{row.priority_rank || '-'}</td><td><strong>{row.product_name}</strong><span>{row.research_lane || row.product_family}</span></td><td><strong>{human(row.exact_sku)}</strong><span>{human(row.product_spec)}</span></td><td><Badge value={row.proof_status} /></td><td>{pct(row.gross_margin_pct)}</td><td>{money(row.volza_landed_cost_inr || row.landed_cost_model_inr)}</td><td>{human(row.buyer_access)}</td><td><Badge value={row.verdict} /></td></tr>)}</tbody></table></div>;
}

function Hs8({ hs8 }) {
  return <div className="table-wrap"><table><thead><tr><th>HS8</th><th>Lane</th><th>Score</th><th>Research</th><th>Shipments</th><th>Buyers</th><th>Landed</th><th>Sell</th><th>Margin</th></tr></thead><tbody>{hs8.map((row) => <tr key={row.hs8}><td><strong>{row.hs8}</strong><span>{row.hs4}</span></td><td><strong>{row.research_lane}</strong><span>{row.non_electronics ? 'Adjacent' : 'Electronics'}</span></td><td>{fmt1.format(Number(row.live_score || 0))}</td><td><Badge value={row.computed_research_status} /></td><td>{fmt.format(Number(row.shipment_count || 0))}</td><td>{fmt.format(Number(row.unique_buyers || 0))}</td><td>{money(row.median_landed_cost_inr)}</td><td>{money(row.price_consensus_inr)}</td><td>{pct(row.gross_margin_pct || row.real_margin_pct)}</td></tr>)}</tbody></table></div>;
}

function App() {
  const data = useData();
  const [tab, setTab] = useState('audit');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);

  const filteredAudit = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.audit.filter((row) => !q || [row.hs8, row.hs4, row.commodity, row.pricing_wave, row.final_classification, row.buyer_validation_status].join(' ').toLowerCase().includes(q));
  }, [data.audit, query]);

  const selected = picked || filteredAudit[0];
  const usableEvidence = data.evidence.filter((row) => row.evidence_quality && row.evidence_quality !== 'not_usable').length;
  const buyerPositive = data.buyers.filter((row) => ['buyer_confirmed_price', 'buyer_interested_quote'].includes(row.outcome)).length;
  const stale = data.audit.filter((row) => row.price_research_freshness === 'stale_research').length;

  if (data.loading) return <div className="boot">Loading live Supabase research workspace...</div>;

  return <div className="app"><header><div><h1>Naresh Exim Component Research</h1><p>Evidence-first dashboard for pricing quality, unit normalization, buyer validation and practical winner gates.</p></div><button onClick={data.reload}>Refresh</button></header>{data.error ? <div className="error">{data.error}</div> : null}<section className="metrics"><Metric label="HS8 audit rows" value={fmt.format(data.audit.length)} toneName="blue" /><Metric label="Usable evidence refs" value={fmt.format(usableEvidence)} toneName="green" /><Metric label="Stale research visible" value={fmt.format(stale)} toneName="amber" /><Metric label="Buyer paths positive" value={fmt.format(buyerPositive)} toneName="green" /><Metric label="Middleman rows" value={fmt.format(data.middlemen.length)} toneName="blue" /><Metric label="Rejected / revisit" value={fmt.format(data.rejects.length)} toneName="amber" /></section><nav><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit Gates</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Validated Products</button><button className={tab === 'hs8' ? 'active' : ''} onClick={() => setTab('hs8')}>HS8 Queue</button></nav>{tab === 'audit' ? <><section className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search HS8, commodity, wave, buyer status..." /><span>{fmt.format(filteredAudit.length)} rows</span></section><main className="split"><section><div className="section-title"><h2>Evidence-First Gate Register</h2><span>No winner without evidence, unit, margin, capital and buyer gates.</span></div><AuditTable rows={filteredAudit} selected={selected} onPick={setPicked} /></section><Detail row={selected} evidence={data.evidence} unit={data.unit} buyers={data.buyers} middlemen={data.middlemen} spot={data.spot} rejects={data.rejects} /></main></> : null}{tab === 'products' ? <section><div className="section-title"><h2>Validated Products</h2><span>{fmt.format(data.products.length)} rows</span></div><Products products={data.products} /></section> : null}{tab === 'hs8' ? <section><div className="section-title"><h2>HS8 Research Queue</h2><span>{fmt.format(data.hs8.length)} rows</span></div><Hs8 hs8={data.hs8} /></section> : null}</div>;
}

createRoot(document.getElementById('root')).render(<App />);

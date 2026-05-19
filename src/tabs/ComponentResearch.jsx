import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const fmt0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

const colors = {
  page: '#080d0c',
  panel: '#101816',
  panel2: '#151f1c',
  line: '#263934',
  text: '#edf7f4',
  muted: '#9cafaa',
  cyan: '#5eead4',
  green: '#86efac',
  amber: '#fbbf24',
  red: '#fb7185',
  blue: '#60a5fa'
};

const card = {
  background: colors.panel,
  border: `1px solid ${colors.line}`,
  borderRadius: 8,
  boxShadow: '0 20px 60px rgba(0,0,0,.28)'
};

const button = {
  minHeight: 36,
  border: `1px solid ${colors.line}`,
  borderRadius: 6,
  background: '#0b1210',
  color: colors.text,
  padding: '8px 11px',
  cursor: 'pointer'
};

const field = {
  border: `1px solid ${colors.line}`,
  borderRadius: 6,
  background: '#0b1210',
  color: colors.text,
  padding: '9px 10px',
  minHeight: 38,
  width: '100%'
};

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `INR ${fmt0.format(Number(value))}`;
}

function usd(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `$${fmt1.format(Number(value))}`;
}

function usdMn(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `$${fmt1.format(Number(value))}M`;
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `${fmt1.format(Number(value))}%`;
}

function clean(value) {
  return value || '-';
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('exact') || text.includes('verified') || text.includes('shortlist') || text.includes('winner')) return colors.green;
  if (text.includes('reject') || text.includes('avoid') || text.includes('mismatch') || text.includes('not')) return colors.red;
  if (text.includes('needs') || text.includes('watch') || text.includes('conditional')) return colors.amber;
  return colors.muted;
}

function rowScore(row) {
  return n(row.live_score) + n(row.priority_score) + n(row.hs8_priority_score);
}

function buyerCount(row) {
  return n(row.unique_buyers) + n(row.buyer_count) + n(row.hs8_buyers);
}

function landedCost(row) {
  return n(row.volza_landed_cost_inr) || n(row.landed_cost_model_inr) || n(row.median_landed_cost_inr);
}

function margin(row) {
  return n(row.gross_margin_pct) || n(row.real_margin_pct);
}

function ratio(part, total) {
  const denominator = n(total);
  if (!denominator) return 0;
  return Math.round((n(part) / denominator) * 100);
}

function sortRows(rows, sort) {
  const copy = [...rows];
  if (sort === 'margin_desc') return copy.sort((a, b) => margin(b) - margin(a));
  if (sort === 'landed_asc') return copy.sort((a, b) => landedCost(a) - landedCost(b));
  if (sort === 'buyers_desc') return copy.sort((a, b) => buyerCount(b) - buyerCount(a));
  if (sort === 'shipments_desc') return copy.sort((a, b) => n(b.shipment_count) + n(b.hs8_shipments) - n(a.shipment_count) - n(a.hs8_shipments));
  return copy.sort((a, b) => rowScore(b) - rowScore(a));
}

function Badge({ children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: `1px solid ${tone(children)}55`,
      color: tone(children),
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}>
      {clean(children)}
    </span>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ ...card, padding: 14, borderTop: `3px solid ${color}` }}>
      <div style={{ color: colors.muted, fontSize: 12 }}>{label}</div>
      <div style={{ color, fontSize: 26, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ background: colors.panel2, border: `1px solid ${colors.line}`, borderRadius: 6, padding: 9 }}>
      <div style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{clean(value)}</strong>
    </div>
  );
}

function useResearchData() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    products: [],
    hs8: [],
    refs: [],
    batch: [],
    hs4Coverage: [],
    hs8Coverage: [],
    researchGaps: []
  });

  async function load() {
    setState((old) => ({ ...old, loading: true, error: '' }));
    const [products, hs8, refs, batch, hs4Coverage, hs8Coverage, researchGaps] = await Promise.all([
      supabase.from('component_dashboard_products').select('*').order('priority_rank', { ascending: true }),
      supabase.from('component_dashboard_hs8').select('*').order('live_score', { ascending: false }).limit(1000),
      supabase.from('component_market_price_refs').select('*').order('checked_at', { ascending: false }).limit(500),
      supabase.from('component_next_research_batch').select('*').order('research_rank', { ascending: true }).limit(100),
      supabase.from('component_dashboard_hs4_coverage').select('*').order('research_order', { ascending: true }),
      supabase.from('component_dashboard_hs8_coverage').select('*').order('research_order', { ascending: true }).limit(1500),
      supabase.from('component_dashboard_research_gaps').select('*').order('val_2024_25', { ascending: false }).limit(500)
    ]);
    const error = products.error || hs8.error || refs.error || batch.error || hs4Coverage.error || hs8Coverage.error || researchGaps.error;
    if (error) {
      setState({
        loading: false,
        error: error.message,
        products: [],
        hs8: [],
        refs: [],
        batch: [],
        hs4Coverage: [],
        hs8Coverage: [],
        researchGaps: []
      });
      return;
    }
    setState({
      loading: false,
      error: '',
      products: products.data || [],
      hs8: hs8.data || [],
      refs: refs.data || [],
      batch: batch.data || [],
      hs4Coverage: hs4Coverage.data || [],
      hs8Coverage: hs8Coverage.data || [],
      researchGaps: researchGaps.data || []
    });
  }

  useEffect(() => {
    load();
  }, []);

  return { ...state, reload: load };
}

function Filters({ filters, setFilters, rows, activeTab }) {
  const statusField = activeTab === 'hs8' ? 'computed_research_status' : 'proof_status';
  const lanes = useMemo(() => Array.from(new Set(rows.map((row) => row.research_lane).filter(Boolean))).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row[statusField]).filter(Boolean))).sort(), [rows, statusField]);

  return (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) 190px 230px 185px auto 82px', gap: 10, padding: 12, marginBottom: 14, alignItems: 'center' }}>
      <input style={field} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder={activeTab === 'hs8' ? 'Search HS8, HS4, product family...' : 'Search product, SKU, buyer, source...'} />
      <select style={field} value={filters.lane} onChange={(e) => setFilters({ ...filters, lane: e.target.value })}>
        <option value="ALL">All lanes</option>
        {lanes.map((lane) => <option key={lane} value={lane}>{lane}</option>)}
      </select>
      <select style={field} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
        <option value="ALL">All status</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select style={field} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
        <option value="score_desc">Score high to low</option>
        <option value="margin_desc">Margin high to low</option>
        <option value="landed_asc">Landed cost low to high</option>
        <option value="buyers_desc">Buyers high to low</option>
        <option value="shipments_desc">Shipments high to low</option>
      </select>
      <label style={{ color: colors.muted, display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
        <input type="checkbox" checked={filters.showAdjacent} onChange={(e) => setFilters({ ...filters, showAdjacent: e.target.checked })} />
        Include adjacent
      </label>
      <button style={button} type="button" onClick={() => setFilters({ search: '', lane: 'ALL', status: 'ALL', sort: 'score_desc', showAdjacent: true })}>Reset</button>
    </div>
  );
}

function ProductTable({ rows, selectedId, onSelect }) {
  return (
    <div style={{ ...card, overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
      <table style={{ width: '100%', minWidth: 1030, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Rank', 'Product', 'SKU / Spec', 'Proof', 'Margin', 'Landed', 'Sell price', 'Buyers', 'Verdict'].map((head) => (
              <th key={head} style={th}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect(row.id)} style={{ cursor: 'pointer', background: selectedId === row.id ? '#142420' : 'transparent', borderBottom: `1px solid ${colors.line}` }}>
              <td style={td}>{row.priority_rank || '-'}</td>
              <td style={tdStrong}><strong>{row.product_name}</strong><small>{row.research_lane || row.product_family}</small></td>
              <td style={tdStrong}><strong>{clean(row.exact_sku)}</strong><small>{clean(row.product_spec)}</small></td>
              <td style={td}><Badge>{row.proof_status}</Badge></td>
              <td style={{ ...td, color: margin(row) >= 25 ? colors.green : colors.amber, fontWeight: 800 }}>{pct(row.gross_margin_pct)}</td>
              <td style={td}>{money(row.volza_landed_cost_inr || row.landed_cost_model_inr)}</td>
              <td style={td}>{money(row.india_sell_price_low_inr)} - {money(row.india_sell_price_high_inr)}</td>
              <td style={td}>{fmt0.format(n(row.buyer_count || row.hs8_buyers))}</td>
              <td style={td}><Badge>{row.verdict}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hs8Table({ rows, selectedId, onSelect }) {
  return (
    <div style={{ ...card, overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
      <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['HS8', 'Lane', 'Score', 'Research', 'Shipments', 'Buyers', 'Shippers', 'Landed', 'Sell', 'Margin'].map((head) => (
              <th key={head} style={th}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.hs8} onClick={() => onSelect(row.hs8)} style={{ cursor: 'pointer', background: selectedId === row.hs8 ? '#142420' : 'transparent', borderBottom: `1px solid ${colors.line}` }}>
              <td style={tdStrong}><strong>{row.hs8}</strong><small>{row.hs4}</small></td>
              <td style={tdStrong}><strong>{row.research_lane}</strong><small>{row.non_electronics ? 'Adjacent challenger' : 'Electronics'}</small></td>
              <td style={tdStrong}><strong>{fmt1.format(rowScore(row))}</strong><small>{rowScore(row) >= 75 ? 'High' : rowScore(row) >= 55 ? 'Watch' : 'Low'}</small></td>
              <td style={td}><Badge>{row.computed_research_status}</Badge></td>
              <td style={td}>{fmt0.format(n(row.shipment_count))}</td>
              <td style={td}>{fmt0.format(n(row.unique_buyers))}</td>
              <td style={td}>{fmt0.format(n(row.unique_shippers))}</td>
              <td style={td}>{money(row.median_landed_cost_inr)}</td>
              <td style={td}>{money(row.price_consensus_inr)}</td>
              <td style={{ ...td, color: margin(row) >= 25 ? colors.green : colors.muted, fontWeight: 800 }}>{pct(margin(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '10px 9px',
  textAlign: 'left',
  color: colors.muted,
  background: colors.panel2,
  borderBottom: `1px solid ${colors.line}`,
  whiteSpace: 'nowrap'
};

const td = {
  padding: '9px',
  color: colors.text,
  verticalAlign: 'top'
};

const tdStrong = {
  ...td
};

function ProductDetail({ product, refs, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ manual_status: 'unreviewed', manual_priority: '', manual_notes: '' });

  useEffect(() => {
    if (!product) return;
    setForm({
      manual_status: product.manual_status || 'unreviewed',
      manual_priority: product.manual_priority || '',
      manual_notes: product.manual_notes || ''
    });
  }, [product]);

  if (!product) return <aside style={{ ...card, padding: 20, color: colors.muted }}>Select a product to review exact Volza and marketplace evidence.</aside>;

  const productRefs = refs.filter((ref) => ref.validation_id === product.id);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('component_product_validations').update(form).eq('id', product.id);
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    onSaved();
  }

  return (
    <aside style={{ ...card, padding: 16, position: 'sticky', top: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ color: colors.muted, fontSize: 12 }}>Product Review</span>
        <Badge>{product.proof_status}</Badge>
      </div>
      <h2 style={{ margin: 0, fontSize: 19, lineHeight: 1.2 }}>{product.product_name}</h2>
      <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>{product.product_spec}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
        <DetailItem label="SKU" value={product.exact_sku} />
        <DetailItem label="HS code" value={product.hs8 || product.hs4} />
        <DetailItem label="Volza match" value={product.volza_match_level} />
        <DetailItem label="Margin" value={pct(product.gross_margin_pct)} />
        <DetailItem label="Landed cost" value={money(product.volza_landed_cost_inr || product.landed_cost_model_inr)} />
        <DetailItem label="India price" value={`${money(product.india_sell_price_low_inr)} - ${money(product.india_sell_price_high_inr)}`} />
        <DetailItem label="Market refs" value={String(product.marketplace_ref_count || productRefs.length)} />
        <DetailItem label="Supplier refs" value={String(product.supplier_ref_count || 0)} />
      </div>
      <Evidence title="Volza evidence">{product.volza_evidence}</Evidence>
      <Evidence title="Go / no-go reason">{product.go_no_go_reason}</Evidence>
      <div style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 12, marginTop: 12, display: 'grid', gap: 7 }}>
        <strong style={{ fontSize: 13 }}>Marketplace / Volza references</strong>
        {productRefs.length === 0 && <span style={{ color: colors.muted, fontSize: 13 }}>No references attached yet.</span>}
        {productRefs.map((ref) => (
          <a key={ref.id} href={ref.source_url || '#'} target="_blank" rel="noreferrer" style={{ color: colors.cyan, textDecoration: 'none', background: colors.panel2, border: `1px solid ${colors.line}`, borderRadius: 6, padding: 8 }}>
            <span>{ref.source_name}</span>
            <small style={{ display: 'block', color: colors.muted, marginTop: 3 }}>{ref.exactness} | {money(ref.price_low_inr)} - {money(ref.price_high_inr)}</small>
          </a>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${colors.line}`, marginTop: 14, paddingTop: 14, display: 'grid', gap: 10 }}>
        <label style={label}>Status
          <select style={field} value={form.manual_status} onChange={(e) => setForm({ ...form, manual_status: e.target.value })}>
            <option value="unreviewed">Unreviewed</option>
            <option value="shortlist">Shortlist</option>
            <option value="watch">Watch</option>
            <option value="reject">Reject</option>
            <option value="buyer_check">Buyer check</option>
          </select>
        </label>
        <label style={label}>Priority
          <select style={field} value={form.manual_priority} onChange={(e) => setForm({ ...form, manual_priority: e.target.value })}>
            <option value="">None</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
        <label style={label}>Notes
          <textarea style={{ ...field, minHeight: 90 }} value={form.manual_notes} onChange={(e) => setForm({ ...form, manual_notes: e.target.value })} />
        </label>
        <button style={{ ...button, background: colors.cyan, color: '#06221f', borderColor: colors.cyan, fontWeight: 800 }} type="button" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save review'}</button>
      </div>
    </aside>
  );
}

function Evidence({ title, children }) {
  return (
    <div style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 12, marginTop: 12 }}>
      <strong style={{ display: 'block', fontSize: 13, marginBottom: 5 }}>{title}</strong>
      <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.45, margin: 0 }}>{children || '-'}</p>
    </div>
  );
}

const label = {
  color: colors.muted,
  fontSize: 12,
  display: 'grid',
  gap: 5
};

function Hs8Detail({ row }) {
  if (!row) return <aside style={{ ...card, padding: 20, color: colors.muted }}>Select an HS8 row to inspect landed-cost and marketplace status.</aside>;

  return (
    <aside style={{ ...card, padding: 16, position: 'sticky', top: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ color: colors.muted, fontSize: 12 }}>HS8 Detail</span>
        <Badge>{row.computed_research_status}</Badge>
      </div>
      <h2 style={{ margin: 0, fontSize: 19 }}>{row.hs8}</h2>
      <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>{row.commodity}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
        <DetailItem label="Lane" value={row.research_lane} />
        <DetailItem label="Score" value={fmt1.format(rowScore(row))} />
        <DetailItem label="Shipments" value={fmt0.format(n(row.shipment_count))} />
        <DetailItem label="Buyers" value={fmt0.format(n(row.unique_buyers))} />
        <DetailItem label="Shippers" value={fmt0.format(n(row.unique_shippers))} />
        <DetailItem label="China share" value={pct(row.china_pct)} />
        <DetailItem label="Median FOB" value={usd(row.median_unit_rate_usd)} />
        <DetailItem label="Median landed" value={money(row.median_landed_cost_inr)} />
        <DetailItem label="Consensus sell" value={money(row.price_consensus_inr)} />
        <DetailItem label="Margin" value={pct(margin(row))} />
        <DetailItem label="Price confidence" value={row.price_confidence} />
        <DetailItem label="Regulatory risk" value={row.regulatory_risk} />
      </div>
      <Evidence title="Buyer strategy">{row.target_buyer_layer}</Evidence>
      <Evidence title="Research rule">Do not mark as winner until marketplace product, unit basis and Volza product description are exact or very close.</Evidence>
    </aside>
  );
}

function CoverageBar({ label, value, total, color }) {
  const percent = ratio(value, total);
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: colors.muted, fontSize: 12 }}>
        <span>{label}</span>
        <strong style={{ color: colors.text }}>{fmt0.format(n(value))}/{fmt0.format(n(total))}</strong>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: '#0b1210', border: `1px solid ${colors.line}`, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', minWidth: 2, width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

function CoverageDashboard({ hs4Coverage, researchGaps }) {
  const [filters, setFilters] = useState({ search: '', category: 'ALL', status: 'ALL', sort: 'gaps_desc' });
  const categories = useMemo(() => Array.from(new Set(hs4Coverage.map((row) => row.category_pod).filter(Boolean))).sort(), [hs4Coverage]);
  const statuses = useMemo(() => Array.from(new Set(researchGaps.map((row) => row.coverage_status).filter(Boolean))).sort(), [researchGaps]);

  const filteredHs4 = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const rows = hs4Coverage.filter((row) => {
      if (filters.category !== 'ALL' && row.category_pod !== filters.category) return false;
      if (!query) return true;
      return [row.hs4, row.category_label, row.category_pod, row.core_scope, row.new_importer_fit, row.top_hs8_by_import_value].join(' ').toLowerCase().includes(query);
    });
    const copy = [...rows];
    if (filters.sort === 'import_desc') return copy.sort((a, b) => n(b.total_import_value_2024_25) - n(a.total_import_value_2024_25));
    if (filters.sort === 'coverage_asc') return copy.sort((a, b) => ratio(a.hs8_in_queue, a.total_hs8_codes) - ratio(b.hs8_in_queue, b.total_hs8_codes));
    if (filters.sort === 'price_asc') return copy.sort((a, b) => ratio(a.hs8_price_screened, a.total_hs8_codes) - ratio(b.hs8_price_screened, b.total_hs8_codes));
    return copy.sort((a, b) => n(b.hs8_to_promote) - n(a.hs8_to_promote));
  }, [hs4Coverage, filters]);

  const filteredGaps = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return researchGaps
      .filter((row) => {
        if (filters.category !== 'ALL' && row.category_pod !== filters.category) return false;
        if (filters.status !== 'ALL' && row.coverage_status !== filters.status) return false;
        if (!query) return true;
        return [row.hs8, row.hs4, row.commodity, row.category_label, row.research_lane, row.next_action].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => n(b.val_2024_25) - n(a.val_2024_25));
  }, [researchGaps, filters]);

  const totals = useMemo(() => hs4Coverage.reduce((acc, row) => {
    acc.total += n(row.total_hs8_codes);
    acc.inQueue += n(row.hs8_in_queue);
    acc.priceScreened += n(row.hs8_price_screened);
    acc.validated += n(row.hs8_with_product_validation);
    acc.toPromote += n(row.hs8_to_promote);
    acc.importValue += n(row.total_import_value_2024_25);
    return acc;
  }, { total: 0, inQueue: 0, priceScreened: 0, validated: 0, toPromote: 0, importValue: 0 }), [hs4Coverage]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(320px,.8fr)', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Coverage Map</h2>
          <p style={{ color: colors.muted }}>{fmt0.format(totals.total)} HS8 codes across {fmt0.format(hs4Coverage.length)} electronics and electronics-adjacent HS4 groups.</p>
          <CoverageBar label="In research queue" value={totals.inQueue} total={totals.total} color={colors.cyan} />
          <CoverageBar label="Price screened" value={totals.priceScreened} total={totals.total} color={colors.green} />
          <CoverageBar label="Product validated" value={totals.validated} total={totals.total} color={colors.amber} />
        </div>
        <div style={{ ...card, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Open Gaps</h2>
          <p style={{ color: colors.muted }}>{fmt0.format(totals.toPromote)} HS8 codes still need promotion into the queue or a proper landed-cost row.</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <PlanLine label="Total import value" value={usdMn(totals.importValue)} />
            <PlanLine label="Rows in gap view" value={fmt0.format(researchGaps.length)} />
            <PlanLine label="Filtered gaps" value={fmt0.format(filteredGaps.length)} />
          </div>
        </div>
      </section>

      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) 230px 210px 220px 84px', gap: 10, padding: 12, alignItems: 'center' }}>
        <input style={field} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search HS4, HS8, category, commodity..." />
        <select style={field} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="ALL">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select style={field} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="ALL">All gap status</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select style={field} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
          <option value="gaps_desc">Gaps high to low</option>
          <option value="import_desc">Import value high to low</option>
          <option value="coverage_asc">Queue coverage low to high</option>
          <option value="price_asc">Price coverage low to high</option>
        </select>
        <button style={button} type="button" onClick={() => setFilters({ search: '', category: 'ALL', status: 'ALL', sort: 'gaps_desc' })}>Reset</button>
      </section>

      <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 14, alignItems: 'start' }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: colors.muted }}>
            <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>HS4 Category Coverage</h2>
            <span>{filteredHs4.length} categories</span>
          </div>
          <div style={{ ...card, overflow: 'auto', maxHeight: 460 }}>
            <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['HS4', 'Category', 'Import value', 'Queue', 'Price', 'Validated', 'To promote', 'Fit'].map((head) => <th key={head} style={th}>{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredHs4.map((row) => (
                  <tr key={row.hs4} style={{ borderBottom: `1px solid ${colors.line}` }}>
                    <td style={tdStrong}><strong>{row.hs4}</strong><small>{row.category_pod}</small></td>
                    <td style={tdStrong}><strong>{row.category_label}</strong><small>{row.core_scope}</small></td>
                    <td style={td}>{usdMn(row.total_import_value_2024_25)}</td>
                    <td style={tdStrong}><strong>{ratio(row.hs8_in_queue, row.total_hs8_codes)}%</strong><small>{fmt0.format(n(row.hs8_in_queue))}/{fmt0.format(n(row.total_hs8_codes))} HS8</small></td>
                    <td style={tdStrong}><strong>{ratio(row.hs8_price_screened, row.total_hs8_codes)}%</strong><small>{fmt0.format(n(row.hs8_price_screened))} screened</small></td>
                    <td style={td}>{fmt0.format(n(row.hs8_with_product_validation))}</td>
                    <td style={td}><Badge>{n(row.hs8_to_promote) ? `${fmt0.format(n(row.hs8_to_promote))} needs` : 'complete'}</Badge></td>
                    <td style={td}><Badge>{row.new_importer_fit}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside style={{ ...card, padding: 16, position: 'sticky', top: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ color: colors.muted, fontSize: 12 }}>Next Promotion Queue</span>
            <Badge>{`${Math.min(filteredGaps.length, 12)} shown`}</Badge>
          </div>
          <h2 style={{ margin: 0, fontSize: 19 }}>Missing HS8 To Pull Next</h2>
          <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.45 }}>These are the remaining category gaps to promote before exact marketplace margin checks.</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {filteredGaps.slice(0, 12).map((row) => (
              <div key={row.hs8} style={{ background: colors.panel2, border: `1px solid ${colors.line}`, borderRadius: 6, padding: 10 }}>
                <strong>{row.hs8} | {row.hs4}</strong>
                <span style={{ display: 'block', color: colors.cyan, fontSize: 12, marginTop: 3 }}>{row.category_pod}</span>
                <small style={{ display: 'block', color: colors.muted, fontSize: 12, lineHeight: 1.35, marginTop: 5 }}>{row.commodity}</small>
                <small style={{ display: 'block', color: colors.muted, fontSize: 12, lineHeight: 1.35, marginTop: 5 }}>{row.next_action}</small>
              </div>
            ))}
          </div>
        </aside>
      </main>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: colors.muted }}>
          <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>HS8 Research Gaps</h2>
          <span>{filteredGaps.length} rows</span>
        </div>
        <div style={{ ...card, overflow: 'auto', maxHeight: 460 }}>
          <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['HS8', 'Commodity', 'Category', 'Import value', 'Status', 'Next action'].map((head) => <th key={head} style={th}>{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredGaps.map((row) => (
                <tr key={row.hs8} style={{ borderBottom: `1px solid ${colors.line}` }}>
                  <td style={tdStrong}><strong>{row.hs8}</strong><small>{row.hs4}</small></td>
                  <td style={tdStrong}><strong>{row.commodity}</strong><small>{row.research_lane}</small></td>
                  <td style={tdStrong}><strong>{row.category_pod}</strong><small>{row.category_label}</small></td>
                  <td style={td}>{usdMn(row.val_2024_25)}</td>
                  <td style={td}><Badge>{row.coverage_status}</Badge></td>
                  <td style={td}>{row.next_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResearchPlan({ hs8, batch }) {
  const needs = hs8.filter((row) => row.computed_research_status === 'needs_marketplace_research').length;
  const priceSeen = hs8.filter((row) => row.computed_research_status === 'price_seen_needs_exact_match').length;
  const verified = hs8.filter((row) => row.computed_research_status === 'margin_verified').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 }}>
      <section style={{ ...card, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Research Pipeline</h2>
        <p style={{ color: colors.muted }}>The database now holds queued electronics/component HS8 rows plus adjacent MRO challengers. Winners should come only after exact marketplace checks.</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          <PlanLine label="Needs marketplace research" value={needs} />
          <PlanLine label="Price seen, exact match needed" value={priceSeen} />
          <PlanLine label="Margin verified at HS8 level" value={verified} />
        </div>
      </section>
      <section style={{ ...card, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Batch Order</h2>
        <ol style={{ color: colors.muted, paddingLeft: 20 }}>
          <li>Start with connectors, terminal blocks, cables and industrial spares.</li>
          <li>Verify exact listings on element14, RS, Mouser, Robu, Tanotis, Moglix and IndiaMART.</li>
          <li>Add supplier quotes only after the India sell price clears 25% gross margin.</li>
          <li>Use buyer contacts after shortlist to validate real purchase price.</li>
        </ol>
      </section>
      <section style={{ ...card, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Non-electronics Rule</h2>
        <p style={{ color: colors.muted }}>Adjacent products are challengers only. They must beat electronics on margin, compliance simplicity, buyer access and working capital.</p>
      </section>
      <section style={{ ...card, padding: 18, gridColumn: '1 / -1' }}>
        <h2 style={{ marginTop: 0 }}>Next Research Batch</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          {batch.slice(0, 15).map((row) => (
            <div key={row.hs8} style={{ background: colors.panel2, border: `1px solid ${colors.line}`, borderRadius: 6, padding: 10 }}>
              <strong>{row.research_rank}. {row.hs8}</strong>
              <span style={{ display: 'block', color: colors.cyan, fontSize: 12, marginTop: 3 }}>{row.research_lane}</span>
              <small style={{ display: 'block', color: colors.muted, fontSize: 12, lineHeight: 1.35, marginTop: 5 }}>{row.next_action}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanLine({ label, value }) {
  const displayValue = typeof value === 'number' ? fmt0.format(value) : value;
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: colors.muted, background: colors.panel2, border: `1px solid ${colors.line}`, borderRadius: 6, padding: '8px 10px' }}>
      {label}
      <strong style={{ color: colors.text }}>{displayValue}</strong>
    </span>
  );
}

export default function ComponentResearch() {
  const { loading, error, products, hs8, refs, batch, hs4Coverage, researchGaps, reload } = useResearchData();
  const [activeTab, setActiveTab] = useState('products');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedHs8, setSelectedHs8] = useState(null);
  const [filters, setFilters] = useState({ search: '', lane: 'ALL', status: 'ALL', sort: 'score_desc', showAdjacent: true });

  const activeRows = activeTab === 'hs8' ? hs8 : products;
  const filteredProducts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const rows = products.filter((row) => {
      if (filters.lane !== 'ALL' && row.research_lane !== filters.lane) return false;
      if (filters.status !== 'ALL' && row.proof_status !== filters.status) return false;
      if (!query) return true;
      return [row.product_name, row.exact_sku, row.product_spec, row.target_buyers, row.verdict, row.proof_status].join(' ').toLowerCase().includes(query);
    });
    return sortRows(rows, filters.sort);
  }, [products, filters]);

  const filteredHs8 = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const rows = hs8.filter((row) => {
      if (!filters.showAdjacent && row.non_electronics) return false;
      if (filters.lane !== 'ALL' && row.research_lane !== filters.lane) return false;
      if (filters.status !== 'ALL' && row.computed_research_status !== filters.status) return false;
      if (!query) return true;
      return [row.hs8, row.hs4, row.commodity, row.research_lane, row.marketplace_status].join(' ').toLowerCase().includes(query);
    });
    return sortRows(rows, filters.sort);
  }, [hs8, filters]);

  const selectedProduct = products.find((row) => row.id === selectedProductId) || filteredProducts[0];
  const selectedHs8Row = hs8.find((row) => row.hs8 === selectedHs8) || filteredHs8[0];
  const exactProof = products.filter((row) => String(row.proof_status || '').toLowerCase().includes('exact')).length;
  const tradeable = products.filter((row) => row.is_tradeable_for_new_importer).length;
  const coverageTotal = hs4Coverage.reduce((sum, row) => sum + n(row.total_hs8_codes), 0);
  const openGaps = hs4Coverage.reduce((sum, row) => sum + n(row.hs8_to_promote), 0);

  if (loading) return <div style={{ color: colors.muted, padding: 40 }}>Loading live Supabase research workspace...</div>;

  return (
    <div style={{ padding: 24, background: colors.page, color: colors.text }}>
      <header style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 25 }}>Component Research Workspace</h1>
          <p style={{ margin: '5px 0 0', color: colors.muted, fontSize: 13 }}>Live Supabase view for landed cost, exact marketplace margins and buyer-access review.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: colors.green, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Live database</span>
          <button style={button} type="button" onClick={reload}>Refresh</button>
        </div>
      </header>

      {error && <div style={{ ...card, color: colors.red, padding: 14, marginBottom: 14 }}>{error}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12, marginBottom: 14 }}>
        <Metric label="HS8 queue" value={fmt0.format(hs8.length)} color={colors.cyan} />
        <Metric label="Coverage universe" value={fmt0.format(coverageTotal)} color={colors.cyan} />
        <Metric label="Open HS8 gaps" value={fmt0.format(openGaps)} color={colors.amber} />
        <Metric label="Product validations" value={fmt0.format(products.length)} color={colors.green} />
        <Metric label="Tradeable now" value={fmt0.format(tradeable)} color={colors.green} />
      </section>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          ['products', 'Validated Products'],
          ['hs8', 'HS8 Research Queue'],
          ['coverage', 'Category Coverage'],
          ['plan', 'Execution Plan']
        ].map(([id, labelText]) => (
          <button
            key={id}
            style={activeTab === id ? { ...button, background: colors.cyan, color: '#06221f', borderColor: colors.cyan, fontWeight: 800 } : button}
            type="button"
            onClick={() => setActiveTab(id)}
          >
            {labelText}
          </button>
        ))}
      </nav>

      {(activeTab === 'products' || activeTab === 'hs8') && <Filters filters={filters} setFilters={setFilters} rows={activeRows} activeTab={activeTab} />}

      {activeTab === 'products' && (
        <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 410px', gap: 14, alignItems: 'start' }}>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: colors.muted }}>
              <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>Exact Product Validation</h2>
              <span>{filteredProducts.length} rows</span>
            </div>
            <ProductTable rows={filteredProducts} selectedId={selectedProduct?.id} onSelect={setSelectedProductId} />
          </section>
          <ProductDetail product={selectedProduct} refs={refs} onSaved={reload} />
        </main>
      )}

      {activeTab === 'hs8' && (
        <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 410px', gap: 14, alignItems: 'start' }}>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: colors.muted }}>
              <h2 style={{ color: colors.text, fontSize: 16, margin: 0 }}>All Electronics HS8 Plus Adjacent Challengers</h2>
              <span>{filteredHs8.length} rows</span>
            </div>
            <Hs8Table rows={filteredHs8} selectedId={selectedHs8Row?.hs8} onSelect={setSelectedHs8} />
          </section>
          <Hs8Detail row={selectedHs8Row} />
        </main>
      )}

      {activeTab === 'coverage' && <CoverageDashboard hs4Coverage={hs4Coverage} researchGaps={researchGaps} />}

      {activeTab === 'plan' && <ResearchPlan hs8={hs8} batch={batch} />}
    </div>
  );
}

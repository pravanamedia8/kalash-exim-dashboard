import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchApi } from '../api';
import SearchFilter from '../components/SearchFilter';

const COLORS = ['#4f8cff', '#34d399', '#fbbf24', '#f87171'];

function VerdictBadge({ verdict }) {
  if (!verdict) return '-';
  const v = verdict.toUpperCase();
  if (v === 'PASS') return <span className="badge b-pass">PASS</span>;
  if (v === 'MAYBE') return <span className="badge b-maybe">MAYBE</span>;
  if (v === 'WATCH') return <span className="badge b-watch">WATCH</span>;
  if (v === 'DROP') return <span className="badge b-drop">DROP</span>;
  return <span className="badge">{verdict}</span>;
}

export default function ProductExplorer() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [sortField, setSortField] = useState('score');
  const [page, setPage] = useState(0);
  const [dataSource, setDataSource] = useState('shortlist');
  const PAGE_SIZE = 100;

  useEffect(() => {
    setLoading(true);
    const endpoint = dataSource === 'all' ? 'all_hs4' : 'shortlist';
    fetchApi(endpoint)
      .then(data => setProducts(data.products || []))
      .catch(console.error)
      .finally(() => { setLoading(false); setPage(0); });
  }, [dataSource]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => (b[sortField]||0) - (a[sortField]||0));
  }, [filtered, sortField]);

  const totalPages = Math.ceil(sortedFiltered.length / PAGE_SIZE);
  const displayData = sortedFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const topChartData = useMemo(() => {
    return sortedFiltered.slice(0, 25).map(p => ({ name: `HS${p.hs4}`, score: p.score || p.drill_score || 0 }));
  }, [sortedFiltered]);

  if (loading) return <div className="loading">Loading Product Explorer...</div>;

  return (
    <div>
      <div className="filters" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
        <select className="filter-select" value={dataSource} onChange={e => setDataSource(e.target.value)}>
          <option value="shortlist">Shortlist Only ({products.length} when loaded)</option>
          <option value="all">All 1,123 HS4 Products</option>
        </select>
        <select className="filter-select" value={sortField} onChange={e => setSortField(e.target.value)}>
          <option value="score">Sort: Score</option>
          <option value="drill_score">Sort: Drill Score</option>
          <option value="value_m">Sort: Value</option>
          <option value="val_2024_25">Sort: Value 2024-25</option>
          <option value="growth">Sort: Growth</option>
          <option value="growth_1yr">Sort: Growth 1yr</option>
          <option value="hs8_count">Sort: HS8 Count</option>
        </select>
      </div>
      <SearchFilter
        data={products}
        onFilter={setFiltered}
        searchFields={['hs4', 'hs2', 'commodity', 'category']}
        filters={[
          { key: 'verdict', label: 'Verdict' },
          { key: 'category', label: 'Category' },
        ]}
        placeholder="Search HS4, commodity, category..."
      />

      <div className="kpis">
        <div className="kpi hl"><div className="kpi-lbl">Showing</div><div className="kpi-val">{sortedFiltered.length}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">PASS</div><div className="kpi-val">{sortedFiltered.filter(p=>(p.verdict||'').toUpperCase()==='PASS').length}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">MAYBE</div><div className="kpi-val">{sortedFiltered.filter(p=>(p.verdict||'').toUpperCase()==='MAYBE').length}</div></div>
        <div className="kpi rd"><div className="kpi-lbl">DROP</div><div className="kpi-val">{sortedFiltered.filter(p=>(p.verdict||'').toUpperCase()==='DROP').length}</div></div>
      </div>

      {topChartData.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">Top 25 Products by Score</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" angle={-30} textAnchor="end" height={60} fontSize={10} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="score" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-title">Products — Page {page+1} of {totalPages} ({displayData.length} of {sortedFiltered.length})</div>
        <table>
          <thead>
            <tr><th>HS4</th><th>HS2</th><th>Product</th><th>Category</th><th>Value $M</th><th>Growth %</th><th>Score</th><th>Verdict</th><th>Tier</th><th>BCD %</th><th>HS8s</th></tr>
          </thead>
          <tbody>
            {displayData.map((p, idx) => (
              <tr key={idx}>
                <td>{p.hs4}</td>
                <td>{p.hs2}</td>
                <td>{p.commodity || '-'}</td>
                <td>{p.category || '-'}</td>
                <td>${(p.value_m || p.val_2024_25 || 0).toFixed(1)}M</td>
                <td style={{color:(p.growth||p.growth_1yr||0)>0?'#34d399':'#f87171'}}>{(p.growth || p.growth_1yr || 0).toFixed(1)}%</td>
                <td style={{fontWeight:700}}>{(p.score || p.drill_score || 0).toFixed(1)}</td>
                <td><VerdictBadge verdict={p.verdict} /></td>
                <td><span style={{fontSize:10}}>{p.entry_tier || '-'}</span></td>
                <td>{(p.bcd || p.bcd_rate || 0).toFixed(1)}%</td>
                <td>{p.hs8_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center',flexWrap:'wrap'}}>
            <button onClick={() => setPage(Math.max(0,page-1))} disabled={page===0}
              style={{padding:'6px 14px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}>Prev</button>
            {Array.from({length: Math.min(totalPages, 10)}, (_, i) => {
              const p = totalPages <= 10 ? i : (page < 5 ? i : page > totalPages-6 ? totalPages-10+i : page-5+i);
              return <button key={p} onClick={() => setPage(p)}
                style={{padding:'6px 10px',background:p===page?'var(--blue)':'var(--bg3)',color:p===page?'#fff':'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer',fontSize:12}}>{p+1}</button>;
            })}
            <button onClick={() => setPage(Math.min(totalPages-1,page+1))} disabled={page>=totalPages-1}
              style={{padding:'6px 14px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

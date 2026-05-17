import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis } from 'recharts';
import SearchFilter from '../components/SearchFilter';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const tierColors = {
  'TIER_1_PREMIUM':'#f59e0b','TIER_2_HIGH':'#34d399','TIER_3_SOLID':'#60a5fa','TIER_4_MODERATE':'#a78bfa'
};
const tierLabels = {
  'TIER_1_PREMIUM':'Premium','TIER_2_HIGH':'High Value','TIER_3_SOLID':'Solid','TIER_4_MODERATE':'Moderate'
};

const fmt = (n) => {
  if (n == null) return '—';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
};
const fmtINR = (n) => {
  if (n == null) return '—';
  if (n >= 1e7) return '₹' + (n/1e7).toFixed(1) + 'Cr';
  if (n >= 1e5) return '₹' + (n/1e5).toFixed(1) + 'L';
  if (n >= 1e3) return '₹' + (n/1e3).toFixed(1) + 'K';
  return '₹' + Math.round(n);
};

export default function HS8Shortlist() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sfFiltered, setSfFiltered] = useState([]);
  const [sort, setSort] = useState({col:'shortlist_rank',dir:'asc'});
  const [view, setView] = useState('table');

  useEffect(() => {
    supabase.from('hs8_margin_analysis')
      .select('*')
      .eq('shortlisted', true)
      .order('shortlist_rank', {ascending: true})
      .then(({data: d}) => { setData(d || []); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let f = [...sfFiltered];
    if (sort.col) {
      f.sort((a,b) => {
        const av = a[sort.col], bv = b[sort.col];
        if (av == null) return 1; if (bv == null) return -1;
        return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return f;
  }, [sfFiltered, sort]);

  const doSort = (col) => setSort(s => ({col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc'}));
  const arrow = (col) => sort.col===col ? (sort.dir==='asc' ? ' ↑' : ' ↓') : '';

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading shortlist...</div>;

  // KPIs
  const totalProducts = data.length;
  const totalCIF = data.reduce((a,r) => a + (r.total_cif_usd||0), 0);
  const avgMargin = data.length ? (data.reduce((a,r) => a + (r.real_margin_pct||0), 0) / data.length) : 0;
  const tier1 = data.filter(r => r.shortlist_tier === 'TIER_1_PREMIUM');
  const tier2 = data.filter(r => r.shortlist_tier === 'TIER_2_HIGH');
  const tier3 = data.filter(r => r.shortlist_tier === 'TIER_3_SOLID');
  const unitMatched = data.filter(r => r.unit_matched).length;
  const uniqueHS4 = [...new Set(data.map(r => r.hs4))].length;

  // Chart data
  const tierPie = [
    {name:'Premium', value:tier1.length, fill:'#f59e0b', cif: tier1.reduce((a,r)=>a+(r.total_cif_usd||0),0)},
    {name:'High Value', value:tier2.length, fill:'#34d399', cif: tier2.reduce((a,r)=>a+(r.total_cif_usd||0),0)},
    {name:'Solid', value:tier3.length, fill:'#60a5fa', cif: tier3.reduce((a,r)=>a+(r.total_cif_usd||0),0)},
  ];

  const top20Bar = data.slice(0,20).map(r => ({
    name: r.hs8,
    margin: r.real_margin_pct||0,
    fill: tierColors[r.shortlist_tier] || '#60a5fa'
  }));

  const hs4Groups = {};
  data.forEach(r => {
    if (!hs4Groups[r.hs4]) hs4Groups[r.hs4] = {hs4:r.hs4, count:0, totalCIF:0, avgMargin:0, margins:[]};
    hs4Groups[r.hs4].count++;
    hs4Groups[r.hs4].totalCIF += (r.total_cif_usd||0);
    hs4Groups[r.hs4].margins.push(r.real_margin_pct||0);
  });
  const hs4List = Object.values(hs4Groups).map(g => ({...g, avgMargin: g.margins.reduce((a,b)=>a+b,0)/g.margins.length})).sort((a,b) => b.totalCIF - a.totalCIF);
  const uniqueHS4s = ['ALL', ...hs4List.map(g => g.hs4)];

  const scatterData = data.map(r => ({
    x: r.real_margin_pct||0, y: r.total_cif_usd||0, z: r.unique_buyers||1,
    name: r.hs8, tier: r.shortlist_tier, commodity: (r.commodity||'').slice(0,30)
  }));

  const kpis = [
    {label:'Shortlisted Products', value:totalProducts, color:'#34d399'},
    {label:'Total CIF Value', value:fmt(totalCIF), color:'#60a5fa'},
    {label:'Avg Margin', value:avgMargin.toFixed(1)+'%', color:'#f59e0b'},
    {label:'Premium (Tier 1)', value:tier1.length, color:'#f59e0b'},
    {label:'High Value (Tier 2)', value:tier2.length, color:'#34d399'},
    {label:'Solid (Tier 3)', value:tier3.length, color:'#60a5fa'},
    {label:'Unit Verified', value:Math.round(unitMatched/totalProducts*100)+'%', color:'#a78bfa'},
    {label:'HS4 Categories', value:uniqueHS4, color:'#94a3b8'},
  ];

  return (
    <div style={{padding:'0 20px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h2 style={{margin:0,color:'#e2e8f0',fontSize:22}}>🏆 HS8 Product Shortlist</h2>
          <div style={{color:'#94a3b8',fontSize:13,marginTop:4}}>Quality-filtered winners ranked by margin × market size composite score</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {['table','charts','categories'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'6px 14px', borderRadius:8, border:'1px solid rgba(148,163,184,0.2)',
              background: view===v ? 'rgba(96,165,250,0.2)' : 'transparent',
              color: view===v ? '#60a5fa' : '#94a3b8', cursor:'pointer', fontSize:13
            }}>{v==='table'?'📋 Table':v==='charts'?'📊 Charts':'📁 By HS4'}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:12,marginBottom:20}}>
        {kpis.map(k => (
          <div key={k.label} style={{...card,textAlign:'center',padding:14}}>
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {view === 'charts' && (
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:20}}>
          <div style={card}>
            <h3 style={{color:'#e2e8f0',margin:'0 0 12px',fontSize:15}}>Top 20 Products by Margin %</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top20Bar}>
                <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} angle={-45} textAnchor="end" height={60}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} domain={[0,100]}/>
                <Tooltip contentStyle={{background:'#1a2035',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8}} labelStyle={{color:'#e2e8f0'}} formatter={(v)=>[v.toFixed(1)+'%','Margin']}/>
                <Bar dataKey="margin" radius={[4,4,0,0]}>
                  {top20Bar.map((e,i) => <Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <h3 style={{color:'#e2e8f0',margin:'0 0 12px',fontSize:15}}>Tier Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={tierPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>`${name}: ${value}`}>
                  {tierPie.map((e,i) => <Cell key={i} fill={e.fill}/>)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a2035',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8}}
                  formatter={(v,n,p)=>[`${v} products | ${fmt(p.payload.cif)} CIF`,'']}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{marginTop:8}}>
              {tierPie.map(t => (
                <div key={t.name} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                  <span style={{color:t.fill,fontSize:13}}>● {t.name}</span>
                  <span style={{color:'#94a3b8',fontSize:13}}>{t.value} products · {fmt(t.cif)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'categories' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12,marginBottom:20}}>
          {hs4List.map(g => (
            <div key={g.hs4} style={{...card,padding:16,cursor:'pointer',transition:'all 0.2s'}} onClick={()=>{ setView('table'); }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{color:'#60a5fa',fontWeight:600,fontSize:15}}>HS4 {g.hs4}</span>
                <span style={{color:'#34d399',fontSize:14,fontWeight:600}}>{g.count} products</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8'}}>
                <span>Avg Margin: <span style={{color: g.avgMargin > 40 ? '#34d399' : g.avgMargin > 25 ? '#60a5fa' : '#fbbf24'}}>{g.avgMargin.toFixed(1)}%</span></span>
                <span>CIF: {fmt(g.totalCIF)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'table' && (
        <>
          <SearchFilter data={data} onFilter={setSfFiltered} searchFields={['hs8','hs4','commodity']} filters={[{key:'shortlist_tier',label:'Tier'},{key:'hs4',label:'HS4'}]} placeholder="Search HS8, HS4, or product..." />

          {/* Table */}
          <div style={{...card,padding:0,overflow:'auto',maxHeight:'65vh'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
              <thead>
                <tr style={{background:'rgba(17,24,39,0.9)',position:'sticky',top:0,zIndex:1}}>
                  {[
                    {key:'shortlist_rank',label:'#',w:40},
                    {key:'shortlist_tier',label:'Tier',w:90},
                    {key:'hs8',label:'HS8',w:85},
                    {key:'hs4',label:'HS4',w:50},
                    {key:'commodity',label:'Product',w:220},
                    {key:'real_margin_pct',label:'Margin%',w:75},
                    {key:'median_landed_cost_inr',label:'Landed ₹',w:85},
                    {key:'price_consensus_inr',label:'Sell ₹',w:80},
                    {key:'real_margin_inr',label:'Margin ₹',w:80},
                    {key:'total_cif_usd',label:'CIF ($)',w:90},
                    {key:'shipment_count',label:'Ships',w:55},
                    {key:'unique_buyers',label:'Buyers',w:55},
                    {key:'dominant_unit',label:'Unit',w:50},
                    {key:'unit_matched',label:'✓',w:30},
                    {key:'price_confidence',label:'Conf',w:55},
                  ].map(c => (
                    <th key={c.key} onClick={()=>doSort(c.key)} style={{
                      padding:'10px 6px',color:'#94a3b8',fontWeight:600,cursor:'pointer',textAlign:'left',
                      borderBottom:'1px solid rgba(148,163,184,0.1)',width:c.w,whiteSpace:'nowrap',userSelect:'none'
                    }}>{c.label}{arrow(c.key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const tc = tierColors[r.shortlist_tier] || '#94a3b8';
                  const mc = r.real_margin_pct >= 50 ? '#34d399' : r.real_margin_pct >= 30 ? '#60a5fa' : '#fbbf24';
                  return (
                    <tr key={r.hs8} style={{borderBottom:'1px solid rgba(148,163,184,0.05)',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(96,165,250,0.05)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'8px 6px',color:'#94a3b8',fontWeight:600}}>{r.shortlist_rank}</td>
                      <td style={{padding:'8px 6px'}}>
                        <span style={{padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600,
                          background:`${tc}22`,color:tc,border:`1px solid ${tc}44`}}>
                          {tierLabels[r.shortlist_tier]||r.shortlist_tier}
                        </span>
                      </td>
                      <td style={{padding:'8px 6px',color:'#e2e8f0',fontFamily:'monospace',fontWeight:600}}>{r.hs8}</td>
                      <td style={{padding:'8px 6px',color:'#94a3b8'}}>{r.hs4}</td>
                      <td style={{padding:'8px 6px',color:'#e2e8f0',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.commodity}>{(r.commodity||'').slice(0,40)}</td>
                      <td style={{padding:'8px 6px',color:mc,fontWeight:700}}>{r.real_margin_pct?.toFixed(1)}%</td>
                      <td style={{padding:'8px 6px',color:'#f87171'}}>{fmtINR(r.median_landed_cost_inr)}</td>
                      <td style={{padding:'8px 6px',color:'#34d399'}}>{fmtINR(r.price_consensus_inr)}</td>
                      <td style={{padding:'8px 6px',color:'#fbbf24'}}>{fmtINR(r.real_margin_inr)}</td>
                      <td style={{padding:'8px 6px',color:'#60a5fa'}}>{fmt(r.total_cif_usd)}</td>
                      <td style={{padding:'8px 6px',color:'#94a3b8'}}>{(r.shipment_count||0).toLocaleString()}</td>
                      <td style={{padding:'8px 6px',color:'#94a3b8'}}>{(r.unique_buyers||0).toLocaleString()}</td>
                      <td style={{padding:'8px 6px',color:'#94a3b8',fontSize:11}}>{r.dominant_unit}</td>
                      <td style={{padding:'8px 6px'}}>{r.unit_matched ? '✅' : '⚠️'}</td>
                      <td style={{padding:'8px 6px'}}>
                        <span style={{fontSize:11,color: r.price_confidence==='HIGH'?'#34d399':r.price_confidence==='MEDIUM'?'#fbbf24':'#f87171'}}>
                          {r.price_confidence}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

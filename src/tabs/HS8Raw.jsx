import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../supabaseClient';
import SearchFilter from '../components/SearchFilter';

const HS8Raw = () => {
  const [hs8Data, setHs8Data] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sort and pagination states
  const [sortConfig, setSortConfig] = useState({ key: 'val_2024_25', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('hs8_raw').select('*').order('val_2024_25', { ascending: false });
        if (error) throw error;
        setHs8Data(data || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Data will appear here as research progresses');
        console.error('Error loading HS8 raw data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Sort data
  const sortedData = [...filtered].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortConfig.direction === 'desc' ? -comparison : comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate KPIs
  const totalHs8 = hs8Data.length;
  const withTradeValue = hs8Data.filter((item) => (item.val_2024_25 || 0) > 0).length;
  const highGrowth = hs8Data.filter((item) => (item.growth_1yr || 0) > 50).length;
  const negativeGrowth = hs8Data.filter((item) => (item.growth_1yr || 0) < 0).length;
  const zeroValue = hs8Data.filter((item) => (item.val_2024_25 || 0) === 0 || item.val_2024_25 === null).length;

  // Get top 30 for chart
  const top30Data = [...hs8Data]
    .sort((a, b) => (b.val_2024_25 || 0) - (a.val_2024_25 || 0))
    .slice(0, 30)
    .map((item) => ({
      name: item.commodity ? item.commodity.substring(0, 40) : `HS8: ${item.hs8}`,
      value: item.val_2024_25 || 0,
      hs8: item.hs8,
    }));

  // Handle column sort
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
    setCurrentPage(1);
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return '$0M';
    return `$${(value).toFixed(2)}M`;
  };

  // Format percentage
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '0%';
    return `${(value).toFixed(1)}%`;
  };

  // Get growth color
  const getGrowthColor = (value) => {
    if (value === null || value === undefined) return '#6b7280';
    return value > 0 ? '#34d399' : '#f87171';
  };

  if (loading) {
    return <div className="loading">⏳ Loading HS8 Raw Data...</div>;
  }

  if (error) {
    return <div className="loading" style={{ color: '#f87171' }}>❌ Error: {error}</div>;
  }

  return (
    <div className="hs8-raw">
      {/* KPI Cards */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">📋 Total HS8 Products</div>
          <div className="kpi-val">{totalHs8.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">💲 With Trade Value &gt;0</div>
          <div className="kpi-val" style={{ color: '#4f8cff' }}>{withTradeValue.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">📈 High Growth (&gt;50%)</div>
          <div className="kpi-val" style={{ color: '#34d399' }}>{highGrowth}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">📉 Negative Growth</div>
          <div className="kpi-val" style={{ color: '#f87171' }}>{negativeGrowth}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">⚪ Zero Value</div>
          <div className="kpi-val" style={{ color: '#9ca3af' }}>{zeroValue}</div>
        </div>
      </div>

      {/* Filters Row */}
      <SearchFilter
        data={hs8Data}
        onFilter={setFiltered}
        searchFields={['hs8', 'hs6', 'hs4', 'hs2', 'commodity']}
        filters={[
          { key: 'hs2', label: 'HS2' },
          { key: 'hs4', label: 'HS4' },
        ]}
        placeholder="Search by HS8/HS6/HS4/HS2 code or commodity..."
      />

      {/* Top 30 Chart */}
      <div className="chart-container">
        <h3 className="chart-title">📊 Top 30 HS8 Products by Trade Value (2024-25)</h3>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={top30Data} layout="vertical" margin={{ top: 5, right: 30, left: 400, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={390} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx)' }}
            />
            <Bar dataKey="value" fill="#4f8cff" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full Table */}
      <div className="card">
        <h3 className="card-title">
          All HS8 Products
          {' '}
          ({sortedData.length.toLocaleString()})
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('hs8')} style={{ cursor: 'pointer' }}>
                  HS8
                  {' '}
                  {sortConfig.key === 'hs8' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('hs6')} style={{ cursor: 'pointer' }}>
                  HS6
                  {' '}
                  {sortConfig.key === 'hs6' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('hs4')} style={{ cursor: 'pointer' }}>
                  HS4
                  {' '}
                  {sortConfig.key === 'hs4' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('hs2')} style={{ cursor: 'pointer' }}>
                  HS2
                  {' '}
                  {sortConfig.key === 'hs2' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('commodity')} style={{ cursor: 'pointer' }}>
                  Commodity
                  {' '}
                  {sortConfig.key === 'commodity' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('val_2021_22')} style={{ cursor: 'pointer' }}>
                  Val 2021-22 $M
                  {' '}
                  {sortConfig.key === 'val_2021_22' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('val_2022_23')} style={{ cursor: 'pointer' }}>
                  Val 2022-23 $M
                  {' '}
                  {sortConfig.key === 'val_2022_23' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('val_2023_24')} style={{ cursor: 'pointer' }}>
                  Val 2023-24 $M
                  {' '}
                  {sortConfig.key === 'val_2023_24' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('val_2024_25')} style={{ cursor: 'pointer' }}>
                  Val 2024-25 $M
                  {' '}
                  {sortConfig.key === 'val_2024_25' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('growth_1yr')} style={{ cursor: 'pointer' }}>
                  Growth 1yr %
                  {' '}
                  {sortConfig.key === 'growth_1yr' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('growth_3yr_cagr')} style={{ cursor: 'pointer' }}>
                  CAGR 3yr %
                  {' '}
                  {sortConfig.key === 'growth_3yr_cagr' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{String(item.hs8).padStart(8, '0')}</td>
                  <td>{item.hs6}</td>
                  <td>{item.hs4}</td>
                  <td>{item.hs2}</td>
                  <td>{item.commodity ? item.commodity.substring(0, 50) : 'N/A'}</td>
                  <td>{formatCurrency(item.val_2021_22)}</td>
                  <td>{formatCurrency(item.val_2022_23)}</td>
                  <td>{formatCurrency(item.val_2023_24)}</td>
                  <td style={{ fontWeight: 'bold' }}>{formatCurrency(item.val_2024_25)}</td>
                  <td style={{ color: getGrowthColor(item.growth_1yr), fontWeight: 'bold' }}>
                    {formatPercent(item.growth_1yr)}
                  </td>
                  <td style={{ color: getGrowthColor(item.growth_3yr_cagr), fontWeight: 'bold' }}>
                    {formatPercent(item.growth_3yr_cagr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Info */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>
            Showing
            {' '}
            {sortedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            {' '}
            -
            {' '}
            {Math.min(currentPage * itemsPerPage, sortedData.length)}
            {' '}
            of
            {' '}
            {sortedData.length.toLocaleString()}
            {' '}
            products
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: currentPage === page ? 'none' : '1px solid rgba(59,130,246,0.15)',
                  backgroundColor: currentPage === page ? '#4f8cff' : 'var(--bg3)',
                  color: currentPage === page ? 'white' : 'var(--tx)',
                  cursor: 'pointer',
                  fontWeight: currentPage === page ? '600' : '400',
                  fontSize: '13px',
                }}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hs8-raw {
          padding: 20px;
          color: var(--tx);
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 30px;
        }

        .kpi {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .kpi-lbl {
          font-size: 12px;
          color: var(--tx2);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .kpi-val {
          font-size: 24px;
          font-weight: bold;
          color: var(--tx);
        }

        .filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .filter-input,
        .filter-select {
          padding: 10px 12px;
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          background: var(--bg2);
          color: var(--tx);
        }

        .filter-input {
          flex: 1;
          min-width: 250px;
        }

        .filter-input:focus,
        .filter-select:focus {
          outline: none;
          border-color: #4f8cff;
          box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
        }

        .card {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .card-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--tx);
          margin-bottom: 16px;
        }

        .chart-container {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--tx);
          margin-bottom: 16px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table thead {
          background: rgba(26,32,53,0.8);
          border-bottom: 2px solid rgba(59,130,246,0.2);
        }

        .data-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: var(--tx);
          user-select: none;
        }

        .data-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(37,42,54,0.5);
          color: var(--tx);
        }

        .data-table tbody tr:hover {
          background: rgba(26,32,53,0.8);
        }

        .loading {
          padding: 40px;
          text-align: center;
          font-size: 16px;
          color: var(--tx2);
        }
      `}</style>
    </div>
  );
};

export default HS8Raw;

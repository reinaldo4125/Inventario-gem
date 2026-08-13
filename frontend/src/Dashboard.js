import GraficaBarraPendientesFacturadas from './GraficaBarraPendientesFacturadas';
import GraficaBarra from './GraficaBarra';
import GraficaPie from './GraficaPie';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import ClienteSelect from './ClienteSelect';
import { Bar, Pie } from 'react-chartjs-2';
import inyectorImg from './IMG/inyectores.jpg';
import microfiltroImg from './IMG/microfiltros.jpg';
import bombaImg from './IMG/bombas.jpg';

import './chartjs-setup';
import DashboardKPIs from './DashboardKPIs';
import DashboardFiltros from './DashboardFiltros';
// importación duplicada eliminada
import { formatCurrency } from './utils/formatters';

function Dashboard({ usuario, onNavigate }) {
  // Ventas pendientes vs facturadas por día
  const [pendFactLabels, setPendFactLabels] = useState([]);
  const [pendFactPendientes, setPendFactPendientes] = useState([]);
  const [pendFactFacturadas, setPendFactFacturadas] = useState([]);
  const [pendFactLoading, setPendFactLoading] = useState(false);
  const [pendFactError, setPendFactError] = useState(null);
  // Net revenue trend
  const [netRevenue, setNetRevenue] = useState({ labels: [], data: [] });
  const [netGroup, setNetGroup] = useState('day'); // 'day' or 'month'

  // Obtener usuario desde localStorage para asegurar filtro correcto
  const usuarioLS = useMemo(() => JSON.parse(localStorage.getItem('usuario') || '{}'), []);
  // Estado de almacenes y almacén seleccionado
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState('');
  // Filtros
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', vendedor: '', cliente: '' });

  // Helper para obtener el almacenId seleccionado
  const selectedAlmacenId = useMemo(() => {
    if (usuarioLS && usuarioLS.rol === 'vendedor' && usuarioLS.almacenId) return usuarioLS.almacenId;
    if (usuario?.rol === 'admin' && almacenSeleccionado) return almacenSeleccionado;
    return '';
  }, [usuario?.rol, almacenSeleccionado, usuarioLS]);

  const buildQuery = (extraParams = []) => {
    const params = [...extraParams];
    if (selectedAlmacenId) params.push(`almacenId=${selectedAlmacenId}`);
    return params.length ? '?' + params.join('&') : '';
  };

  useEffect(() => {
    setPendFactLoading(true);
    setPendFactError(null);
  const params = [];
  if (filtros.desde) params.push(`desde=${filtros.desde}`);
  if (filtros.hasta) params.push(`hasta=${filtros.hasta}`);
  if (filtros.vendedor) params.push(`vendedor=${encodeURIComponent(filtros.vendedor)}`);
  if (filtros.cliente) params.push(`cliente=${encodeURIComponent(filtros.cliente)}`);
  // use the stable selectedAlmacenId helper instead of mixing usuarioLS/almacenSeleccionado
  if (selectedAlmacenId) params.push(`almacenId=${selectedAlmacenId}`);
  const query = params.length ? '?' + params.join('&') : '';
  const tokenPF = localStorage.getItem('token');
  const urlPend = `/api/reportes/ventas-pendientes-vs-facturadas${query}`;
  console.debug('[Dashboard] fetching pendientes vs facturadas ->', urlPend);
  fetch(urlPend, { headers: { 'Authorization': tokenPF ? `Bearer ${tokenPF}` : '' } })
      .then(res => res.json())
      .then(data => {
        if (!data || typeof data !== 'object') throw new Error('Sin datos');
        const dias = Object.keys(data).sort();
        setPendFactLabels(dias);
        setPendFactPendientes(dias.map(d => data[d].Pendiente || 0));
        setPendFactFacturadas(dias.map(d => data[d].Pagada || 0));
      })
      .catch(() => {
        setPendFactLabels([]);
        setPendFactPendientes([]);
        setPendFactFacturadas([]);
        setPendFactError('No se pudo cargar la gráfica de pendientes vs facturadas');
      })
      .finally(() => setPendFactLoading(false));
  }, [filtros, selectedAlmacenId, usuario?.rol]);
  const debounceTimeout = useRef();

  // KPIs rápidos
  const [kpis, setKpis] = useState({ ventasHoy: 0, ingresosHoy: 0, ingresosMes: 0, ticketPromedio: 0, productosCriticos: 0 });
  const [stockPorAlmacen, setStockPorAlmacen] = useState([]);
  useEffect(() => {
    async function fetchKpis() {
      try {
        const token = localStorage.getItem('token');
        const url = '/api/dashboard/kpis' + (selectedAlmacenId ? `?almacenId=${selectedAlmacenId}` : '');
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al obtener KPIs');
        const data = await res.json();
        setKpis(data);
      } catch (err) {
        // No interrumpe el dashboard si falla
      }
    }
    fetchKpis();
  }, [selectedAlmacenId, usuario?.rol]);
  const [vendedores, setVendedores] = useState([]);
  const [clientesList, setClientesList] = useState([]);

  // Cargar vendedores y clientes para los selectores
  useEffect(() => {
    const token = localStorage.getItem('token');
    // Solo cargar usuarios si es admin (evita 403 en consola para vendedores)
    const usuarioLS = JSON.parse(localStorage.getItem('usuario') || '{}');
    console.debug('[Dashboard] cargar selectores - token present?', !!token, 'usuarioLS:', usuarioLS);
    if (usuarioLS?.rol === 'admin') {
      fetch('/usuarios', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })
        .then(res => { console.debug('[Dashboard] /usuarios status', res.status); return res.json(); })
        .then(data => {
          if (Array.isArray(data)) {
            setVendedores(data.filter(u => u.rol === 'admin' || u.rol === 'vendedor'));
          } else {
            setVendedores([]);
          }
        }).catch(err => { console.error('[Dashboard] error fetching /usuarios', err); });
    }
    fetch('/clientes', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
      .then(res => res.json())
      .then(data => setClientesList(Array.isArray(data) ? data : []));
    // Cargar almacenes para el selector
    // Cargar almacenes solo si es admin o vendedor (vendedor necesita almacén)
    const usuarioLS2 = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuarioLS2?.rol === 'admin' || usuarioLS2?.rol === 'vendedor') {
      fetch('/almacenes', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      }).then(res => { console.debug('[Dashboard] /almacenes status', res.status); return res.json(); })
        .then(data => setAlmacenes(Array.isArray(data) ? data : [])).catch(err => { console.error('[Dashboard] error fetching /almacenes', err); });
    }
  }, [usuario?.rol]);
  // Clientes principales
  const [clientesTop, setClientesTop] = useState({ labels: [], data: [] });
  const [clientesTopLoading, setClientesTopLoading] = useState(false);
  const [clientesTopError, setClientesTopError] = useState(null);
  // Métodos de pago más usados
  const [metodosPago, setMetodosPago] = useState({ labels: [], data: [] });
  const [metodosPagoLoading, setMetodosPagoLoading] = useState(false);
  const [metodosPagoError, setMetodosPagoError] = useState(null);

  // Refrescar datos al cambiar almacén (admin) o almacén asignado (vendedor)
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      const params = [];
      if (filtros.desde) params.push(`desde=${filtros.desde}`);
      if (filtros.hasta) params.push(`hasta=${filtros.hasta}`);
      if (filtros.vendedor) params.push(`vendedor=${encodeURIComponent(filtros.vendedor)}`);
      if (filtros.cliente) params.push(`cliente=${encodeURIComponent(filtros.cliente)}`);
      // if a vendedor is logged, include their name as a filter
      if (usuarioLS && usuarioLS.rol === 'vendedor' && usuarioLS.nombre) {
        params.push(`vendedor=${encodeURIComponent(usuarioLS.nombre)}`);
      }
      // build query using the stable selectedAlmacenId helper
      let query = '';
      if (selectedAlmacenId) {
        query = `?almacenId=${selectedAlmacenId}` + (params.length ? `&${params.join('&')}` : '');
      } else {
        query = params.length ? `?${params.join('&')}` : '';
      }

      // Clientes principales
      async function fetchClientesTop() {
        setClientesTopLoading(true);
        setClientesTopError(null);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/reportes/ventas-agrupadas?agrupacion=cliente${query}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
          if (!res.ok) throw new Error('Error al obtener clientes principales');
          const data = await res.json();
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const labels = Object.keys(data);
            const valores = labels.map(c => data[c].total);
            setClientesTop({ labels, data: valores });
          } else {
            setClientesTop({ labels: [], data: [] });
          }
        } catch (err) {
          setClientesTop({ labels: [], data: [] });
          setClientesTopError('No se pudieron cargar los clientes principales');
        } finally {
          setClientesTopLoading(false);
        }
      }
      fetchClientesTop();

      // Métodos de pago
      async function fetchMetodosPago() {
        setMetodosPagoLoading(true);
        setMetodosPagoError(null);
        try {
          const tokenMP = localStorage.getItem('token');
          const res = await fetch(`/api/reportes/ventas-agrupadas?agrupacion=metodoPago${query}`, { headers: { 'Authorization': tokenMP ? `Bearer ${tokenMP}` : '' } });
          if (!res.ok) throw new Error('Error al obtener métodos de pago');
          const data = await res.json();
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const labels = Object.keys(data);
            const valores = labels.map(m => data[m].cantidad);
            setMetodosPago({ labels, data: valores });
          } else {
            setMetodosPago({ labels: [], data: [] });
          }
        } catch (err) {
          setMetodosPago({ labels: [], data: [] });
          setMetodosPagoError('No se pudieron cargar los métodos de pago');
        } finally {
          setMetodosPagoLoading(false);
        }
      }
      fetchMetodosPago();

      // Ventas mensuales
      async function fetchVentasMensuales() {
        try {
          const tokenVM = localStorage.getItem('token');
          const res = await fetch(`/api/reportes/ventas-agrupadas?agrupacion=mes${query}`, { headers: { 'Authorization': tokenVM ? `Bearer ${tokenVM}` : '' } });
          if (!res.ok) throw new Error('Error al obtener ventas mensuales');
          const data = await res.json();
          const labels = Object.keys(data).sort();
          const valores = labels.map(mes => data[mes].cantidad);
          setVentasMensuales({ labels, data: valores });
          const ingresos = labels.map(mes => data[mes].total);
          setIngresosMensuales({ labels, data: ingresos });
        } catch {}
      }
      // Net revenue trend (daily or monthly)
      async function fetchNetRevenue() {
        try {
          const token = localStorage.getItem('token');
          const q = query ? `&${query.replace(/^\?/, '')}` : '';
          const url = `/api/dashboard/net-revenue?group=${netGroup}${q}`;
          const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
          if (!res.ok) throw new Error('Error net revenue');
          const data = await res.json();
          setNetRevenue({ labels: data.labels || [], data: data.net_revenue || [] });
        } catch (err) {
          setNetRevenue({ labels: [], data: [] });
        }
      }
      fetchNetRevenue();
      fetchVentasMensuales();

      // Productos y Servicios más vendidos
      async function fetchRankingProductos() {
        try {
          const tokenR = localStorage.getItem('token');
          const res = await fetch(`/api/reportes-ranking/ranking${query}`, { headers: { 'Authorization': tokenR ? `Bearer ${tokenR}` : '' } });
          if (!res.ok) throw new Error('Error al obtener ranking');
          const data = await res.json();
          
          // Separar productos físicos y servicios
          const prods = data.filter(item => {
            const p = item.Producto || {};
            return p.tipo !== 'servicio' && !(p.categoria && p.categoria.toLowerCase().includes('servicio'));
          });
          
          const servs = data.filter(item => {
            const p = item.Producto || {};
            return p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
          });

          setRankingProductos({
            labels: prods.map(item => item.Producto?.nombre || 'Producto'),
            data: prods.map(item => item.total_vendida)
          });

          setRankingServicios({
            labels: servs.map(item => item.Producto?.nombre || 'Servicio'),
            data: servs.map(item => item.total_vendida)
          });
        } catch {}
      }
      fetchRankingProductos();
    }, 700); // 700ms debounce
    return () => clearTimeout(debounceTimeout.current);
  }, [filtros, netGroup, selectedAlmacenId, usuarioLS, usuario?.rol]);
  const [stats, setStats] = useState({ usuarios: 0, productos: 0, ventas: 0, facturas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stockMinimo, setStockMinimo] = useState([]);

  // Ventas mensuales
  const [ventasMensuales, setVentasMensuales] = useState({ labels: [], data: [] });
  // Productos más vendidos
  const [rankingProductos, setRankingProductos] = useState({ labels: [], data: [] });
  // Servicios más solicitados
  const [rankingServicios, setRankingServicios] = useState({ labels: [], data: [] });
  // Ingresos totales por mes
  const [ingresosMensuales, setIngresosMensuales] = useState({ labels: [], data: [] });

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        let url = '/api/dashboard';
        // use the stable selectedAlmacenId helper to decide filtering
        if (selectedAlmacenId) {
          url += `?almacenId=${selectedAlmacenId}`;
        }
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al obtener métricas');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();

    // Para admin: obtener conteo de stock crítico por almacén
    async function fetchStockPorAlmacen() {
      try {
        if (usuario?.rol !== 'admin') return;
        const token = localStorage.getItem('token');
        const res = await fetch('/productos/stock-minimo/por-almacen', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Error al obtener stock por almacén');
        const data = await res.json();
        setStockPorAlmacen(Array.isArray(data) ? data : []);
      } catch (err) {
        setStockPorAlmacen([]);
      }
    }
    fetchStockPorAlmacen();

    // Obtener productos en stock mínimo (no depende de filtros)
    async function fetchStockMinimo() {
      try {
        const almacenParam = selectedAlmacenId ? `?almacenId=${selectedAlmacenId}` : '';
        const res = await fetch(`/productos/stock-minimo${almacenParam}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        });
        if (!res.ok) throw new Error('Error al obtener productos en stock crítico');
        const data = await res.json();
        setStockMinimo(data);
      } catch {}
    }
    fetchStockMinimo();
  }, [selectedAlmacenId, usuario?.rol]);

  if (loading) return <div style={{textAlign:'center',marginTop:40}}>Cargando métricas...</div>;
  if (error) return <div style={{color:'red',textAlign:'center',marginTop:40}}>{error}</div>;

  // Gráfica de barras con datos reales
  const barData = {
    labels: ['Usuarios', 'Productos', 'Ventas', 'Facturación'],
    datasets: [
      {
        label: 'Totales',
        data: [stats.usuarios, stats.productos, stats.ventas, stats.facturas],
        backgroundColor: [
          '#3182ce',
          '#38a169',
          '#d69e2e',
          '#e53e3e'
        ],
        borderRadius: 8,
        maxBarThickness: 60
      }
    ]
  };
  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Resumen General', font: { size: 20 } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  };

  // Gráfica de productos en stock mínimo
  const stockMinimoData = {
    labels: stockMinimo.map(p => p.nombre),
    datasets: [
      {
        label: 'Stock actual',
        data: stockMinimo.map(p => p.stock),
        backgroundColor: '#e53e3e',
        borderRadius: 8,
        maxBarThickness: 40
      }
    ]
  };
  const stockMinimoOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Productos en stock mínimo', font: { size: 18 } }
    },
    scales: {
      x: { beginAtZero: true }
    }
  };

  // Utilidades para totales
  const totalVentas = ventasMensuales.data.reduce((a, b) => a + b, 0);
  const totalIngresos = ingresosMensuales.data.reduce((a, b) => a + Number(b), 0);
  const totalProductos = rankingProductos.data.reduce((a, b) => a + b, 0);
  const totalServicios = rankingServicios.data.reduce((a, b) => a + b, 0);
  const totalClientes = clientesTop.data.reduce((a, b) => a + Number(b), 0);
  const totalPagos = metodosPago.data.reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: '0 12px 40px' }}>
      {/* Resumen general */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        borderRadius: 14,
        padding: '28px 32px',
        margin: '20px auto 24px',
        maxWidth: 1150,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>¡Panel de Control KPI & Métricas!</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>
            Resumen de rendimiento, ventas y estado de inventarios en tiempo real.
          </p>
        </div>
      </div>

      {/* Selector de almacén para admin */}
      {usuario?.rol === 'admin' && (
        <div style={{ maxWidth: 1150, margin: '0 auto 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>Filtrar por Almacén:</label>
          <select value={almacenSeleccionado} onChange={e => setAlmacenSeleccionado(e.target.value)} style={{ borderRadius: 6, padding: '6px 12px', border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', fontWeight: 500 }}>
            <option value="">Todos los almacenes</option>
            {almacenes.map(a => (<option key={a.id} value={a.id}>{a.nombre}</option>))}
          </select>
        </div>
      )}

      {/* KPIs rápidos */}
      <DashboardKPIs kpis={kpis} usuario={usuario} stockPorAlmacen={stockPorAlmacen} />

      {/* Filtros dinámicos */}
      <DashboardFiltros filtros={filtros} setFiltros={setFiltros} vendedores={vendedores} clientesList={clientesList} />

      {/* Tabla de Alertas de Inventario / Stock Crítico */}
      {stockMinimo && stockMinimo.length > 0 && (
        <div style={{ maxWidth: 1150, margin: '0 auto 32px', background: '#ffffff', borderRadius: 12, border: '1px solid #fecaca', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> Alertas de Stock Mínimo ({stockMinimo.length} productos)
            </div>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('productos')} 
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                Gestionar Productos →
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fff5f5', borderBottom: '2px solid #fecaca', color: '#7f1d1d', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Código</th>
                  <th style={{ padding: '10px 12px' }}>Producto</th>
                  <th style={{ padding: '10px 12px' }}>Categoría</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Stock Actual</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Stock Mínimo</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockMinimo.slice(0, 10).map((prod, idx) => (
                  <tr key={prod.id || idx} style={{ borderBottom: '1px solid #fee2e2' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>{prod.codigo || `-`}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>{prod.nombre}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{prod.categoria || 'General'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: prod.stock === 0 ? '#dc2626' : '#d97706' }}>
                      {prod.stock}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{prod.stock_minimo || 5}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: prod.stock === 0 ? '#fef2f2' : '#fffbeb',
                        color: prod.stock === 0 ? '#991b1b' : '#92400e',
                        border: `1px solid ${prod.stock === 0 ? '#fecaca' : '#fef08a'}`
                      }}>
                        {prod.stock === 0 ? '🔴 AGOTADO' : '🟡 BAJO MÍNIMO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid de gráficas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 20,
        margin: '0 auto',
        maxWidth: 1150
      }}>
        {/* Net revenue trend */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Ingresos netos ({netGroup === 'day' ? 'Diarios' : 'Mensuales'})</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={netGroup} onChange={e => setNetGroup(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
                <option value="day">Por Día</option>
                <option value="month">Por Mes</option>
              </select>
              <button 
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const extras = [];
                    if (filtros.desde) extras.push(`desde=${filtros.desde}`);
                    if (filtros.hasta) extras.push(`hasta=${filtros.hasta}`);
                    if (filtros.vendedor) extras.push(`vendedor=${encodeURIComponent(filtros.vendedor)}`);
                    if (filtros.cliente) extras.push(`cliente=${encodeURIComponent(filtros.cliente)}`);
                    const q = buildQuery(extras);
                    const url = `/api/dashboard/net-revenue?group=${netGroup}${q ? `&${q.replace(/^\?/, '')}` : ''}`;
                    const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
                    const d = await res.json();
                    const labels = d.labels || [];
                    const rows = (d.net_revenue || []).map((v, i) => ({ label: labels[i], net_revenue: v, gross_revenue: (d.gross_revenue || [])[i], discounts: (d.discounts || [])[i] }));
                    const csv = ['label,net_revenue,gross_revenue,discounts', ...rows.map(r => `${r.label},${r.net_revenue},${r.gross_revenue},${r.discounts}`)].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const urlBlob = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = urlBlob; a.download = `ingresos_${netGroup}.csv`; document.body.appendChild(a); a.click(); a.remove();
                  } catch (err) { console.error(err); alert('Error exportando CSV'); }
                }} 
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
              >
                📥 CSV
              </button>
            </div>
          </div>
          <GraficaBarra
            titulo=""
            descripcion=""
            total={formatCurrency(netRevenue.data.reduce((a, b) => a + Number(b || 0), 0))}
            labels={netRevenue.labels}
            data={netRevenue.data}
            color="#2563eb"
          />
        </div>

        {/* Ventas pendientes vs facturadas por día */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 340 }}>
          {pendFactLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Cargando ventas pendientes vs facturadas...</div>
          ) : pendFactError ? (
            <div style={{ color: '#dc2626', textAlign: 'center', padding: 30 }}>{pendFactError}</div>
          ) : pendFactLabels.length > 0 ? (
            <GraficaBarraPendientesFacturadas
              labels={pendFactLabels}
              pendientes={pendFactPendientes}
              facturadas={pendFactFacturadas}
            />
          ) : null}
        </div>

        {/* Ventas mensuales */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
          <GraficaBarra
            titulo="Ventas mensuales"
            descripcion="Cantidad total de transacciones por mes."
            total={totalVentas}
            labels={ventasMensuales.labels}
            data={ventasMensuales.data}
            color="#0284c7"
          />
        </div>

        {/* Ingresos totales por mes */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
          <GraficaBarra
            titulo="Ingresos por mes"
            descripcion="Monto total cobrado por mes."
            total={formatCurrency(totalIngresos)}
            labels={ingresosMensuales.labels}
            data={ingresosMensuales.data}
            color="#059669"
          />
        </div>

        {/* Productos / Repuestos más vendidos */}
        {rankingProductos.labels.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
            <GraficaBarra
              titulo="📦 Top Repuestos y Productos Físicos"
              descripcion="Piezas y repuestos de mayor venta en el período."
              total={`Total unidades: ${totalProductos}`}
              labels={rankingProductos.labels}
              data={rankingProductos.data}
              color="#d97706"
              horizontal={true}
            />
          </div>
        )}

        {/* Servicios / Mano de obra más solicitados */}
        {rankingServicios.labels.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
            <GraficaBarra
              titulo="🛠️ Top Servicios y Mano de Obra"
              descripcion="Trabajos de laboratorio e inspecciones más solicitados."
              total={`Total servicios: ${totalServicios}`}
              labels={rankingServicios.labels}
              data={rankingServicios.data}
              color="#8b5cf6"
              horizontal={true}
            />
          </div>
        )}

        {/* Clientes principales */}
        {clientesTopLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Cargando clientes principales...</div>
        ) : clientesTopError ? (
          <div style={{ color: '#dc2626', textAlign: 'center', padding: 30 }}>{clientesTopError}</div>
        ) : clientesTop.labels.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
            <GraficaBarra
              titulo="Clientes principales"
              descripcion="Clientes con mayor volumen de compras."
              total={`Total vendido: ${formatCurrency(totalClientes)}`}
              labels={clientesTop.labels}
              data={clientesTop.data}
              color="#7c3aed"
              horizontal={true}
            />
          </div>
        )}

        {/* Métodos de pago más usados */}
        {metodosPagoLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Cargando métodos de pago...</div>
        ) : metodosPagoError ? (
          <div style={{ color: '#dc2626', textAlign: 'center', padding: 30 }}>{metodosPagoError}</div>
        ) : metodosPago.labels.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 18 }}>
            <GraficaPie
              titulo="Métodos de pago más usados"
              descripcion="Distribución de transacciones según medio de pago."
              total={`Total pagos: ${totalPagos}`}
              labels={metodosPago.labels}
              data={metodosPago.data}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

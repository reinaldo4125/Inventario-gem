import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import './multinyectores.css';
import ReportesGanancia from './ReportesGanancia';
import ProductoCostosAdmin from './ProductoCostosAdmin';
import { formatCurrency } from './utils/formatters';
import { AuthContext } from './AuthContext';

import { 
  MdAssessment, MdTrendingUp, MdWarning, MdCategory, MdPeople, MdAttachMoney, 
  MdRefresh, MdSearch, MdFilterList, MdFileDownload, MdStore, MdCheckCircle,
  MdPieChart, MdBarChart, MdReceiptLong, MdInventory
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf, FaTrophy, FaExclamationTriangle, FaChartPie, FaMoneyBillWave } from 'react-icons/fa';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';

function Reportes() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.rol === 'admin';

  // Active Tab
  const [activeTab, setActiveTab] = useState('resumen'); // 'resumen', 'ranking', 'alertas', 'ganancia', 'costos'

  // Data States
  const [ventasTipoCliente, setVentasTipoCliente] = useState({});
  const [ventasCategoria, setVentasCategoria] = useState({});
  const [ventasMetodoPago, setVentasMetodoPago] = useState({});
  const [ranking, setRanking] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  // Filter States
  const [filtroGeneral, setFiltroGeneral] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Status States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tokenHeader = useMemo(() => {
    const token = user?.token || localStorage.getItem('token');
    return token ? `Bearer ${token}` : '';
  }, [user?.token]);

  // Cargar lista de almacenes para administradores
  useEffect(() => {
    fetch('/almacenes', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(d => setAlmacenes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [tokenHeader]);

  // Fetch Principal de Reportes
  const fetchReportes = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      // Filtro por Almacén
      if (filtroAlmacen !== 'Todos') {
        params.append('almacenId', filtroAlmacen);
      } else if (!isAdmin && user?.almacenId) {
        params.append('almacenId', user.almacenId);
      }

      // Filtro por Fechas
      if (fechaInicio) params.append('desde', fechaInicio);
      if (fechaFin) params.append('hasta', fechaFin);

      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [resTipoCliente, resCategoria, resMetodoPago, resRanking, resAlertas] = await Promise.all([
        fetch(`/api/reportes/ventas-por-tipo-cliente${queryStr}`, { headers: { 'Authorization': tokenHeader } }).then(r => r.json()),
        fetch(`/api/reportes-categoria/ventas-por-categoria${queryStr}`, { headers: { 'Authorization': tokenHeader } }).then(r => r.json()),
        fetch(`/api/reportes/ventas-agrupadas${queryStr}${queryStr ? '&' : '?'}agrupacion=metodoPago`, { headers: { 'Authorization': tokenHeader } }).then(r => r.json()),
        fetch(`/api/reportes-ranking/ranking${queryStr}`, { headers: { 'Authorization': tokenHeader } }).then(r => r.json()),
        fetch(`/api/reportes-alertas/alertas-inventario${queryStr}`, { headers: { 'Authorization': tokenHeader } }).then(r => r.json())
      ]);

      setVentasTipoCliente(typeof resTipoCliente === 'object' && !resTipoCliente.error ? resTipoCliente : {});
      setVentasCategoria(typeof resCategoria === 'object' && !resCategoria.error ? resCategoria : {});
      setVentasMetodoPago(typeof resMetodoPago === 'object' && !resMetodoPago.error ? resMetodoPago : {});
      setRanking(Array.isArray(resRanking) ? resRanking : []);
      setAlertas(Array.isArray(resAlertas) ? resAlertas : []);

    } catch (err) {
      setError('Ocurrió un error al cargar los reportes. Verifique la conexión.');
    } finally {
      setLoading(false);
    }
  }, [filtroAlmacen, fechaInicio, fechaFin, isAdmin, user?.almacenId, tokenHeader]);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  // Filtro visual sobre arreglos
  const lowerFiltro = filtroGeneral.toLowerCase().trim();

  const rankingFiltrado = useMemo(() => {
    const list = Array.isArray(ranking) ? ranking : [];
    if (!lowerFiltro) return list;
    return list.filter(item => {
      const p = item.Producto || {};
      return (
        (p.nombre || '').toLowerCase().includes(lowerFiltro) ||
        (p.categoria || '').toLowerCase().includes(lowerFiltro) ||
        (p.marca || '').toLowerCase().includes(lowerFiltro) ||
        (p.modelo || '').toLowerCase().includes(lowerFiltro) ||
        (p.codigo_oem || '').toLowerCase().includes(lowerFiltro)
      );
    });
  }, [ranking, lowerFiltro]);

  const alertasFiltradas = useMemo(() => {
    const list = Array.isArray(alertas) ? alertas : [];
    if (!lowerFiltro) return list;
    return list.filter(item => (
      (item.nombre || '').toLowerCase().includes(lowerFiltro) ||
      (item.categoria || '').toLowerCase().includes(lowerFiltro) ||
      (item.marca || '').toLowerCase().includes(lowerFiltro) ||
      (item.modelo || '').toLowerCase().includes(lowerFiltro)
    ));
  }, [alertas, lowerFiltro]);

  // Cálculos de KPIs Totales
  const totalVentasBrutas = useMemo(() => {
    return Object.values(ventasTipoCliente).reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
  }, [ventasTipoCliente]);

  const totalCategoriasContadas = Object.keys(ventasCategoria).length;
  const topProducto = rankingFiltrado.length > 0 ? rankingFiltrado[0] : null;

  // Funciones de Exportación
  const exportarRankingExcel = () => {
    const data = rankingFiltrado.map((item, idx) => ({
      'Posición': `#${idx + 1}`,
      'Producto': item.Producto?.nombre || 'Producto',
      'Categoría': item.Producto?.categoria || 'General',
      'Marca': item.Producto?.marca || '-',
      'Modelo': item.Producto?.modelo || '-',
      'Cantidad Vendida': Number(item.dataValues?.total_vendida || item.total_vendida || 0),
      'Stock Actual': Number(item.Producto?.stock || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking Productos');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `Ranking_Productos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarRankingPDF = () => {
    const doc = createDoc();
    doc.setFontSize(14);
    doc.text('MULTINYECTORES Y REPUESTOS - RANKING DE PRODUCTOS', 14, 16);
    doc.setFontSize(10);
    doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 14, 22);

    tableToPdf(doc, {
      startY: 28,
      head: [['#', 'Producto', 'Categoría', 'Marca', 'Cant. Vendida', 'Stock']],
      body: rankingFiltrado.map((item, idx) => [
        `#${idx + 1}`,
        item.Producto?.nombre || 'Producto',
        item.Producto?.categoria || 'General',
        item.Producto?.marca || '-',
        item.dataValues?.total_vendida || item.total_vendida || 0,
        item.Producto?.stock || 0
      ])
    });

    savePdf(doc, `Ranking_Productos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportarAlertasExcel = () => {
    const data = alertasFiltradas.map((item) => ({
      'Producto': item.nombre,
      'Categoría': item.categoria || '-',
      'Marca': item.marca || '-',
      'Modelo': item.modelo || '-',
      'Stock Actual': item.stock,
      'Stock Mínimo': item.stock_minimo,
      'Faltante Aprox': Math.max(0, (item.stock_minimo || 0) - item.stock)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alertas Inventario');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `Alertas_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ padding: '4px 0' }}>

      {/* HEADER DE LA SECCIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAssessment color="#2b6cb0" /> Centro de Reportes & Analítica Comercial
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Auditoría de ventas por cliente y categoría, ranking de rotación de inventario y alertas preventivas de stock.
          </p>
        </div>

        <button 
          onClick={fetchReportes} 
          className="btn btn-secundario" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748' }}
        >
          <MdRefresh size={18} /> Actualizar Datos
        </button>
      </div>

      {/* TARJETAS DE KPIS PRINCIPALES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        
        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #2b6cb0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Ventas Consolidadas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2b6cb0', marginTop: '4px' }}>{formatCurrency(totalVentasBrutas)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Facturación según filtros</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #e53e3e', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Alertas Stock Bajo</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#c53030', marginTop: '4px' }}>{alertas.length} <span style={{ fontSize: '14px', fontWeight: 400 }}>productos</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Requieren reabastecimiento</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Producto Más Vendido (#1)</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#276749', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {topProducto ? topProducto.Producto?.nombre : 'Sin ventas'}
          </div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>
            {topProducto ? `${topProducto.dataValues?.total_vendida || topProducto.total_vendida} unidades vendidas` : 'N/A'}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Categorías Activas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{totalCategoriasContadas} <span style={{ fontSize: '14px', fontWeight: 400 }}>categorías</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Con movimiento comercial</div>
        </div>

      </div>

      {/* BARRA DE FILTROS GLOBALES */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative' }}>
            <MdSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por producto, marca, categoría..." 
              value={filtroGeneral} 
              onChange={e => setFiltroGeneral(e.target.value)} 
              className="input" 
              style={{ paddingLeft: '36px', width: '100%' }} 
            />
          </div>

          {isAdmin && (
            <div>
              <select 
                value={filtroAlmacen} 
                onChange={e => setFiltroAlmacen(e.target.value)} 
                className="input" 
                style={{ width: '100%' }}
              >
                <option value="Todos">Todas las Bodegas</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <input 
              type="date" 
              value={fechaInicio} 
              onChange={e => setFechaInicio(e.target.value)} 
              className="input" 
              style={{ width: '100%' }} 
              placeholder="Fecha Desde" 
            />
          </div>

          <div>
            <input 
              type="date" 
              value={fechaFin} 
              onChange={e => setFechaFin(e.target.value)} 
              className="input" 
              style={{ width: '100%' }} 
              placeholder="Fecha Hasta" 
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => { setFiltroGeneral(''); setFiltroAlmacen('Todos'); setFechaInicio(''); setFechaFin(''); }} 
              className="btn btn-secundario" 
              style={{ width: '100%', fontSize: '13px' }}
            >
              Limpiar Filtros
            </button>
          </div>

        </div>
      </div>

      {/* MENÚ DE PESTAÑAS (TABS) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        <button 
          onClick={() => setActiveTab('resumen')}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'resumen' ? '#2b6cb0' : '#718096',
            borderBottom: activeTab === 'resumen' ? '3px solid #2b6cb0' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <MdAssessment size={18} /> Resumen Ejecutivo
        </button>

        <button 
          onClick={() => setActiveTab('ranking')}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'ranking' ? '#2b6cb0' : '#718096',
            borderBottom: activeTab === 'ranking' ? '3px solid #2b6cb0' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FaTrophy size={15} /> Ranking Más Vendidos
        </button>

        <button 
          onClick={() => setActiveTab('alertas')}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'alertas' ? '#e53e3e' : '#718096',
            borderBottom: activeTab === 'alertas' ? '3px solid #e53e3e' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FaExclamationTriangle size={15} /> Stock Bajo ({alertas.length})
        </button>

        {isAdmin && (
          <button 
            onClick={() => setActiveTab('ganancia')}
            style={{
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'ganancia' ? '#276749' : '#718096',
              borderBottom: activeTab === 'ganancia' ? '3px solid #276749' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FaMoneyBillWave size={15} /> Ganancia por Producto
          </button>
        )}

        {isAdmin && (
          <button 
            onClick={() => setActiveTab('costos')}
            style={{
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'costos' ? '#553c9a' : '#718096',
              borderBottom: activeTab === 'costos' ? '3px solid #553c9a' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdInventory size={18} /> Gestión de Costos
          </button>
        )}

      </div>

      {/* MENSAJE DE CARGA O ERROR */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px', color: '#4a5568' }}>
          <span className="loader" style={{ marginRight: '8px' }}></span> Cargando datos analíticos...
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* PESTAÑA 1: RESUMEN EJECUTIVO */}
      {!loading && activeTab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* TABLA: VENTAS POR TIPO DE CLIENTE */}
          <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2b6cb0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdPeople /> Ventas por Tipo de Cliente
            </h3>

            <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#edf2f7' }}>
                  <th style={{ padding: '8px 12px' }}>Tipo Cliente</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cant. Ventas</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Facturado</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(ventasTipoCliente).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: '#a0aec0' }}>
                      Sin registros para el periodo
                    </td>
                  </tr>
                ) : (
                  Object.entries(ventasTipoCliente).map(([tipo, data]) => (
                    <tr key={tipo}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{tipo}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4a5568' }}>{data.cantidad || 1}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#276749' }}>
                        {formatCurrency(parseFloat(data.total) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABLA: VENTAS POR CATEGORÍA */}
          <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2b6cb0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdCategory /> Ventas por Categoría de Producto
            </h3>

            <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#edf2f7' }}>
                  <th style={{ padding: '8px 12px' }}>Categoría</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Ventas</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(ventasCategoria).length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '16px', color: '#a0aec0' }}>
                      Sin datos por categoría
                    </td>
                  </tr>
                ) : (
                  Object.entries(ventasCategoria).map(([cat, total]) => (
                    <tr key={cat}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{cat}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2b6cb0' }}>
                        {formatCurrency(parseFloat(total) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABLA: VENTAS POR MÉTODO DE PAGO */}
          <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2b6cb0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdReceiptLong /> Ventas por Método de Pago
            </h3>

            <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#edf2f7' }}>
                  <th style={{ padding: '8px 12px' }}>Método de Pago</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Operaciones</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Recaudado</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(ventasMetodoPago).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: '#a0aec0' }}>
                      Sin transacciones registradas
                    </td>
                  </tr>
                ) : (
                  Object.entries(ventasMetodoPago).map(([metodo, data]) => (
                    <tr key={metodo}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{metodo}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4a5568' }}>{data.cantidad || 0}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#553c9a' }}>
                        {formatCurrency(parseFloat(data.total) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* PESTAÑA 2: RANKING DE PRODUCTOS */}
      {!loading && activeTab === 'ranking' && (
        <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#2b6cb0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaTrophy color="#d69e2e" /> Ranking de Productos Más Vendidos
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportarRankingExcel} className="btn" style={{ background: '#276749', color: '#fff', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaFileExcel /> Exportar Excel
              </button>
              <button onClick={exportarRankingPDF} className="btn" style={{ background: '#c53030', color: '#fff', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaFilePdf /> Exportar PDF
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#edf2f7', color: '#2d3748' }}>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Posición</th>
                  <th style={{ padding: '10px' }}>Producto</th>
                  <th style={{ padding: '10px' }}>Categoría</th>
                  <th style={{ padding: '10px' }}>Marca / Modelo</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Unidades Vendidas</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Stock Disponible</th>
                </tr>
              </thead>
              <tbody>
                {rankingFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                      No se encontraron productos en el ranking con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rankingFiltrado.map((item, idx) => {
                    const cant = item.dataValues?.total_vendida || item.total_vendida || 0;
                    const stock = item.Producto?.stock || 0;
                    const isTop3 = idx < 3;

                    return (
                      <tr key={item.productoId || idx}>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800 }}>
                          {idx === 0 && <span style={{ background: '#f6e05e', color: '#744210', padding: '4px 8px', borderRadius: '50%', fontSize: '12px' }}>🥇 1</span>}
                          {idx === 1 && <span style={{ background: '#e2e8f0', color: '#2d3748', padding: '4px 8px', borderRadius: '50%', fontSize: '12px' }}>🥈 2</span>}
                          {idx === 2 && <span style={{ background: '#feebc8', color: '#744210', padding: '4px 8px', borderRadius: '50%', fontSize: '12px' }}>🥉 3</span>}
                          {idx > 2 && <span style={{ color: '#718096' }}>#{idx + 1}</span>}
                        </td>

                        <td style={{ padding: '10px', fontWeight: 600, color: isTop3 ? '#2b6cb0' : '#2d3748' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.Producto?.foto && <img src={item.Producto.foto} alt="prod" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {(item.Producto?.tipo === 'servicio' || (item.Producto?.categoria && item.Producto.categoria.toLowerCase().includes('servicio'))) 
                                  ? <span style={{ color: '#6b46c1' }}>🛠️</span> 
                                  : <span style={{ color: '#3182ce' }}>📦</span>}
                                {item.Producto?.nombre || 'Producto'}
                              </div>
                              {item.Producto?.codigo_oem && <div style={{ fontSize: '11px', color: '#718096' }}>OEM: {item.Producto.codigo_oem}</div>}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '10px', color: '#4a5568' }}>
                          {(item.Producto?.tipo === 'servicio' || (item.Producto?.categoria && item.Producto.categoria.toLowerCase().includes('servicio'))) ? (
                            <span className="badge" style={{ backgroundColor: '#faf5ff', color: '#6b46c1', border: '1px solid #d6bcfa', fontSize: '11px', padding: '2px 8px' }}>
                              🛠️ Servicio
                            </span>
                          ) : (
                            item.Producto?.categoria || 'General'
                          )}
                        </td>
                        <td style={{ padding: '10px', color: '#4a5568' }}>{item.Producto?.marca || '-'} {item.Producto?.modelo ? `/ ${item.Producto.modelo}` : ''}</td>

                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#276749', fontSize: '14px' }}>
                          {cant}
                        </td>

                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {(item.Producto?.tipo === 'servicio' || (item.Producto?.categoria && item.Producto.categoria.toLowerCase().includes('servicio'))) ? (
                            <span style={{ fontSize: '11px', color: '#6b46c1', background: '#faf5ff', padding: '2px 8px', borderRadius: '10px', border: '1px solid #e9d8fd', fontWeight: 600 }}>
                              🛠️ Servicio (Ilimitado)
                            </span>
                          ) : (
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '10px', 
                              fontSize: '11px', 
                              fontWeight: 600,
                              background: stock <= 5 ? '#fff5f5' : '#f0fff4',
                              color: stock <= 5 ? '#c53030' : '#276749',
                              border: `1px solid ${stock <= 5 ? '#feb2b2' : '#c6f6d5'}`
                            }}>
                              {stock} unds
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* PESTAÑA 3: ALERTAS DE INVENTARIO */}
      {!loading && activeTab === 'alertas' && (
        <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#c53030', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaExclamationTriangle /> Control de Alertas por Stock Bajo
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#718096' }}>
                Productos cuyo inventario actual está igual o por debajo del límite de stock mínimo parametrizado.
              </p>
            </div>

            <button onClick={exportarAlertasExcel} className="btn" style={{ background: '#276749', color: '#fff', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FaFileExcel /> Exportar Alertas
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fff5f5', color: '#9b2c2c' }}>
                  <th style={{ padding: '10px' }}>Producto</th>
                  <th style={{ padding: '10px' }}>Categoría</th>
                  <th style={{ padding: '10px' }}>Marca / Modelo</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Stock Actual</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Stock Mínimo</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Déficit</th>
                </tr>
              </thead>
              <tbody>
                {alertasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#38a169', fontWeight: 600 }}>
                      <MdCheckCircle size={24} style={{ display: 'block', margin: '0 auto 6px' }} />
                      ¡Excelente! No hay productos con nivel de stock crítico en el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  alertasFiltradas.map((item) => {
                    const deficit = Math.max(0, (item.stock_minimo || 0) - item.stock);
                    return (
                      <tr key={item.id}>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#1a202c' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.foto && <img src={item.foto} alt="foto" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />}
                            <div>{item.nombre}</div>
                          </div>
                        </td>

                        <td style={{ padding: '10px', color: '#4a5568' }}>{item.categoria || 'General'}</td>
                        <td style={{ padding: '10px', color: '#4a5568' }}>{item.marca || '-'} {item.modelo ? `/ ${item.modelo}` : ''}</td>

                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: '#e53e3e' }}>
                          {item.stock}
                        </td>

                        <td style={{ padding: '10px', textAlign: 'center', color: '#4a5568' }}>
                          {item.stock_minimo}
                        </td>

                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ background: '#fed7d7', color: '#9b2c2c', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            -{deficit} unidades
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* PESTAÑA 4: GANANCIA POR PRODUCTO (ADMIN) */}
      {!loading && activeTab === 'ganancia' && isAdmin && (
        <div style={{ marginTop: '10px' }}>
          <ReportesGanancia />
        </div>
      )}

      {/* PESTAÑA 5: ADMINISTRACIÓN DE COSTOS (ADMIN) */}
      {!loading && activeTab === 'costos' && isAdmin && (
        <div style={{ marginTop: '10px' }}>
          <ProductoCostosAdmin />
        </div>
      )}

    </div>
  );
}

export default Reportes;

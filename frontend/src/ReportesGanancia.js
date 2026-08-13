import React, { useEffect, useState, useContext, useCallback } from 'react';
import './multinyectores.css';
import { formatCurrency } from './utils/formatters';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';

function ReportesGanancia() {
  const { user } = useContext(require('./AuthContext').AuthContext);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenId, setAlmacenId] = useState('');
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState({ key: 'productoNombre', dir: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalRows, setTotalRows] = useState(0);

  // Helpers
  function getSortedRows(rowsArr, sortObj) {
    const key = sortObj.key;
    const dir = sortObj.dir === 'asc' ? 1 : -1;
    const sorted = [...rowsArr].sort((a,b)=>{
      const va = (a[key] === undefined || a[key] === null) ? '' : a[key];
      const vb = (b[key] === undefined || b[key] === null) ? '' : b[key];
      // try numeric compare
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return sorted;
  }

  function getPagedRows(rowsArr, pageNum, size, sortObj) {
    const sorted = getSortedRows(rowsArr, sortObj);
    const start = (pageNum - 1) * size;
    return sorted.slice(start, start + size);
  }

  function toggleSort(key) {
    setPage(1);
    setSort(s => {
      if (s.key === key) return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: 'asc' };
    });
  }

  function renderSortArrow(key) {
    if (sort.key !== key) return '';
    return sort.dir === 'asc' ? '↑' : '↓';
  }

  useEffect(() => {
    // cargar almacenes
    const token = localStorage.getItem('token');
    fetch('/almacenes', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(r => {
        if (r.status === 403) throw new Error('forbidden');
        return r.json();
      })
      .then(data => setAlmacenes(Array.isArray(data) ? data : []))
      .catch(() => setAlmacenes([]));
  }, []);

  const fetchReporte = useCallback(() => {
    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (almacenId) params.append('almacenId', almacenId);
    // pagination & sorting
    params.append('page', page);
    params.append('pageSize', pageSize);
    params.append('sortKey', sort.key);
    params.append('sortDir', sort.dir);
    const token = localStorage.getItem('token');
    fetch('/api/reportes/ganancia-producto?' + params.toString(), { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(r => {
        if (r.status === 403) throw { code: 403 };
        return r.json();
      })
      .then(data => {
        const arr = Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
        const total = data.total || 0;
        setTotalRows(total);
        // enrich with almacenNombre from local almacenes cache if backend didn't return it
        const enriched = arr.map(row => ({
          ...row,
          almacenNombre: row.almacenNombre || (almacenes.find(a => Number(a.id) === Number(row.almacenId)) || {}).nombre
        }));
        setRows(enriched);
      })
      .catch(err => {
        if (err && err.code === 403) {
          setRows([]);
          alert('No autorizado. Este reporte solo está disponible para administradores.');
          return;
        }
        console.error(err);
        setRows([]);
      });
  }, [desde, hasta, almacenId, page, sort.key, sort.dir, almacenes]);

  // refetch when page, sort or filter changes
  useEffect(()=>{
    fetchReporte();
  }, [fetchReporte]);

  const exportExcel = () => {
    // request server for full export (server will return all rows)
    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (almacenId) params.append('almacenId', almacenId);
    params.append('export', '1');
    params.append('sortKey', sort.key);
    params.append('sortDir', sort.dir);
    const token = localStorage.getItem('token');
    fetch('/api/reportes/ganancia-producto?' + params.toString(), { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
        const out = all.map(r => ({
      Producto: r.productoNombre,
      Almacen: r.almacenNombre || r.almacenId,
      Cantidad: r.cantidad_total,
      Ventas: typeof r.ventas_total_neto !== 'undefined' ? r.ventas_total_neto : r.ventas_total,
      Costo: r.costo_total,
      Ganancia: r.ganancia_monetaria,
      'Ganancia %': r.ganancia_pct
    }));
        // Totals
        const totals = {
          Producto: 'Totales',
          Almacen: '',
          Cantidad: out.reduce((s, r) => s + Number(r.Cantidad || 0), 0),
          Ventas: out.reduce((s, r) => s + Number(r.Ventas || 0), 0),
          Costo: out.reduce((s, r) => s + Number(r.Costo || 0), 0),
          Ganancia: out.reduce((s, r) => s + Number(r.Ganancia || 0), 0),
          'Ganancia %': ''
        };
        out.push(totals);
        const ws = XLSX.utils.json_to_sheet(out);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ganancia');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'reporte_ganancia.xlsx');
      })
      .catch(err => { console.error(err); alert('Error exportando'); });
  };

  const exportPdf = () => {
    // Request server full dataset for export
    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (almacenId) params.append('almacenId', almacenId);
    params.append('export', '1');
    params.append('sortKey', sort.key);
    params.append('sortDir', sort.dir);
    const token = localStorage.getItem('token');
    fetch('/api/reportes/ganancia-producto?' + params.toString(), { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
        const headers = ['Producto', 'Almacén', 'Cantidad', 'Ventas', 'Costo', 'Ganancia', 'Ganancia %'];
        const body = all.map(r => [r.productoNombre, r.almacenNombre || r.almacenId, r.cantidad_total, formatCurrency(typeof r.ventas_total_neto !== 'undefined' ? r.ventas_total_neto : r.ventas_total), formatCurrency(r.costo_total), formatCurrency(r.ganancia_monetaria), r.ganancia_pct ? r.ganancia_pct.toFixed(2) + '%' : 'N/A']);
        const totalsRow = [
          'Totales', '',
          all.reduce((s, r) => s + Number(r.cantidad_total || 0), 0),
          formatCurrency(all.reduce((s, r) => s + Number(typeof r.ventas_total_neto !== 'undefined' ? r.ventas_total_neto : r.ventas_total || 0), 0)),
          formatCurrency(all.reduce((s, r) => s + Number(r.costo_total || 0), 0)),
          formatCurrency(all.reduce((s, r) => s + Number(r.ganancia_monetaria || 0), 0)),
          ''
        ];
        body.push(totalsRow);
        const doc = createDoc();
        tableToPdf(doc, headers, body, { startY: 20 });
        savePdf(doc, 'reporte_ganancia.pdf');
      })
      .catch(err => { console.error(err); alert('Error exportando PDF'); });
  };

  return (
    <div className="card">
      <h2>Reporte: Ganancia por producto por almacén</h2>
      {user?.rol !== 'admin' && (
        <div className="alert alert-warning">No autorizado: este reporte está restringido a administradores.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label>
          Desde
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </label>
        <label>
          Almacén
          <select value={almacenId} onChange={e => setAlmacenId(e.target.value)}>
            <option value="">Todos</option>
            {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={fetchReporte}>Generar</button>
        <button onClick={exportExcel} style={{ marginLeft: 8 }}>Exportar Excel</button>
        <button onClick={exportPdf} style={{ marginLeft: 8 }}>Exportar PDF</button>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table className="table" style={{width:'100%'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left', cursor:'pointer'}} onClick={()=>toggleSort('productoNombre')}>Producto {renderSortArrow('productoNombre')}</th>
              <th style={{textAlign:'left', cursor:'pointer'}} onClick={()=>toggleSort('almacenNombre')}>Almacén {renderSortArrow('almacenNombre')}</th>
              <th style={{textAlign:'right', cursor:'pointer'}} onClick={()=>toggleSort('cantidad_total')}>Cantidad {renderSortArrow('cantidad_total')}</th>
              <th style={{textAlign:'right', cursor:'pointer'}} onClick={()=>toggleSort('ventas_total_neto')}>Ventas {renderSortArrow('ventas_total_neto')}</th>
              <th style={{textAlign:'right', cursor:'pointer'}} onClick={()=>toggleSort('costo_total')}>Costo {renderSortArrow('costo_total')}</th>
              <th style={{textAlign:'right', cursor:'pointer'}} onClick={()=>toggleSort('ganancia_monetaria')}>Ganancia {renderSortArrow('ganancia_monetaria')}</th>
              <th style={{textAlign:'right', cursor:'pointer'}} onClick={()=>toggleSort('ganancia_pct')}>Ganancia % {renderSortArrow('ganancia_pct')}</th>
            </tr>
          </thead>
          <tbody>
            {getPagedRows(rows, page, pageSize, sort).map((r, i) => (
              <tr key={i}>
                <td style={{textAlign:'left'}}>{r.productoNombre}</td>
                <td style={{textAlign:'left'}}>{r.almacenNombre || r.almacenId}</td>
                <td style={{textAlign:'right'}}>{r.cantidad_total}</td>
                <td style={{textAlign:'right'}}>{formatCurrency(typeof r.ventas_total_neto !== 'undefined' ? r.ventas_total_neto : r.ventas_total)}</td>
                <td style={{textAlign:'right'}}>{formatCurrency(r.costo_total)}</td>
                <td style={{textAlign:'right'}}>{formatCurrency(r.ganancia_monetaria)}</td>
                <td style={{textAlign:'right'}}>{r.ganancia_pct ? Number(r.ganancia_pct).toFixed(2) + '%' : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{fontWeight:700, borderTop:'2px solid #ddd', backgroundColor:'#f6f8fa'}}>
              <td style={{textAlign:'left', padding:'8px'}}>Totales</td>
              <td style={{textAlign:'left', padding:'8px'}}></td>
              <td style={{textAlign:'right', padding:'8px'}}>{rows.reduce((s, r) => s + Number(r.cantidad_total || 0), 0)}</td>
              <td style={{textAlign:'right', padding:'8px'}}>{formatCurrency(rows.reduce((s, r) => s + Number(typeof r.ventas_total_neto !== 'undefined' ? r.ventas_total_neto : r.ventas_total || 0), 0))}</td>
              <td style={{textAlign:'right', padding:'8px'}}>{formatCurrency(rows.reduce((s, r) => s + Number(r.costo_total || 0), 0))}</td>
              <td style={{textAlign:'right', padding:'8px'}}>{formatCurrency(rows.reduce((s, r) => s + Number(r.ganancia_monetaria || 0), 0))}</td>
              <td style={{textAlign:'right', padding:'8px'}}></td>
            </tr>
          </tfoot>
        </table>
        {/* Pagination controls */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <div>
            Página {page} de {Math.max(1, Math.ceil(totalRows / pageSize))}
          </div>
          <div>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>Anterior</button>
            <button onClick={()=>setPage(p=>Math.min(Math.ceil(Math.max(1,totalRows)/pageSize), p+1))} style={{marginLeft:8}} disabled={page>=Math.ceil(Math.max(1,totalRows)/pageSize)}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportesGanancia;

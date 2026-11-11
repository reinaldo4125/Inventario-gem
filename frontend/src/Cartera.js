import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency, hoyColombia } from './utils/formatters';
import { toast } from 'react-toastify';
import { 
  MdAttachMoney, MdSearch, MdRefresh, MdPrint, MdClose, MdCheckCircle, 
  MdWarning, MdSchedule, MdReceipt, MdPerson, MdStore, MdAccountBalanceWallet,
  MdCreditCard, MdHistory, MdFileDownload
} from 'react-icons/md';
import { FaWhatsapp, FaFileInvoiceDollar, FaCheck, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import WhatsAppModal from './components/WhatsAppModal';
import { buildWhatsAppDocumentMessage } from './utils/whatsapp';

export default function Cartera({ usuario }) {
  const [items, setItems] = useState([]);
  const [kpis, setKpis] = useState({
    totalCartera: 0,
    totalVencido: 0,
    totalAlDia: 0,
    clientesDeudores: 0,
    totalRecaudadoMes: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('Pendientes');
  const [search, setSearch] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
  const [almacenes, setAlmacenes] = useState([]);

  // Modal Registrar Abono
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState('Efectivo');
  const [referenciaAbono, setReferenciaAbono] = useState('');
  const [observacionesAbono, setObservacionesAbono] = useState('');
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  // Modal Recibo de Caja
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboCajaData, setReciboCajaData] = useState(null);

  // Modal Historial de Abonos
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialFactura, setHistorialFactura] = useState(null);

  // Modal WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  const tokenHeader = useMemo(() => `Bearer ${usuario?.token || localStorage.getItem('token') || ''}`, [usuario?.token]);

  // Cargar lista de almacenes
  useEffect(() => {
    fetch('/almacenes', { headers: { 'Authorization': tokenHeader } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAlmacenes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [tokenHeader]);

  // Consultar Cartera
  const fetchCartera = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('filtroEstado', filtroEstado);
      if (search.trim()) params.append('q', search.trim());
      if (filtroAlmacen && filtroAlmacen !== 'Todos') params.append('almacenId', filtroAlmacen);

      const res = await fetch(`/cartera?${params.toString()}`, {
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('Error al consultar cartera');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err) {
      setError(err.message || 'Error de conexión');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, search, filtroAlmacen, tokenHeader]);

  useEffect(() => {
    fetchCartera();
  }, [fetchCartera]);

  // Abrir Modal para Registrar Abono
  const handleAbrirAbono = (item) => {
    setFacturaSeleccionada(item);
    setMontoAbono('');
    setMetodoPagoAbono('Efectivo');
    setReferenciaAbono('');
    setObservacionesAbono('');
    setShowAbonoModal(true);
  };

  // Confirmar Abono
  const handleGuardarAbono = async (e) => {
    e.preventDefault();
    if (!facturaSeleccionada) return;

    const montoNum = parseFloat(montoAbono);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido mayor a $0.');
      return;
    }

    if (montoNum > facturaSeleccionada.saldoPendiente + 0.01) {
      toast.error(`El abono ($${montoNum.toLocaleString('es-CO')}) supera el saldo pendiente ($${facturaSeleccionada.saldoPendiente.toLocaleString('es-CO')}).`);
      return;
    }

    setGuardandoAbono(true);
    try {
      const res = await fetch(`/cartera/${facturaSeleccionada.id}/abono`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({
          monto: montoNum,
          metodoPago: metodoPagoAbono,
          referencia: referenciaAbono,
          observaciones: observacionesAbono
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el abono');

      toast.success(data.mensaje || '¡Abono registrado con éxito!');
      setShowAbonoModal(false);
      fetchCartera();

      // Abrir Recibo de Caja Oficial
      if (data.reciboCaja) {
        setReciboCajaData(data.reciboCaja);
        setShowReciboModal(true);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoAbono(false);
    }
  };

  // Abrir Historial de Abonos
  const handleAbrirHistorial = (item) => {
    setHistorialFactura(item);
    setShowHistorialModal(true);
  };

  // Generar Recordatorio o Estado de Cuenta por WhatsApp
  const handleWhatsAppRecordatorio = (item) => {
    const isVencida = item.estadoCartera === 'Vencida';
    const diasTexto = isVencida 
      ? `🚨 Se encuentra *VENCIDA* por *${item.diasVencido} días*.`
      : `📅 Fecha límite de pago: *${new Date(item.fechaVencimiento).toLocaleDateString('es-CO')}*.`;

    const mensaje = `*MULTINYECTORES COLOMBIA*
_Inyección Electrónica Automotriz & Repuestos_

¡Hola, *${item.cliente || 'Estimado Cliente'}*! 👋

Le compartimos el estado de cuenta de su crédito correspondiente a la factura *${item.facturaNo}*:

📄 *Factura:* ${item.facturaNo}
💰 *Valor Facturado:* ${formatCurrency(item.total)}
💵 *Total Abonado a la Fecha:* ${formatCurrency(item.totalAbonado)}
📌 *SALDO PENDIENTE POR PAGAR:* ${formatCurrency(item.saldoPendiente)}
${diasTexto}

💳 *Medios de Pago Autorizados:*
• Bancolombia / Nequi / Daviplata / PSE
• En ventanilla en nuestras sedes de Multinyectores

Agradecemos enviar su soporte de pago a esta línea. Para cualquier inquietud comuníquese al *(602) 224-5000*.

¡Muchas gracias por su confianza y puntualidad! 🚗💨`;

    setWhatsAppData({
      tipoDoc: 'Estado de Cuenta',
      numero: item.facturaNo,
      cliente: item.cliente,
      telefono: item.telefono || '',
      mensaje
    });
    setShowWhatsAppModal(true);
  };

  // Enviar Recibo de Caja por WhatsApp
  const handleWhatsAppReciboCaja = (recibo) => {
    const tokenRecibo = recibo.token_publico || recibo.id || recibo.reciboNo?.replace(/\D/g, '');
    const publicUrl = `${window.location.origin}/cartera/recibo-caja/${tokenRecibo}/public`;
    const mensaje = `*MULTINYECTORES COLOMBIA*
_Comprobante Oficial de Ingreso de Dinero_

¡Hola, *${recibo.cliente || 'Estimado Cliente'}*! 👋

Confirmamos la recepción de su abono con el siguiente recibo de caja:

🧾 *RECIBO DE CAJA:* ${recibo.reciboNo}
📄 *Factura Aplicada:* ${recibo.facturaNo}
📅 *Fecha:* ${new Date(recibo.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
💵 *Monto Abonado:* ${formatCurrency(recibo.monto)}
💳 *Método de Pago:* ${recibo.metodoPago} ${recibo.referencia ? `[Ref: ${recibo.referencia}]` : ''}

📊 *Saldo Anterior:* ${formatCurrency(recibo.saldoAnterior)}
📌 *NUEVO SALDO RESTANTE:* ${recibo.saldoNuevo <= 0.01 ? 'PAZ Y SALVO ($0) 🎉' : formatCurrency(recibo.saldoNuevo)}

📥 *Ver / Descargar Recibo Oficial:*
${publicUrl}

¡Gracias por su pago en *Multinyectores Colombia*! 🚗💨`;

    setWhatsAppData({
      tipoDoc: 'Recibo de Caja',
      numero: recibo.reciboNo,
      cliente: recibo.cliente,
      telefono: recibo.telefono || '',
      mensaje
    });
    setShowWhatsAppModal(true);
  };

  // Exportar Excel
  const handleExportarExcel = () => {
    const data = items.map(it => ({
      'No. Factura': it.facturaNo,
      'Cliente': it.cliente,
      'Documento': it.documento || '',
      'Teléfono': it.telefono || '',
      'Sede / Bodega': it.almacenNombre,
      'Fecha Emisión': it.fechaEmision ? new Date(it.fechaEmision).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '',
      'Fecha Vencimiento': it.fechaVencimiento ? new Date(it.fechaVencimiento).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '',
      'Días Vencido': it.diasVencido > 0 ? it.diasVencido : 0,
      'Estado Cartera': it.estadoCartera,
      'Total Factura': it.total,
      'Total Abonado': it.totalAbonado,
      'Saldo Pendiente': it.saldoPendiente
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cartera_Clientes');
    XLSX.writeFile(wb, `Cartera_Multinyectores_${hoyColombia()}.xlsx`);
  };

  return (
    <div className="container" style={{ maxWidth: '1300px', margin: '0 auto', padding: '16px' }}>
      
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaFileInvoiceDollar color="#2563eb" /> Cartera & Cuentas por Cobrar
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Control de facturas a crédito, plazos de vencimiento, cartera vencida y registro de abonos con recibo de caja.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={fetchCartera} 
            className="btn btn-secundario" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={loading}
          >
            <MdRefresh className={loading ? 'spin' : ''} /> Actualizar
          </button>
          <button 
            onClick={handleExportarExcel} 
            className="btn btn-principal" 
            style={{ backgroundColor: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={items.length === 0}
          >
            <FaFileExcel /> Exportar Excel
          </button>
        </div>
      </div>

      {/* TARJETAS KPI DE CARTERA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTAL CARTERA POR COBRAR</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
            {formatCurrency(kpis.totalCartera)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {kpis.clientesDeudores} clientes con saldo activo
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444', background: kpis.totalVencido > 0 ? '#fff5f5' : '#ffffff' }}>
          <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>CARTERA VENCIDA</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
            {formatCurrency(kpis.totalVencido)}
          </div>
          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
            Facturas con plazo superado
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>CARTERA AL DÍA</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
            {formatCurrency(kpis.totalAlDia)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
            Dentro del plazo de crédito
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #0891b2' }}>
          <div style={{ fontSize: '12px', color: '#0e7490', fontWeight: 600 }}>RECAUDADO EN ABONOS (ESTE MES)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0891b2', marginTop: '4px' }}>
            {formatCurrency(kpis.totalRecaudadoMes)}
          </div>
          <div style={{ fontSize: '11px', color: '#0e7490', marginTop: '4px' }}>
            Ingresos certificados en caja
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative' }}>
            <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, documento o N° Factura..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="input" 
              style={{ paddingLeft: '34px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Filtro Estado */}
          <div>
            <select 
              value={filtroEstado} 
              onChange={e => setFiltroEstado(e.target.value)} 
              className="input" 
              style={{ width: '100%' }}
            >
              <option value="Pendientes">⏳ Facturas con Saldo Pendiente</option>
              <option value="Vencidas">🚨 Solo Cartera Vencida</option>
              <option value="AlDia">🟢 Solo Cartera al Día</option>
              <option value="PazYSalvo">✓ Pagadas / Paz y Salvo</option>
              <option value="Todos">Todas las Facturas a Crédito</option>
            </select>
          </div>

          {/* Filtro Sede */}
          <div>
            <select 
              value={filtroAlmacen} 
              onChange={e => setFiltroAlmacen(e.target.value)} 
              className="input" 
              style={{ width: '100%' }}
            >
              <option value="Todos">Todas las Sedes / Bodegas</option>
              {almacenes.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MENSAJES DE ERROR */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* TABLA PRINCIPAL DE CARTERA */}
      <div className="card" style={{ padding: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#1e293b', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px' }}>Factura #</th>
                <th style={{ padding: '12px' }}>Cliente / Deudor</th>
                <th style={{ padding: '12px' }}>Sede</th>
                <th style={{ padding: '12px' }}>Emisión</th>
                <th style={{ padding: '12px' }}>Vencimiento</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Abonado</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Saldo Pendiente</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Cargando cuentas por cobrar...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    No se encontraron cuentas por cobrar con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map(it => {
                  const isPazYSalvo = it.estadoCartera === 'Paz y Salvo';
                  const isVencida = it.estadoCartera === 'Vencida';

                  return (
                    <tr key={it.id} style={{ borderBottom: '1px solid #edf2f7', background: isVencida ? '#fffdfd' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>
                        {it.facturaNo}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {it.cliente}
                        </div>
                        {it.documento && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Doc: {it.documento} {it.telefono ? `• Tel: ${it.telefono}` : ''}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px', color: '#475569' }}>
                        {it.almacenNombre}
                      </td>

                      <td style={{ padding: '12px', color: '#475569' }}>
                        {it.fechaEmision ? new Date(it.fechaEmision).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '-'}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: isVencida ? '#dc2626' : '#1e293b' }}>
                          {new Date(it.fechaVencimiento).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                        </div>
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>
                          {isPazYSalvo ? (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Cancelado</span>
                          ) : isVencida ? (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>
                              🚨 {it.diasVencido} {it.diasVencido === 1 ? 'día vencido' : 'días vencidos'}
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a' }}>
                              En plazo ({Math.abs(it.diasVencido)} días rest.)
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        {formatCurrency(it.total)}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                        {formatCurrency(it.totalAbonado)}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: '14px', color: isPazYSalvo ? '#16a34a' : isVencida ? '#dc2626' : '#1e3a8a' }}>
                        {isPazYSalvo ? '$0 (Paz y Salvo)' : formatCurrency(it.saldoPendiente)}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isPazYSalvo && (
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            ✓ Paz y Salvo
                          </span>
                        )}
                        {isVencida && (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            🚨 Vencida
                          </span>
                        )}
                        {!isPazYSalvo && !isVencida && (
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            🟢 Al Día
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                          
                          {/* Botón Registrar Abono */}
                          {!isPazYSalvo && (
                            <button 
                              className="btn" 
                              style={{ 
                                padding: '5px 9px', 
                                background: '#16a34a', 
                                color: '#ffffff', 
                                border: 'none', 
                                fontWeight: 600, 
                                fontSize: '11px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                borderRadius: '4px'
                              }}
                              onClick={() => handleAbrirAbono(it)} 
                              title="Registrar Abono a esta Factura"
                            >
                              <MdAttachMoney size={14} /> Abonar
                            </button>
                          )}

                          {/* Botón Ver Historial de Abonos */}
                          {it.abonos && it.abonos.length > 0 && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
                              onClick={() => handleAbrirHistorial(it)} 
                              title="Ver historial de abonos y recibos de caja"
                            >
                              <MdHistory size={16} />
                            </button>
                          )}

                          {/* Botón Recordatorio WhatsApp */}
                          {!isPazYSalvo && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#f0fdf4', color: '#25D366', border: '1px solid #bbf7d0' }}
                              onClick={() => handleWhatsAppRecordatorio(it)} 
                              title="Enviar estado de cuenta y recordatorio de pago por WhatsApp"
                            >
                              <FaWhatsapp size={16} />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REGISTRAR ABONO */}
      {showAbonoModal && facturaSeleccionada && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '520px', width: '90%', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MdAttachMoney size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    Registrar Abono a Factura
                  </h3>
                  <small style={{ color: '#64748b' }}>
                    {facturaSeleccionada.facturaNo} • {facturaSeleccionada.cliente}
                  </small>
                </div>
              </div>
              <button onClick={() => setShowAbonoModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {/* Resumen de Cuenta */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Total de la Factura:</span><br />
                <b>{formatCurrency(facturaSeleccionada.total)}</b>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total Abonado Previo:</span><br />
                <b style={{ color: '#16a34a' }}>{formatCurrency(facturaSeleccionada.totalAbonado)}</b>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Saldo Pendiente Actual:</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(facturaSeleccionada.saldoPendiente)}</span>
              </div>
            </div>

            <form onSubmit={handleGuardarAbono}>
              
              {/* Monto del Abono */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                    Monto a Abonar ($) *
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setMontoAbono(facturaSeleccionada.saldoPendiente)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                  >
                    Abonar Totalidad ({formatCurrency(facturaSeleccionada.saldoPendiente)})
                  </button>
                </div>
                <input 
                  type="number" 
                  step="any" 
                  min="1" 
                  max={Math.ceil(facturaSeleccionada.saldoPendiente)}
                  value={montoAbono} 
                  onChange={e => setMontoAbono(e.target.value)} 
                  placeholder="Ej: 50000" 
                  className="input" 
                  style={{ width: '100%', fontSize: '16px', fontWeight: 700, color: '#16a34a' }}
                  required
                />
              </div>

              {/* Cálculo en vivo de Nuevo Saldo */}
              {Number(montoAbono) > 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Nuevo Saldo Restante:</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: (facturaSeleccionada.saldoPendiente - Number(montoAbono)) <= 0.01 ? '#15803d' : '#b91c1c' }}>
                    {(facturaSeleccionada.saldoPendiente - Number(montoAbono)) <= 0.01 
                      ? 'PAZ Y SALVO ($0) 🎉' 
                      : formatCurrency(Math.max(0, facturaSeleccionada.saldoPendiente - Number(montoAbono)))}
                  </span>
                </div>
              )}

              {/* Método de Pago */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                  Método de Pago con el que se Recibió el Dinero *
                </label>
                <select 
                  value={metodoPagoAbono} 
                  onChange={e => setMetodoPagoAbono(e.target.value)} 
                  className="input" 
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Transferencia">📱 Transferencia (Nequi / Daviplata / Bancolombia / PSE)</option>
                  <option value="Tarjeta">💳 Tarjeta Débito / Crédito</option>
                </select>
              </div>

              {/* Referencia Bancaria */}
              {metodoPagoAbono.toLowerCase().includes('trans') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                    Número de Comprobante / Referencia Bancaria
                  </label>
                  <input 
                    type="text" 
                    value={referenciaAbono} 
                    onChange={e => setReferenciaAbono(e.target.value)} 
                    placeholder="Ej: M12345678 / Aprobación 9876" 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>
              )}

              {/* Observaciones */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                  Observaciones de Caja (Opcional)
                </label>
                <textarea 
                  rows={2} 
                  value={observacionesAbono} 
                  onChange={e => setObservacionesAbono(e.target.value)} 
                  placeholder="Detalles del abono o autorización..." 
                  className="input" 
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAbonoModal(false)} className="btn btn-secundario">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={guardandoAbono || !Number(montoAbono)} 
                  className="btn btn-principal" 
                  style={{ backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <MdCheckCircle size={16} /> {guardandoAbono ? 'Registrando...' : 'Registrar Abono y Generar Recibo'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL RECIBO DE CAJA OFICIAL */}
      {showReciboModal && reciboCajaData && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '520px', width: '90%', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MdReceipt size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    Recibo de Caja Oficial {reciboCajaData.reciboNo}
                  </h3>
                  <small style={{ color: '#16a34a', fontWeight: 600 }}>✓ Abono Registrado Exitosamente</small>
                </div>
              </div>
              <button onClick={() => setShowReciboModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {/* Ticket POS Recibo de Caja */}
            <div id="printable-recibo" style={{ fontFamily: 'monospace', fontSize: '12px', color: '#000', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', background: '#fafafa', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{reciboCajaData.empresa?.nombre || 'MULTINYECTORES COLOMBIA'}</h3>
                <div>NIT: {reciboCajaData.empresa?.nit || '900.123.456-7'}</div>
                <div>{reciboCajaData.empresa?.direccion || 'Tuluá - Valle del Cauca'}</div>
                <div>Tel: {reciboCajaData.empresa?.telefono || '(602) 224-5000'}</div>
                <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '13px', background: '#000', color: '#fff', padding: '2px 6px' }}>
                  RECIBO DE CAJA {reciboCajaData.reciboNo}
                </div>
              </div>

              <div style={{ marginBottom: '10px', lineHeight: '1.5' }}>
                <div><b>Fecha:</b> {new Date(reciboCajaData.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
                <div><b>Factura:</b> {reciboCajaData.facturaNo}</div>
                <div><b>Recibido de:</b> {reciboCajaData.cliente}</div>
                <div><b>Doc / NIT:</b> {reciboCajaData.documento || 'Venta Mostrador'}</div>
                <div><b>Método:</b> {reciboCajaData.metodoPago} {reciboCajaData.referencia ? `[Ref: ${reciboCajaData.referencia}]` : ''}</div>
                <div><b>Cajero:</b> {reciboCajaData.usuarioNombre || 'Caja'}</div>
              </div>

              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0', margin: '10px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#333' }}>VALOR DEL ABONO RECIBIDO</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(reciboCajaData.monto)}</div>
              </div>

              <div style={{ lineHeight: '1.5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Saldo Anterior:</span>
                  <span>{formatCurrency(reciboCajaData.saldoAnterior)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Abono Aplicado:</span>
                  <span>-{formatCurrency(reciboCajaData.monto)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '4px' }}>
                  <span>Nuevo Saldo:</span>
                  <span>{reciboCajaData.saldoNuevo <= 0.01 ? 'PAZ Y SALVO ($0)' : formatCurrency(reciboCajaData.saldoNuevo)}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', color: '#555' }}>
                Comprobante oficial expedido por Multinyectores Colombia. Conserve este recibo como constancia de su pago.
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                type="button" 
                onClick={() => handleWhatsAppReciboCaja(reciboCajaData)} 
                className="btn" 
                style={{ backgroundColor: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, border: 'none' }}
              >
                <FaWhatsapp size={16} /> Enviar Recibo por WhatsApp
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} className="btn btn-principal" style={{ backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MdPrint size={16} /> Imprimir Recibo
                </button>
                <button onClick={() => setShowReciboModal(false)} className="btn btn-secundario">
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE ABONOS */}
      {showHistorialModal && historialFactura && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '650px', width: '90%', background: '#ffffff', borderRadius: '12px', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MdHistory color="#2563eb" /> Historial de Abonos • {historialFactura.facturaNo}
                </h3>
                <small style={{ color: '#64748b' }}>
                  Cliente: <b>{historialFactura.cliente}</b> • Total Factura: <b>{formatCurrency(historialFactura.total)}</b>
                </small>
              </div>
              <button onClick={() => setShowHistorialModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={18} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Recibo #</th>
                    <th style={{ padding: '8px' }}>Fecha</th>
                    <th style={{ padding: '8px' }}>Método</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Saldo Restante</th>
                    <th style={{ padding: '8px' }}>Cajero</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(historialFactura.abonos || []).map(ab => (
                    <tr key={ab.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#2563eb' }}>{ab.recibo_caja_no}</td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{new Date(ab.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</td>
                      <td style={{ padding: '8px' }}>
                        {ab.metodoPago} {ab.referencia ? <small style={{ color: '#64748b' }}>({ab.referencia})</small> : ''}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatCurrency(ab.monto)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                        {ab.saldo_nuevo <= 0.01 ? 'Paz y Salvo' : formatCurrency(ab.saldo_nuevo)}
                      </td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{ab.usuarioNombre || 'Caja'}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button 
                          className="btn" 
                          style={{ padding: '4px 6px', background: '#f0fdf4', color: '#25D366', border: '1px solid #bbf7d0' }}
                          onClick={() => handleWhatsAppReciboCaja({
                            ...ab,
                            reciboNo: ab.recibo_caja_no,
                            facturaNo: historialFactura.facturaNo,
                            cliente: historialFactura.cliente,
                            documento: historialFactura.documento,
                            telefono: historialFactura.telefono,
                            saldoAnterior: ab.saldo_anterior,
                            saldoNuevo: ab.saldo_nuevo
                          })}
                          title="Enviar este recibo por WhatsApp"
                        >
                          <FaWhatsapp size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHistorialModal(false)} className="btn btn-secundario">
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL WHATSAPP */}
      <WhatsAppModal 
        isOpen={showWhatsAppModal} 
        onClose={() => setShowWhatsAppModal(false)} 
        data={whatsAppData} 
      />

    </div>
  );
}

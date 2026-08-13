import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency, parsePrecio } from './utils/formatters';
import { toast } from 'react-toastify';
import { 
  MdPointOfSale, MdLockOpen, MdLock, MdRefresh, MdHistory,
  MdAttachMoney, MdAccountBalanceWallet, MdCreditCard, MdSwapHoriz,
  MdCheckCircle, MdWarning, MdClose, MdReceipt, MdAssignmentTurnedIn
} from 'react-icons/md';
import { FaMoneyBillWave, FaCashRegister } from 'react-icons/fa';

function Caja({ usuario }) {
  const [loading, setLoading] = useState(false);
  const [estadoCaja, setEstadoCaja] = useState({ abierta: false, caja: null, resumen: null });
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Modal Apertura State
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [montoApertura, setMontoApertura] = useState('');
  const [obsApertura, setObsApertura] = useState('');
  const [procesandoApertura, setProcesandoApertura] = useState(false);

  // Modal Cierre / Arqueo State
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [montoCierreFisico, setMontoCierreFisico] = useState('');
  const [obsCierre, setObsCierre] = useState('');
  const [procesandoCierre, setProcesandoCierre] = useState(false);

  const tokenHeader = useMemo(() => {
    const token = usuario?.token || localStorage.getItem('token') || '';
    return token ? `Bearer ${token}` : '';
  }, [usuario?.token]);

  // Cargar Estado de Caja
  const fetchEstadoCaja = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/caja/estado', {
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('No se pudo obtener estado de caja');
      const data = await res.json();
      setEstadoCaja(data);
    } catch (err) {
      toast.error('Error al consultar estado de caja');
    } finally {
      setLoading(false);
    }
  }, [tokenHeader]);

  // Cargar Historial de Cierres
  const fetchHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const res = await fetch('/api/caja/historial', {
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('No se pudo obtener historial');
      const data = await res.json();
      setHistorial(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, [tokenHeader]);

  useEffect(() => {
    fetchEstadoCaja();
    fetchHistorial();
  }, [fetchEstadoCaja, fetchHistorial]);

  // Guardar Apertura de Caja
  const handleApertura = async (e) => {
    e.preventDefault();
    const montoNum = parsePrecio(montoApertura) || 0;
    if (montoNum < 0) {
      toast.error('El monto de apertura no puede ser negativo');
      return;
    }

    setProcesandoApertura(true);
    try {
      const res = await fetch('/api/caja/apertura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({
          monto_apertura: montoNum,
          observaciones: obsApertura
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al abrir caja');

      toast.success('🟢 ¡Turno de Caja abierto exitosamente!');
      setShowAperturaModal(false);
      setMontoApertura('');
      setObsApertura('');
      fetchEstadoCaja();
      fetchHistorial();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesandoApertura(false);
    }
  };

  // Guardar Cierre de Caja (Arqueo)
  const handleCierre = async (e) => {
    e.preventDefault();
    const cierreNum = parsePrecio(montoCierreFisico) || 0;

    setProcesandoCierre(true);
    try {
      const res = await fetch('/api/caja/cierre', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({
          monto_cierre: cierreNum,
          observaciones: obsCierre
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al realizar el arqueo/cierre de caja');

      const dif = Number(data.resumen?.diferencia || 0);
      let msg = '🔴 Cierre de caja completado con éxito.';
      if (dif === 0) msg += ' ¡Caja cuadrada perfectamente!';
      else if (dif > 0) msg += ` Sobrante registrado: ${formatCurrency(dif)}`;
      else msg += ` Faltante registrado: ${formatCurrency(dif)}`;

      toast.success(msg);
      setShowCierreModal(false);
      setMontoCierreFisico('');
      setObsCierre('');
      fetchEstadoCaja();
      fetchHistorial();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesandoCierre(false);
    }
  };

  const resumen = estadoCaja.resumen || {};
  const cajaActiva = estadoCaja.caja;

  // Cálculo de diferencia dinámica en el modal de cierre
  const efEsperado = Number(resumen.efectivoEsperadoEnCaja || 0);
  const efFisicoIngresado = parsePrecio(montoCierreFisico) || 0;
  const difCalculada = efFisicoIngresado - efEsperado;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdPointOfSale color="#2b6cb0" /> Control de Caja y Arqueo Diario
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Apertura de turnos, arqueo de dinero en efectivo, balance por método de pago y cierres diarios.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => { fetchEstadoCaja(); fetchHistorial(); }} 
            className="btn btn-secundario" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748' }}
          >
            <MdRefresh size={18} /> Actualizar
          </button>

          {!estadoCaja.abierta ? (
            <button 
              onClick={() => setShowAperturaModal(true)} 
              className="btn btn-principal" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#38a169' }}
            >
              <MdLockOpen size={20} /> Apertura de Turno
            </button>
          ) : (
            <button 
              onClick={() => setShowCierreModal(true)} 
              className="btn btn-principal" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#e53e3e' }}
            >
              <MdLock size={20} /> Realizar Cierre de Caja (Arqueo)
            </button>
          )}
        </div>
      </div>

      {/* BANNER DE ESTADO ACTUAL DE CAJA */}
      <div className="card" style={{ 
        padding: '20px', 
        marginBottom: '24px', 
        borderRadius: '12px', 
        borderLeft: `6px solid ${estadoCaja.abierta ? '#38a169' : '#e53e3e'}`,
        background: estadoCaja.abierta ? '#f0fff4' : '#fff5f5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className={`badge ${estadoCaja.abierta ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '6px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {estadoCaja.abierta ? '🟢 CAJA ABIERTA (TURNO ACTIVO)' : '🔴 CAJA CERRADA (SIN TURNO)'}
            </span>
            {cajaActiva && (
              <div style={{ marginTop: '8px', color: '#2d3748', fontSize: '13px' }}>
                <b>Cajero / Usuario:</b> {cajaActiva.usuarioNombre} | <b>Apertura:</b> {new Date(cajaActiva.fecha_apertura).toLocaleString('es-CO')}
                {cajaActiva.observaciones && <div style={{ color: '#718096', fontStyle: 'italic', marginTop: '2px' }}>"{cajaActiva.observaciones}"</div>}
              </div>
            )}
            {!estadoCaja.abierta && (
              <div style={{ marginTop: '8px', color: '#9b2c2c', fontSize: '13px' }}>
                Para comenzar a registrar ventas con arqueo de caja diario, realice la apertura del turno ingresando el base inicial.
              </div>
            )}
          </div>

          <div>
            {!estadoCaja.abierta ? (
              <button 
                type="button"
                onClick={() => setShowAperturaModal(true)} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  backgroundColor: '#276749', color: '#ffffff', border: 'none',
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', boxShadow: '0 2px 4px rgba(39, 103, 73, 0.3)', transition: 'all 0.15s ease'
                }}
              >
                <MdLockOpen size={18} color="#ffffff" /> Abrir Caja Ahora
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setShowCierreModal(true)} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  backgroundColor: '#c53030', color: '#ffffff', border: 'none',
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', boxShadow: '0 2px 4px rgba(197, 48, 48, 0.3)', transition: 'all 0.15s ease'
                }}
              >
                <MdLock size={18} color="#ffffff" /> Arqueo y Cierre de Caja
              </button>
            )}
          </div>
        </div>
      </div>

      {/* METRICAS DE LA CAJA ACTIVA (SI ESTA ABIERTA) */}
      {estadoCaja.abierta && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          
          <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #3182ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Base / Apertura</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2b6cb0', marginTop: '4px' }}>
              {formatCurrency(resumen.montoApertura || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Fondo inicial de caja</div>
          </div>

          <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Ventas en Efectivo</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>
              {formatCurrency(resumen.totalEfectivo || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Dinero físico recibido</div>
          </div>

          <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #d69e2e', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Transferencias / Nequi</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#744210', marginTop: '4px' }}>
              {formatCurrency(resumen.totalTransferencia || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Bancos y monederos</div>
          </div>

          <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Tarjetas / Débito</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>
              {formatCurrency(resumen.totalTarjeta || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Pagos por datáfono</div>
          </div>

          <div className="card" style={{ padding: '16px', background: '#ebf8ff', borderRadius: '10px', borderLeft: '4px solid #2b6cb0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#2b6cb0', textTransform: 'uppercase', fontWeight: 700 }}>Efectivo Esperado en Caja</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1a365d', marginTop: '4px' }}>
              {formatCurrency(resumen.efectivoEsperadoEnCaja || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#2c5282', marginTop: '2px' }}>Base + Efectivo ventas</div>
          </div>

        </div>
      )}

      {/* HISTORIAL DE ARQUEOS Y CIERRES DE CAJA */}
      <div className="card" style={{ padding: '20px', borderRadius: '10px', background: '#ffffff' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#2b6cb0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdHistory /> Historial de Cierres de Caja y Arqueos
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#edf2f7', color: '#2d3748', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>ID</th>
                <th style={{ padding: '10px' }}>Usuario / Cajero</th>
                <th style={{ padding: '10px' }}>Fecha Apertura</th>
                <th style={{ padding: '10px' }}>Fecha Cierre</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Monto Apertura</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Efectivo Esperado</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Cierre Físico</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Diferencia</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistorial && historial.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#718096' }}>
                    Cargando historial de cierres...
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#a0aec0' }}>
                    No hay cierres de caja registrados previamente.
                  </td>
                </tr>
              ) : (
                historial.map(c => {
                  const dif = Number(c.diferencia || 0);
                  const isClosed = c.estado === 'Cerrada';

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2b6cb0' }}>#{c.id}</td>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#2d3748' }}>{c.usuarioNombre}</td>
                      <td style={{ padding: '10px', color: '#4a5568' }}>{c.fecha_apertura ? new Date(c.fecha_apertura).toLocaleString('es-CO') : '-'}</td>
                      <td style={{ padding: '10px', color: '#4a5568' }}>{c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-CO') : '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#2b6cb0' }}>{formatCurrency(c.monto_apertura || 0)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#4a5568', fontWeight: 600 }}>{isClosed ? formatCurrency(c.monto_esperado || 0) : '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#276749' }}>{isClosed ? formatCurrency(c.monto_cierre || 0) : '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {!isClosed ? '-' : dif === 0 ? (
                          <span style={{ background: '#f0fff4', color: '#276749', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, fontSize: '11px' }}>
                            ✓ Cuadrada
                          </span>
                        ) : dif > 0 ? (
                          <span style={{ background: '#feebc8', color: '#744210', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, fontSize: '11px' }}>
                            +{formatCurrency(dif)}
                          </span>
                        ) : (
                          <span style={{ background: '#fff5f5', color: '#c53030', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, fontSize: '11px' }}>
                            {formatCurrency(dif)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span className={`badge ${isClosed ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '11px' }}>
                          {c.estado}
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

      {/* MODAL APERTURA DE CAJA */}
      {showAperturaModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #c6f6d5', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#276749', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdLockOpen /> Apertura de Turno de Caja
              </h3>
              <button onClick={() => setShowAperturaModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            <form onSubmit={handleApertura} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-field">
                <label style={{ fontWeight: 600, color: '#2d3748' }}>Monto Base Inicial de Caja ($) *</label>
                <input 
                  type="text" 
                  className="input" 
                  value={montoApertura} 
                  onChange={e => setMontoApertura(e.target.value)} 
                  placeholder="Ej: 100000" 
                  required 
                  style={{ fontSize: '16px', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>Dinero físico disponible en caja para dar vuelto/cambio.</span>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600, color: '#2d3748' }}>Observaciones de Apertura</label>
                <textarea 
                  className="input" 
                  rows={2} 
                  value={obsApertura} 
                  onChange={e => setObsApertura(e.target.value)} 
                  placeholder="Ej: Inicio de turno mañana. Billetes de baja denominación."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowAperturaModal(false)}>Cancelar</button>
                <button type="submit" disabled={procesandoApertura} className="btn btn-principal" style={{ backgroundColor: '#38a169' }}>
                  {procesandoApertura ? 'Procesando...' : '🟢 Abrir Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE / ARQUEO DE CAJA */}
      {showCierreModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '520px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #fed7d7', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#c53030', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdLock /> Arqueo y Cierre de Caja
              </h3>
              <button onClick={() => setShowCierreModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            <form onSubmit={handleCierre} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Base Inicial:</span> <b>{formatCurrency(resumen.montoApertura || 0)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Ventas Efectivo:</span> <b style={{ color: '#276749' }}>+{formatCurrency(resumen.totalEfectivo || 0)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e0', paddingTop: '6px', fontSize: '14px', fontWeight: 700, color: '#1a365d' }}>
                  <span>Efectivo Esperado en Caja:</span> <span>{formatCurrency(efEsperado)}</span>
                </div>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600, color: '#2d3748' }}>Dinero Físico Contado en Caja ($) *</label>
                <input 
                  type="text" 
                  className="input" 
                  value={montoCierreFisico} 
                  onChange={e => setMontoCierreFisico(e.target.value)} 
                  placeholder="Ingrese el monto físico total contado..." 
                  required 
                  style={{ fontSize: '16px', fontWeight: 'bold' }}
                />
              </div>

              {montoCierreFisico !== '' && (
                <div style={{ 
                  padding: '10px', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  textAlign: 'center',
                  background: difCalculada === 0 ? '#f0fff4' : difCalculada > 0 ? '#feebc8' : '#fff5f5',
                  color: difCalculada === 0 ? '#276749' : difCalculada > 0 ? '#744210' : '#c53030',
                  border: `1px solid ${difCalculada === 0 ? '#c6f6d5' : difCalculada > 0 ? '#fef08a' : '#feb2b2'}`
                }}>
                  {difCalculada === 0 ? '✅ Caja Cuadrada (Diferencia: $0)' : difCalculada > 0 ? `🟢 Sobrante en Caja: +${formatCurrency(difCalculada)}` : `⚠️ Faltante en Caja: ${formatCurrency(difCalculada)}`}
                </div>
              )}

              <div className="form-field">
                <label style={{ fontWeight: 600, color: '#2d3748' }}>Observaciones del Cierre</label>
                <textarea 
                  className="input" 
                  rows={2} 
                  value={obsCierre} 
                  onChange={e => setObsCierre(e.target.value)} 
                  placeholder="Notas adicionales sobre el arqueo (ej: billete deteriorado, ajuste de sencillo)..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowCierreModal(false)}>Cancelar</button>
                <button type="submit" disabled={procesandoCierre} className="btn btn-principal" style={{ backgroundColor: '#e53e3e' }}>
                  {procesandoCierre ? 'Procesando Arqueo...' : '🔴 Confirmar Cierre de Caja'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Caja;

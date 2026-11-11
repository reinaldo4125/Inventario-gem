import React, { useState, useRef, useEffect } from 'react';
import { MdReceipt, MdEdit, MdDelete, MdUndo, MdCheckCircle, MdBlock, MdStore, MdPerson } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { formatCurrency } from './utils/formatters';
import { puede } from './config/permisos';

const FacturaTable = ({ 
  facturas = [], 
  loading = false, 
  handleVerFactura, 
  handleAbrirWhatsApp,
  handleEdit, 
  handleAbrirEditar,
  handleAbrirCertificar,
  handleDelete, 
  handleAbrirAnular,
  handleIrACartera,
  usuario 
}) => {
  const canEdit = puede(usuario, 'facturas.crear');
  const onEditar = handleAbrirEditar || handleEdit;

  return (
    <div className="card" style={{ padding: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#edf2f7', color: '#2d3748', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Factura #</th>
              <th style={{ padding: '12px' }}>N° Venta</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Cliente</th>
              <th style={{ padding: '12px' }}>Bodega / Sede</th>
              <th style={{ padding: '12px' }}>Método Pago</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Total Facturado</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && facturas.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                  Cargando facturas...
                </td>
              </tr>
            ) : facturas.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                  No se encontraron facturas registradas.
                </td>
              </tr>
            ) : (
              facturas.map(f => {
                const isAnulada = f.estadoVenta === 'Anulada' || (f.notas && f.notas.includes('[ANULADA]'));
                const isEnCartera = f.estadoVenta === 'En Cartera' || f.enCartera;
                const isPendiente = f.estadoVenta === 'Pendiente' && !isEnCartera;

                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #edf2f7', opacity: isAnulada ? 0.65 : 1 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2b6cb0' }}>
                      FAC-{f.id}
                    </td>

                    <td style={{ padding: '12px', color: '#4a5568' }}>
                      {f.ventaId ? `#${f.ventaId}` : '-'}
                    </td>

                    <td style={{ padding: '12px', color: '#4a5568' }}>
                      {f.fecha ? new Date(f.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Bogota' }) : '-'}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#2d3748' }}>
                        {f.cliente || 'Cliente General'}
                      </div>
                      {f.documento && (
                        <div style={{ fontSize: '11px', color: '#718096' }}>
                          Doc: {f.documento}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px', color: '#4a5568' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MdStore size={14} color="#718096" /> {f.almacenNombre || (f.almacen && f.almacen.nombre) || 'Sede Principal'}
                      </span>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: '12px', background: '#edf2f7', padding: '2px 8px', borderRadius: '12px', color: '#2d3748', fontWeight: 500 }}>
                        {f.metodoPago || 'Efectivo'}
                      </span>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {isAnulada ? (
                        <span className="badge badge-danger" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          <MdBlock size={13} style={{ marginRight: '3px' }} /> Anulada
                        </span>
                      ) : isEnCartera ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span 
                            style={{ 
                              background: '#f3e8ff', 
                              color: '#6b21a8', 
                              border: '1px solid #c084fc', 
                              padding: '4px 8px', 
                              borderRadius: '12px', 
                              fontWeight: 700, 
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title={`Factura a Crédito en Cartera. Saldo pendiente: ${formatCurrency(f.saldoPendiente != null ? f.saldoPendiente : f.total)}`}
                          >
                            📑 En Cartera
                          </span>
                          {f.saldoPendiente > 0 && (
                            <span style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 600 }}>
                              Resta: {formatCurrency(f.saldoPendiente)}
                            </span>
                          )}
                        </div>
                      ) : isPendiente ? (
                        <button
                          type="button"
                          onClick={() => handleAbrirCertificar && handleAbrirCertificar(f)}
                          style={{
                            background: '#feebc8',
                            color: '#744210',
                            border: '1px solid #fbd38d',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Clic para certificar ingreso del dinero y facturar"
                        >
                          ⏳ Pendiente de Pago
                        </button>
                      ) : (
                        <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          <MdCheckCircle size={13} style={{ marginRight: '3px' }} /> Pagada
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: isAnulada ? '#a0aec0' : '#276749', fontSize: '14px' }}>
                      {formatCurrency(f.total || 0)}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                        
                        {/* Botón Certificar Pago si está Pendiente */}
                        {isPendiente && !isAnulada && handleAbrirCertificar && (
                          <button 
                            className="btn" 
                            style={{ 
                              padding: '5px 9px', 
                              background: '#2f855a', 
                              color: '#ffffff', 
                              border: 'none', 
                              fontWeight: 600, 
                              fontSize: '11px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              borderRadius: '4px'
                            }}
                            onClick={() => handleAbrirCertificar(f)} 
                            title="Validar Factura, Certificar Ingreso del Dinero y Facturar"
                          >
                            <MdCheckCircle size={14} /> Facturar
                          </button>
                        )}

                        {/* Botón Ir a Cartera si la factura está en Cartera */}
                        {isEnCartera && !isAnulada && handleIrACartera && (
                          <button 
                            className="btn" 
                            style={{ 
                              padding: '5px 9px', 
                              background: '#7c3aed', 
                              color: '#ffffff', 
                              border: 'none', 
                              fontWeight: 600, 
                              fontSize: '11px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleIrACartera(f)} 
                            title="Ver en Cartera / Registrar Abono"
                          >
                            💰 Cartera
                          </button>
                        )}

                        {/* Botón Ver e Imprimir */}
                        <button 
                          className="btn" 
                          style={{ padding: '6px', background: '#ebf8ff', color: '#3182ce', border: '1px solid #bee3f8' }}
                          onClick={() => handleVerFactura(f.id)} 
                          title="Ver e Imprimir Factura"
                        >
                          <MdReceipt size={16} />
                        </button>

                        {/* Botón Enviar Factura por WhatsApp */}
                        {handleAbrirWhatsApp && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#f0fff4', color: '#25D366', border: '1px solid #bbf7d0' }}
                            onClick={() => handleAbrirWhatsApp(f)} 
                            title="Enviar Factura por WhatsApp al cliente"
                          >
                            <FaWhatsapp size={16} />
                          </button>
                        )}

                        {/* Botón Modificar / Editar Factura */}
                        {canEdit && !isAnulada && onEditar && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#e6fffa', color: '#234e52', border: '1px solid #b2f5ea' }}
                            onClick={() => onEditar(f)} 
                            title="Modificar Datos de la Factura"
                          >
                            <MdEdit size={16} />
                          </button>
                        )}

                        {/* Botón Anular Factura */}
                        {puede(usuario, 'facturas.anular') && !isAnulada && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }}
                            onClick={() => handleAbrirAnular(f)} 
                            title="Anular Factura y Devolver Stock"
                          >
                            <MdUndo size={16} />
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
  );
};

export default FacturaTable;

import React, { useState, useRef, useEffect } from 'react';
import { MdReceipt, MdEdit, MdDelete, MdUndo, MdCheckCircle, MdBlock, MdStore, MdPerson } from 'react-icons/md';
import { formatCurrency } from './utils/formatters';

const FacturaTable = ({ 
  facturas = [], 
  loading = false, 
  handleVerFactura, 
  handleEdit, 
  handleDelete, 
  handleAbrirAnular, 
  usuario 
}) => {
  const isAdmin = usuario?.rol === 'admin';

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
                const isPendiente = f.estadoVenta === 'Pendiente';

                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #edf2f7', opacity: isAnulada ? 0.65 : 1 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2b6cb0' }}>
                      FAC-{f.id}
                    </td>

                    <td style={{ padding: '12px', color: '#4a5568' }}>
                      {f.ventaId ? `#${f.ventaId}` : '-'}
                    </td>

                    <td style={{ padding: '12px', color: '#4a5568' }}>
                      {f.fecha ? new Date(f.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
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
                      ) : isPendiente ? (
                        <span style={{ background: '#feebc8', color: '#744210', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>
                          Pendiente
                        </span>
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
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        
                        <button 
                          className="btn" 
                          style={{ padding: '6px', background: '#ebf8ff', color: '#3182ce', border: '1px solid #bee3f8' }}
                          onClick={() => handleVerFactura(f.id)} 
                          title="Ver e Imprimir Factura"
                        >
                          <MdReceipt size={16} />
                        </button>

                        {isAdmin && !isAnulada && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }}
                            onClick={() => handleAbrirAnular(f)} 
                            title="Anular Factura y Devolver Stock"
                          >
                            <MdUndo size={16} />
                          </button>
                        )}

                        {isAdmin && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#edf2f7', color: '#718096', border: '1px solid #cbd5e0' }}
                            onClick={() => handleDelete(f.id)} 
                            title="Eliminar Registro de Factura"
                          >
                            <MdDelete size={16} />
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

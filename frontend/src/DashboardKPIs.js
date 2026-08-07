import React from 'react';
import { formatCurrency } from './utils/formatters';

const DashboardKPIs = ({ kpis, usuario, stockPorAlmacen = [] }) => {
  const cards = [
    {
      title: 'Ventas hoy',
      value: kpis.ventasHoy ?? 0,
      subtext: 'Cantidad de ventas registradas hoy',
      icon: '🛒',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      textColor: '#1e40af',
      isCurrency: false
    },
    {
      title: 'Ingresos hoy',
      value: formatCurrency(kpis.ingresosHoy ?? 0),
      subtext: 'Ingresos totales generados hoy',
      icon: '💵',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      textColor: '#166534',
      isCurrency: true
    },
    {
      title: 'Ingresos del mes',
      value: formatCurrency(kpis.ingresosMes ?? 0),
      subtext: 'Acumulado del mes actual',
      icon: '📈',
      bgColor: '#fefce8',
      borderColor: '#fef08a',
      textColor: '#854d0e',
      isCurrency: true
    },
    {
      title: 'Ticket promedio',
      value: formatCurrency(kpis.ticketPromedio ?? 0),
      subtext: 'Promedio de valor por venta',
      icon: '🎯',
      bgColor: '#faf5ff',
      borderColor: '#e9d5ff',
      textColor: '#6b21a8',
      isCurrency: true
    },
    {
      title: 'Stock crítico',
      value: kpis.productosCriticos ?? 0,
      subtext: 'Productos en o bajo stock mínimo',
      icon: '⚠️',
      bgColor: kpis.productosCriticos > 0 ? '#fef2f2' : '#f8fafc',
      borderColor: kpis.productosCriticos > 0 ? '#fecaca' : '#e2e8f0',
      textColor: kpis.productosCriticos > 0 ? '#991b1b' : '#334155',
      isCurrency: false
    }
  ];

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto 32px' }}>
      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${card.borderColor}`,
              borderTop: `4px solid ${card.textColor}`,
              borderRadius: '10px',
              padding: '18px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>{card.title}</span>
              <span style={{ fontSize: '20px', padding: '4px', background: card.bgColor, borderRadius: '6px' }}>{card.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.3' }}>
                {card.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tarjetas por almacén (solo admin si hay stock crítico por almacén) */}
      {usuario?.rol === 'admin' && stockPorAlmacen && stockPorAlmacen.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: 12 }}>
            📦 Alertas de Stock Crítico por Almacén:
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stockPorAlmacen.map(a => (
              <div 
                key={a.almacenId} 
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: '1 1 200px'
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>{a.cantidad}</div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>{a.almacenNombre}</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c' }}>Productos bajo mínimo</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardKPIs;

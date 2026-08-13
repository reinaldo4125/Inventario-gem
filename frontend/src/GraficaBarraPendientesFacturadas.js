import React from 'react';
import { Bar } from 'react-chartjs-2';

function GraficaBarraPendientesFacturadas({ labels, pendientes, facturadas }) {
  const labelsArr = Array.isArray(labels) ? labels : [];
  const pendArr = Array.isArray(pendientes) ? pendientes.map(v => Number(v) || 0) : [];
  const factArr = Array.isArray(facturadas) ? facturadas.map(v => Number(v) || 0) : [];
  const keyStr = `pendfact-${labelsArr.join('|')}-${pendArr.join('|')}-${factArr.join('|')}`;

  if (!Bar || (typeof Bar !== 'function' && typeof Bar !== 'object')) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: '100%' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventas Pendientes vs Facturadas por Día</div>
        <div style={{ fontSize: 12, color: '#e53e3e' }}>No se pudo cargar la gráfica de barras.</div>
      </div>
    );
  }

  const data = {
    labels: labelsArr,
    datasets: [
      {
        label: 'Pendientes',
        data: pendArr,
        backgroundColor: '#ef4444',
        borderRadius: 6,
        maxBarThickness: 24
      },
      {
        label: 'Facturadas',
        data: factArr,
        backgroundColor: '#10b981',
        borderRadius: 6,
        maxBarThickness: 24
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 12, weight: '500' }, usePointStyle: true, boxWidth: 8 }
      },
      title: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          maxTicksLimit: 6,
          font: { size: 11 },
          color: '#64748b',
          precision: 0
        }
      }
    }
  };

  return (
    <div style={{ background: '#fff', width: '100%' }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 8 }}>
        Ventas Pendientes vs Facturadas <span style={{ fontSize: 13, cursor: 'help', color: '#94a3b8' }} title="Comparación de ventas pendientes y facturadas por día">🛈</span>
      </div>
      <div style={{ height: 210, width: '100%', position: 'relative' }}>
        <Bar key={keyStr} data={data} options={options} />
      </div>
    </div>
  );
}

export default GraficaBarraPendientesFacturadas;


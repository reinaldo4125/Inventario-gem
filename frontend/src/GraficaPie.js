import React from 'react';
import { Pie } from 'react-chartjs-2';
import ChartErrorBoundary from './components/ChartErrorBoundary';

const GraficaPie = ({ titulo, descripcion, total, labels, data, colores }) => {
  const labelsArr = Array.isArray(labels) ? labels.map(l => (l === null || typeof l === 'undefined' ? '' : String(l))) : [];
  const dataArr = Array.isArray(data) ? data.map(v => Number(v) || 0) : [];
  const bg = colores || ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const keyStr = `pie-${titulo || ''}-${labelsArr.join('|')}-${dataArr.join('|')}`;

  if (!Pie || (typeof Pie !== 'function' && typeof Pie !== 'object')) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: '#e53e3e' }}>No se pudo cargar la gráfica de pastel.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', width: '100%' }}>
      {titulo && (
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
          {titulo} {descripcion && <span style={{ fontSize: 13, cursor: 'help', color: '#94a3b8' }} title={descripcion}>🛈</span>}
        </div>
      )}
      {total !== undefined && <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>{total}</div>}
      {descripcion && !titulo && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{descripcion}</div>}

      <div style={{ height: 210, width: '100%', position: 'relative' }}>
        <ChartErrorBoundary chartProps={{ keyStr, titulo, labelsArr, dataArr, bg }}>
          <Pie
            key={keyStr}
            data={{
              labels: labelsArr,
              datasets: [
                {
                  label: titulo,
                  data: dataArr,
                  backgroundColor: bg,
                  borderWidth: 2,
                  borderColor: '#ffffff'
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { font: { size: 11, weight: '500' }, usePointStyle: true, boxWidth: 8 }
                },
                tooltip: { enabled: true }
              }
            }}
          />
        </ChartErrorBoundary>
      </div>
    </div>
  );
};

export default GraficaPie;


import React from 'react';
import { Bar } from 'react-chartjs-2';
import ChartErrorBoundary from './components/ChartErrorBoundary';
import { formatCurrency } from './utils/formatters';

const GraficaBarra = ({ titulo, descripcion, total, labels, data, color = '#2563eb', horizontal = false }) => {
  const labelsArr = Array.isArray(labels) ? labels : [];
  const dataArr = Array.isArray(data) ? data : [];
  const keyStr = `${titulo || ''}-${labelsArr.join('|')}-${dataArr.join('|')}-${color}`;

  if (!Bar || (typeof Bar !== 'function' && typeof Bar !== 'object')) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: '#e53e3e' }}>No se pudo cargar la gráfica de barras.</div>
      </div>
    );
  }

  // Detectar si los valores parecen ser monetarios
  const isCurrency = Boolean(
    (titulo && (titulo.toLowerCase().includes('ingreso') || titulo.toLowerCase().includes('cliente') || titulo.toLowerCase().includes('monto'))) ||
    (typeof total === 'string' && total.includes('$'))
  );

  const formatShortValue = (val) => {
    if (!isCurrency) return val;
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  const chartData = {
    labels: labelsArr,
    datasets: [
      {
        label: titulo || 'Total',
        data: dataArr,
        backgroundColor: color,
        borderRadius: 6,
        maxBarThickness: horizontal ? 20 : 32,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    layout: {
      padding: { left: 8, right: 12, top: 4, bottom: 4 }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            const idx = tooltipItems[0]?.dataIndex;
            return labelsArr[idx] || '';
          },
          label: (context) => {
            const val = context.parsed[horizontal ? 'x' : 'y'];
            return isCurrency ? ` Total: ${formatCurrency(val)}` : ` Total: ${val}`;
          }
        }
      },
      title: { display: false }
    },
    scales: horizontal ? {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          precision: 0,
          callback: (value) => formatShortValue(value)
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 11, weight: '500' },
          color: '#334155',
          callback: function(valIndex) {
            const label = this.getLabelForValue(valIndex);
            if (typeof label === 'string' && label.length > 22) {
              return label.substring(0, 20) + '…';
            }
            return label;
          }
        }
      }
    } : {
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
          callback: (value) => formatShortValue(value)
        }
      }
    }
  };

  const containerHeight = horizontal ? Math.max(180, labelsArr.length * 35 + 40) : 210;

  return (
    <div style={{ background: '#fff', width: '100%' }}>
      {titulo && (
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
          {titulo} {descripcion && <span style={{ fontSize: 13, cursor: 'help', color: '#94a3b8' }} title={descripcion}>🛈</span>}
        </div>
      )}
      {total !== undefined && <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>{total}</div>}
      {descripcion && !titulo && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{descripcion}</div>}

      <div style={{ height: containerHeight, width: '100%', position: 'relative' }}>
        <ChartErrorBoundary chartProps={{ keyStr, titulo, labelsArr, dataArr, color }}>
          <Bar key={keyStr} data={chartData} options={chartOptions} />
        </ChartErrorBoundary>
      </div>
    </div>
  );
};

export default GraficaBarra;


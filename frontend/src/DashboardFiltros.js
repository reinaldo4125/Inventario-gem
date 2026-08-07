import React from 'react';

const DashboardFiltros = ({ filtros, setFiltros, vendedores, clientesList }) => {
  const setPresetDate = (type) => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (type === 'hoy') {
      const dateStr = formatDate(today);
      setFiltros(f => ({ ...f, desde: dateStr, hasta: dateStr }));
    } else if (type === 'semana') {
      const first = new Date(today);
      const day = today.getDay() || 7; // Get Monday
      first.setDate(today.getDate() - day + 1);
      setFiltros(f => ({ ...f, desde: formatDate(first), hasta: formatDate(today) }));
    } else if (type === 'mes') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setFiltros(f => ({ ...f, desde: formatDate(first), hasta: formatDate(today) }));
    } else if (type === 'ano') {
      const first = new Date(today.getFullYear(), 0, 1);
      setFiltros(f => ({ ...f, desde: formatDate(first), hasta: formatDate(today) }));
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      padding: '20px 24px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      maxWidth: 1150,
      margin: '0 auto 24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: '600', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔍</span> Filtros Avanzados de Dashboard
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setPresetDate('hoy')}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#334155' }}
          >
            Hoy
          </button>
          <button 
            type="button" 
            onClick={() => setPresetDate('semana')}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#334155' }}
          >
            Esta Semana
          </button>
          <button 
            type="button" 
            onClick={() => setPresetDate('mes')}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#334155' }}
          >
            Este Mes
          </button>
          <button 
            type="button" 
            onClick={() => setPresetDate('ano')}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#334155' }}
          >
            Año Actual
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
          <label style={{ fontWeight: '600', fontSize: '12px', color: '#475569' }}>Desde</label>
          <input 
            type="date" 
            value={filtros.desde} 
            onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} 
            style={{ borderRadius: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
          <label style={{ fontWeight: '600', fontSize: '12px', color: '#475569' }}>Hasta</label>
          <input 
            type="date" 
            value={filtros.hasta} 
            onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} 
            style={{ borderRadius: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
          <label style={{ fontWeight: '600', fontSize: '12px', color: '#475569' }}>Vendedor</label>
          <select 
            value={filtros.vendedor} 
            onChange={e => setFiltros(f => ({ ...f, vendedor: e.target.value }))} 
            style={{ borderRadius: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.map(v => (<option key={v.id} value={v.nombre}>{v.nombre}</option>))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
          <label style={{ fontWeight: '600', fontSize: '12px', color: '#475569' }}>Cliente</label>
          <select 
            value={filtros.cliente} 
            onChange={e => setFiltros(f => ({ ...f, cliente: e.target.value }))} 
            style={{ borderRadius: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">Todos los clientes</option>
            {clientesList.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
          </select>
        </div>

        <div>
          <button 
            type="button"
            onClick={() => setFiltros({ desde: '', hasta: '', vendedor: '', cliente: '' })}
            style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', height: '36px' }}
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardFiltros;

import React, { useState, useEffect } from 'react';
import api from './api';
import { 
  MdPerson, 
  MdBusiness, 
  MdBadge, 
  MdPhone, 
  MdMail, 
  MdLocationOn, 
  MdSearch, 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdRefresh, 
  MdCancel, 
  MdSave, 
  MdStorefront, 
  MdCheckCircle, 
  MdBlock, 
  MdPeople, 
  MdAttachMoney, 
  MdLoyalty, 
  MdNotes,
  MdFilterList,
  MdWork
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';

const initialForm = {
  nombre: '',
  empresa: '',
  tipo_documento: 'NIT',
  documento: '',
  tipo_cliente: 'Detal',
  telefono: '',
  correo: '',
  direccion: '',
  ciudad: '',
  departamento: '',
  pais: 'Colombia',
  descuentoEspecial: '',
  cupoCredito: '',
  almacenId: '',
  activo: true,
  notas: ''
};

function FieldError({ children }) {
  return (
    <div style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
      {children}
    </div>
  );
}

function Clientes({ usuario }) {
  const [clientes, setClientes] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clientes');
      setClientes(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlmacenes = async () => {
    try {
      const res = await api.get('/almacenes');
      setAlmacenes(res.data || []);
    } catch (err) {
      console.error('Error al obtener almacenes:', err);
    }
  };

  useEffect(() => {
    fetchClientes();
    fetchAlmacenes();
  }, []);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.nombre.trim()) errors.nombre = 'El nombre o razón social es obligatorio';
    if (!form.documento.trim()) errors.documento = 'El número de documento es obligatorio';
    if (!form.tipo_cliente) errors.tipo_cliente = 'Seleccione una categoría de cliente';
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      errors.correo = 'Ingrese un correo electrónico válido';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        almacenId: form.almacenId ? parseInt(form.almacenId, 10) : null,
        descuentoEspecial: form.descuentoEspecial ? parseFloat(form.descuentoEspecial) : 0,
        cupoCredito: form.cupoCredito ? parseFloat(form.cupoCredito) : 0
      };

      if (editId) {
        await api.put(`/clientes/${editId}`, payload);
        setSuccess('Cliente actualizado exitosamente');
      } else {
        await api.post('/clientes', payload);
        setSuccess('Cliente registrado exitosamente');
      }

      setForm(initialForm);
      setEditId(null);
      fetchClientes();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = c => {
    setForm({
      nombre: c.nombre || '',
      empresa: c.empresa || '',
      tipo_documento: c.tipo_documento || 'NIT',
      documento: c.documento || '',
      tipo_cliente: c.tipo_cliente || 'Detal',
      telefono: c.telefono || '',
      correo: c.correo || c.email || '',
      direccion: c.direccion || '',
      ciudad: c.ciudad || '',
      departamento: c.departamento || '',
      pais: c.pais || 'Colombia',
      descuentoEspecial: c.descuentoEspecial !== undefined && c.descuentoEspecial !== null ? String(c.descuentoEspecial) : '',
      cupoCredito: c.cupoCredito !== undefined && c.cupoCredito !== null ? String(c.cupoCredito) : '',
      almacenId: c.almacenId ? String(c.almacenId) : '',
      activo: typeof c.activo !== 'undefined' ? c.activo : true,
      notas: c.notas || c.observaciones || ''
    });
    setEditId(c.id);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleEstado = async (id, estadoActual) => {
    try {
      await api.patch(`/clientes/${id}/toggle-estado`);
      setSuccess(`Estado del cliente #${id} actualizado`);
      fetchClientes();
    } catch (err) {
      setError('Error al cambiar estado del cliente');
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Está seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      await api.delete(`/clientes/${id}`);
      setSuccess('Cliente eliminado exitosamente');
      fetchClientes();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar cliente');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de clientes
  const clientesFiltrados = clientes.filter(c => {
    const s = search.toLowerCase();
    const textMatch = 
      (c.nombre && c.nombre.toLowerCase().includes(s)) ||
      (c.empresa && c.empresa.toLowerCase().includes(s)) ||
      (c.documento && c.documento.toLowerCase().includes(s)) ||
      (c.correo && c.correo.toLowerCase().includes(s)) ||
      (c.telefono && c.telefono.toLowerCase().includes(s)) ||
      (c.ciudad && c.ciudad.toLowerCase().includes(s));

    const tipoMatch = !filtroTipo || c.tipo_cliente === filtroTipo;
    const estadoMatch = !filtroEstado || 
      (filtroEstado === 'activo' && c.activo !== false) || 
      (filtroEstado === 'inactivo' && c.activo === false);
    const almacenMatch = !filtroAlmacen || String(c.almacenId) === filtroAlmacen;

    return textMatch && tipoMatch && estadoMatch && almacenMatch;
  });

  // Exportar Excel
  const exportExcel = () => {
    const data = clientesFiltrados.map(c => ({
      ID: c.id,
      Documento: `${c.tipo_documento || ''} ${c.documento || ''}`.trim(),
      Nombre: c.nombre,
      Empresa: c.empresa || 'N/A',
      Categoría: c.tipo_cliente || 'Detal',
      Teléfono: c.telefono || 'N/A',
      Correo: c.correo || c.email || 'N/A',
      Dirección: c.direccion || 'N/A',
      Ciudad: c.ciudad || 'N/A',
      'Descuento %': c.descuentoEspecial ? `${c.descuentoEspecial}%` : '0%',
      'Cupo Crédito': c.cupoCredito ? `$${Number(c.cupoCredito).toLocaleString('es-CO')}` : '$0',
      Almacén: c.almacen ? c.almacen.nombre : 'General',
      Estado: c.activo !== false ? 'Activo' : 'Inactivo'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const fileData = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(fileData, `Reporte_Clientes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Exportar PDF
  const exportPdf = () => {
    const doc = createDoc();
    doc.setFontSize(16);
    doc.text('Directorio Oficial de Clientes', 14, 16);
    tableToPdf(doc, {
      startY: 22,
      head: [['Doc / NIT', 'Nombre / Empresa', 'Categoría', 'Contacto', 'Ciudad', 'Crédito', 'Estado']],
      body: clientesFiltrados.map(c => [
        `${c.tipo_documento || ''} ${c.documento || '-'}`,
        `${c.nombre}${c.empresa ? ' (' + c.empresa + ')' : ''}`,
        c.tipo_cliente || 'Detal',
        c.telefono || c.correo || '-',
        c.ciudad || '-',
        c.cupoCredito ? `$${Number(c.cupoCredito).toLocaleString('es-CO')}` : '$0',
        c.activo !== false ? 'Activo' : 'Inactivo'
      ])
    });
    savePdf(doc, `Reporte_Clientes_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // Paginación
  const totalPages = Math.ceil(clientesFiltrados.length / pageSize) || 1;
  const paginados = clientesFiltrados.slice((page - 1) * pageSize, page * pageSize);

  // KPIs
  const totalClientes = clientes.length;
  const clientesActivos = clientes.filter(c => c.activo !== false).length;
  const clientesMayoristas = clientes.filter(c => c.tipo_cliente === 'Mayor' || c.tipo_cliente === 'Distribuidor' || c.tipo_cliente === 'Almacén').length;
  const cupoTotalCredito = clientes.reduce((acc, c) => acc + (parseFloat(c.cupoCredito) || 0), 0);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      
      {/* Encabezado */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <MdPeople size={28} color="#2b6cb0" /> Gestión Integral de Clientes
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Expedientes de clientes, créditos otorgados, datos de facturación y categorías comerciales
          </p>
        </div>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div className="card" style={{ padding: '16px', borderRadius: '10px', background: '#fff', borderLeft: '4px solid #3182ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>Total Clientes</span>
            <MdPeople size={24} color="#3182ce" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2d3748', marginTop: '6px' }}>{totalClientes}</div>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '2px' }}>Registrados en la base de datos</div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px', background: '#fff', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>Clientes Activos</span>
            <MdCheckCircle size={24} color="#38a169" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2d3748', marginTop: '6px' }}>{clientesActivos}</div>
          <div style={{ fontSize: '12px', color: '#38a169', marginTop: '2px' }}>
            {totalClientes > 0 ? `${Math.round((clientesActivos / totalClientes) * 100)}% del total` : '0%'}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px', background: '#fff', borderLeft: '4px solid #dd6b20', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>Mayoristas / Cuentas</span>
            <MdBusiness size={24} color="#dd6b20" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2d3748', marginTop: '6px' }}>{clientesMayoristas}</div>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '2px' }}>Cuentas empresariales especiales</div>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '10px', background: '#fff', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#718096', textTransform: 'uppercase' }}>Cupo Crédito Total</span>
            <MdAttachMoney size={24} color="#805ad5" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#2d3748', marginTop: '6px' }}>
            ${cupoTotalCredito.toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '2px' }}>Límite de crédito otorgado suma</div>
        </div>
      </div>

      {/* Alertas */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* Formulario de Cliente Completo */}
      <form 
        className="card" 
        onSubmit={handleSubmit} 
        style={{ 
          marginBottom: '28px', 
          padding: '24px', 
          borderRadius: '12px', 
          background: '#fff', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          borderBottom: '1px solid #edf2f7',
          paddingBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 700, color: '#2d3748' }}>
            <div style={{ 
              background: editId ? '#feebc8' : '#ebf8ff', 
              color: editId ? '#c05621' : '#2b6cb0', 
              padding: '8px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <MdPerson size={22} />
            </div>
            <div>
              <span>{editId ? 'Modificar Expediente de Cliente' : 'Registrar Nuevo Cliente'}</span>
              <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#718096', marginTop: '2px' }}>
                {editId ? 'Actualice la información comercial, fiscal y de ubicación del cliente' : 'Complete el expediente con datos fiscales, comercialización, crédito y ubicación'}
              </div>
            </div>
          </div>

          {editId && (
            <span style={{ background: '#feebc8', color: '#c05621', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
              Editando ID #{editId}
            </span>
          )}
        </div>

        {/* SECCIÓN 1: IDENTIFICACIÓN Y DATOS COMERCIALES */}
        <div style={{ marginBottom: '20px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdBadge size={18} /> 1. Identificación y Razón Social
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="nombre" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Nombre / Razón Social <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input 
                id="nombre" 
                name="nombre" 
                placeholder="Ej. Distribuidora Diésel S.A.S." 
                value={form.nombre} 
                onChange={handleChange} 
                className="input" 
                required 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.nombre && <FieldError>{formErrors.nombre}</FieldError>}
            </div>

            <div>
              <label htmlFor="empresa" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Nombre Comercial / Marca (Opcional)
              </label>
              <input 
                id="empresa" 
                name="empresa" 
                placeholder="Ej. Talleres Diésel Express" 
                value={form.empresa} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="tipo_documento" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Tipo de Documento
              </label>
              <select 
                id="tipo_documento" 
                name="tipo_documento" 
                value={form.tipo_documento} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff' }}
              >
                <option value="NIT">NIT (Empresas)</option>
                <option value="CC">Cédula de Ciudadanía (CC)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="Otro">Otro Documento</option>
              </select>
            </div>

            <div>
              <label htmlFor="documento" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Número de Documento / NIT <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input 
                id="documento" 
                name="documento" 
                placeholder="Ej. 900123456-1" 
                value={form.documento} 
                onChange={handleChange} 
                className="input" 
                required 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.documento && <FieldError>{formErrors.documento}</FieldError>}
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: CONTACTO Y UBICACIÓN */}
        <div style={{ marginBottom: '20px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdLocationOn size={18} /> 2. Ubicación y Medios de Contacto
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="telefono" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Teléfono / Celular
              </label>
              <input 
                id="telefono" 
                name="telefono" 
                placeholder="Ej. +57 312 4567890" 
                value={form.telefono} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="correo" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Correo Electrónico (Facturación / Avisos)
              </label>
              <input 
                id="correo" 
                name="correo" 
                placeholder="facturacion@empresa.com" 
                value={form.correo} 
                onChange={handleChange} 
                className="input" 
                type="email" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.correo && <FieldError>{formErrors.correo}</FieldError>}
            </div>

            <div>
              <label htmlFor="ciudad" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Ciudad / Municipio
              </label>
              <input 
                id="ciudad" 
                name="ciudad" 
                placeholder="Ej. Bogotá / Medellín / Cali" 
                value={form.ciudad} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="departamento" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Departamento / Estado
              </label>
              <input 
                id="departamento" 
                name="departamento" 
                placeholder="Ej. Cundinamarca / Antioquia" 
                value={form.departamento} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="direccion" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Dirección Física de Despacho / Facturación
              </label>
              <input 
                id="direccion" 
                name="direccion" 
                placeholder="Ej. Carrera 70 # 12-34, Zona Industrial" 
                value={form.direccion} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: CLASIFICACIÓN COMERCIAL, CRÉDITO Y ALMACÉN */}
        <div style={{ marginBottom: '20px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdWork size={18} /> 3. Categoría Comercial, Descuentos y Almacén
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="tipo_cliente" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Categoría de Cliente <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <select 
                id="tipo_cliente" 
                name="tipo_cliente" 
                value={form.tipo_cliente} 
                onChange={handleChange} 
                className="input" 
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff' }}
              >
                <option value="Detal">Detal (Cliente Final)</option>
                <option value="Mayor">Mayorista (Compras al Por Mayor)</option>
                <option value="Almacén">Almacén Partner / Aliado</option>
                <option value="Distribuidor">Distribuidor Autorizado</option>
              </select>
              {formErrors.tipo_cliente && <FieldError>{formErrors.tipo_cliente}</FieldError>}
            </div>

            <div>
              <label htmlFor="descuentoEspecial" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Descuento Especial (%)
              </label>
              <input 
                id="descuentoEspecial" 
                name="descuentoEspecial" 
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Ej. 5.0" 
                value={form.descuentoEspecial} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="cupoCredito" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Cupo de Crédito Otorgado ($ COP)
              </label>
              <input 
                id="cupoCredito" 
                name="cupoCredito" 
                type="number"
                step="1000"
                min="0"
                placeholder="Ej. 5000000" 
                value={form.cupoCredito} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="almacenId" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Almacén Asignado de Atención
              </label>
              <select 
                id="almacenId" 
                name="almacenId" 
                value={form.almacenId} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff' }}
              >
                <option value="">General / Todos los almacenes</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: ESTADO Y NOTAS */}
        <div style={{ marginBottom: '20px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdNotes size={18} /> 4. Estado Comercial y Observaciones Internas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div>
              <label htmlFor="notas" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Observaciones / Referencias Comerciales
              </label>
              <textarea 
                id="notas" 
                name="notas" 
                rows="2"
                placeholder="Indique condiciones especiales de entrega, contacto secundario de cartera, preferencias de pago..." 
                value={form.notas} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#2d3748' }}>
              <input 
                type="checkbox" 
                name="activo" 
                checked={form.activo} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: '#38a169', cursor: 'pointer' }}
              />
              Cliente Activo (Apto para ventas y cotizaciones)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {editId ? (
              <button 
                type="button" 
                onClick={() => { 
                  setForm(initialForm); 
                  setEditId(null); 
                  setError(''); 
                  setSuccess(''); 
                }} 
                className="btn" 
                style={{ 
                  padding: '10px 18px', 
                  borderRadius: '6px', 
                  background: '#edf2f7', 
                  color: '#4a5568', 
                  border: '1px solid #cbd5e0',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdCancel size={18} /> Cancelar Edición
              </button>
            ) : (
              <button 
                type="button" 
                onClick={() => setForm(initialForm)} 
                className="btn" 
                style={{ 
                  padding: '10px 18px', 
                  borderRadius: '6px', 
                  background: '#edf2f7', 
                  color: '#4a5568', 
                  border: '1px solid #cbd5e0',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdRefresh size={18} /> Limpiar Campos
              </button>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ 
                padding: '10px 24px', 
                borderRadius: '6px', 
                background: '#3182ce', 
                color: '#fff', 
                border: 'none', 
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(49, 130, 206, 0.3)'
              }}
            >
              <MdSave size={18} />
              {editId ? 'Guardar Cambios de Cliente' : 'Registrar Cliente'}
            </button>
          </div>
        </div>
      </form>

      {/* Controles de búsqueda, filtros y exportación */}
      <div 
        className="card" 
        style={{ 
          marginBottom: '20px', 
          padding: '18px', 
          borderRadius: '10px', 
          background: '#fff', 
          border: '1px solid #e2e8f0' 
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid #edf2f7',
          marginBottom: '14px'
        }}>
          <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdFilterList size={20} color="#3182ce" /> Filtros y Búsqueda de Clientes ({clientesFiltrados.length})
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={exportExcel} 
              style={{ 
                background: '#276749', 
                color: '#fff', 
                border: 'none', 
                padding: '8px 14px', 
                borderRadius: '6px', 
                fontWeight: 600, 
                fontSize: '13px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <FaFileExcel size={15} /> Excel
            </button>
            <button 
              onClick={exportPdf} 
              style={{ 
                background: '#c53030', 
                color: '#fff', 
                border: 'none', 
                padding: '8px 14px', 
                borderRadius: '6px', 
                fontWeight: 600, 
                fontSize: '13px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <FaFilePdf size={15} /> PDF
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '12px' 
        }}>
          <div style={{ position: 'relative' }}>
            <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '11px', color: '#a0aec0' }} />
            <input 
              placeholder="Buscar por nombre, NIT, email, ciudad..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
              className="input" 
              style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '13px' }}
            />
          </div>

          <div>
            <select 
              value={filtroTipo} 
              onChange={e => { setFiltroTipo(e.target.value); setPage(1); }} 
              className="input" 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '13px' }}
            >
              <option value="">Todas las Categorías</option>
              <option value="Detal">Detal (Cliente Final)</option>
              <option value="Mayor">Mayorista</option>
              <option value="Almacén">Almacén Partner</option>
              <option value="Distribuidor">Distribuidor</option>
            </select>
          </div>

          <div>
            <select 
              value={filtroEstado} 
              onChange={e => { setFiltroEstado(e.target.value); setPage(1); }} 
              className="input" 
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '13px' }}
            >
              <option value="">Todos los Estados</option>
              <option value="activo">Solo Activos</option>
              <option value="inactivo">Solo Inactivos</option>
            </select>
          </div>

          {usuario && usuario.rol === 'admin' && (
            <div>
              <select 
                value={filtroAlmacen} 
                onChange={e => { setFiltroAlmacen(e.target.value); setPage(1); }} 
                className="input" 
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', fontSize: '13px' }}
              >
                <option value="">Todos los Almacenes</option>
                {almacenes.map(a => (
                  <option key={a.id} value={String(a.id)}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table className="usuarios-table card" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#edf2f7', color: '#2d3748', fontSize: '13px' }}>
              <th style={{ padding: '12px' }}>Doc / ID</th>
              <th style={{ padding: '12px' }}>Cliente / Empresa</th>
              <th style={{ padding: '12px' }}>Categoría</th>
              <th style={{ padding: '12px' }}>Contacto</th>
              <th style={{ padding: '12px' }}>Ubicación</th>
              <th style={{ padding: '12px' }}>Crédito & Desc</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                  Cargando directorio de clientes...
                </td>
              </tr>
            ) : paginados.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                  No se encontraron clientes registrados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              paginados.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2d3748' }}>
                      {c.tipo_documento || 'NIT'} {c.documento || '-'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a0aec0' }}>ID #{c.id}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2d3748' }}>{c.nombre}</div>
                    {c.empresa && (
                      <div style={{ fontSize: '12px', color: '#4a5568', fontStyle: 'italic' }}>
                        {c.empresa}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      background: c.tipo_cliente === 'Mayor' ? '#feebc8' : c.tipo_cliente === 'Distribuidor' ? '#e9d8fd' : c.tipo_cliente === 'Almacén' ? '#e6fffa' : '#edf2f7',
                      color: c.tipo_cliente === 'Mayor' ? '#c05621' : c.tipo_cliente === 'Distribuidor' ? '#6b46c1' : c.tipo_cliente === 'Almacén' ? '#234e52' : '#4a5568'
                    }}>
                      {c.tipo_cliente || 'Detal'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {c.telefono && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a5568' }}>
                        <MdPhone size={13} color="#718096" /> {c.telefono}
                      </div>
                    )}
                    {(c.correo || c.email) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#718096', fontSize: '12px', marginTop: '2px' }}>
                        <MdMail size={13} color="#a0aec0" /> {c.correo || c.email}
                      </div>
                    )}
                    {!c.telefono && !c.correo && !c.email && (
                      <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Sin contacto</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {c.ciudad ? (
                      <div style={{ fontWeight: 600, color: '#2d3748' }}>{c.ciudad}</div>
                    ) : (
                      <span style={{ color: '#a0aec0' }}>-</span>
                    )}
                    {c.direccion && (
                      <div style={{ fontSize: '11px', color: '#718096' }}>{c.direccion}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#2b6cb0' }}>
                      {c.cupoCredito ? `$${Number(c.cupoCredito).toLocaleString('es-CO')}` : '$0'}
                    </div>
                    {c.descuentoEspecial ? (
                      <div style={{ fontSize: '11px', color: '#38a169', fontWeight: 600 }}>
                        Desc: {c.descuentoEspecial}%
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleEstado(c.id, c.activo)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="Haz clic para cambiar estado"
                    >
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        background: c.activo !== false ? '#c6f6d5' : '#fed7d7',
                        color: c.activo !== false ? '#22543d' : '#9b2c2c'
                      }}>
                        {c.activo !== false ? <MdCheckCircle size={12} /> : <MdBlock size={12} />}
                        {c.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <button 
                        onClick={() => handleEdit(c)} 
                        title="Editar expediente de cliente" 
                        style={{ 
                          background: '#ebf8ff', 
                          color: '#2b6cb0', 
                          border: 'none', 
                          padding: '6px 10px', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      >
                        <MdEdit size={14} /> Editar
                      </button>

                      {usuario && usuario.rol === 'admin' && (
                        <button 
                          onClick={() => handleDelete(c.id)} 
                          title="Eliminar cliente" 
                          style={{ 
                            background: '#fff5f5', 
                            color: '#e53e3e', 
                            border: 'none', 
                            padding: '6px 10px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}
                        >
                          <MdDelete size={14} /> Borrar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ 
        display: 'flex', 
        justify: 'space-between', 
        alignItems: 'center', 
        marginTop: '16px', 
        flexWrap: 'wrap', 
        gap: '12px',
        background: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '13px', color: '#718096' }}>
          Mostrando {paginados.length > 0 ? (page - 1) * pageSize + 1 : 0} a {Math.min(page * pageSize, clientesFiltrados.length)} de {clientesFiltrados.length} clientes
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4a5568' }}>
            <span>Mostrar:</span>
            <select 
              value={pageSize} 
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} 
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#fff' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              disabled={page === 1} 
              onClick={() => setPage(prev => Math.max(prev - 1, 1))} 
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: '1px solid #cbd5e0', 
                background: page === 1 ? '#edf2f7' : '#fff', 
                color: page === 1 ? '#a0aec0' : '#2d3748', 
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              Anterior
            </button>

            <span style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: '#2d3748' }}>
              Página {page} de {totalPages}
            </span>

            <button 
              disabled={page === totalPages || totalPages === 0} 
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} 
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: '1px solid #cbd5e0', 
                background: (page === totalPages || totalPages === 0) ? '#edf2f7' : '#fff', 
                color: (page === totalPages || totalPages === 0) ? '#a0aec0' : '#2d3748', 
                cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Clientes;

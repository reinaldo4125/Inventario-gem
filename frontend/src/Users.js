import React, { useEffect, useState, useCallback } from 'react';
import FieldError from './components/FieldError';
import { 
  MdEdit, 
  MdDelete, 
  MdSave, 
  MdCancel, 
  MdPersonAdd, 
  MdArrowBack, 
  MdArrowForward,
  MdCheckCircle,
  MdBlock,
  MdSearch,
  MdFilterList,
  MdPeople,
  MdAdminPanelSettings,
  MdStorefront,
  MdPhone,
  MdAccessTime,
  MdBadge,
  MdWork,
  MdLocationOn,
  MdAttachMoney,
  MdNotes,
  MdLock,
  MdPerson,
  MdMail,
  MdRefresh
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa';
import './users.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';

const initialForm = {
  nombre: '',
  documento: '',
  correo: '',
  telefono: '',
  direccion: '',
  rol: '',
  cargo: '',
  almacenId: '',
  comision: '',
  password: '',
  activo: true,
  notas: ''
};

function Users({ usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState(null);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Paginación
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Modal confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchUsuarios = useCallback(async () => {
    try {
      const tokenLocal = usuario?.token || localStorage.getItem('token') || '';
      const res = await fetch('/usuarios', {
        headers: {
          'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : ''
        }
      });
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data.error || 'Error desconocido');
      setUsuarios(data);
    } catch (err) {
      setError('Error al cargar usuarios: ' + err.message);
      setUsuarios([]);
    }
  }, [usuario?.token]);

  useEffect(() => {
    const usuarioActual = usuario || JSON.parse(localStorage.getItem('usuario') || '{}');
    const tokenLocal = usuario?.token || localStorage.getItem('token') || '';
    if (usuarioActual?.rol === 'admin') {
      fetchUsuarios();
      const fetchAlmacenes = async () => {
        try {
          const res = await fetch('/almacenes', {
            headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' }
          });
          const data = await res.json();
          setAlmacenes(Array.isArray(data) ? data : []);
        } catch (err) {
          setAlmacenes([]);
        }
      };
      fetchAlmacenes();
    } else {
      setError('Acceso denegado: solo administradores pueden ver esta sección.');
    }
  }, [fetchUsuarios, usuario?.token]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validate = () => {
    const errors = {};
    if (!form.nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    if (!form.correo.trim()) {
      errors.correo = 'El correo es obligatorio';
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.correo)) {
      errors.correo = 'Correo no válido';
    }
    if (!form.rol.trim()) errors.rol = 'El rol es obligatorio';
    if (!form.almacenId) errors.almacenId = 'El almacén es obligatorio';
    if (!editId) {
      if (!form.password || form.password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres';
      }
    } else {
      if (form.password && form.password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres';
      }
    }
    return errors;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);

    try {
      const tokenLocal = usuario?.token || localStorage.getItem('token') || '';
      if (editId) {
        const body = { 
          ...form, 
          almacenId: form.almacenId ? Number(form.almacenId) : null,
          activo: Boolean(form.activo)
        };
        if (!form.password) delete body.password;
        
        const res = await fetch(`/usuarios/${editId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' 
          },
          body: JSON.stringify(body)
        });
        
        if (!res.ok) {
          const errBody = await res.json().catch(()=>({ error: 'Error al editar usuario' }));
          if (Array.isArray(errBody.errors)) {
            throw new Error(errBody.errors.map(e => e.msg || e.message).join('; '));
          }
          throw new Error(errBody.error || 'Error al editar usuario');
        }
        setSuccess('Usuario actualizado correctamente');
      } else {
        const body = { 
          ...form, 
          almacenId: form.almacenId ? Number(form.almacenId) : null,
          activo: Boolean(form.activo)
        };
        const res = await fetch('/usuarios', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' 
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errBody = await res.json().catch(()=>({ error: 'Error al crear usuario' }));
          if (Array.isArray(errBody.errors)) {
            throw new Error(errBody.errors.map(e => e.msg || e.message).join('; '));
          }
          throw new Error(errBody.error || 'Error al crear usuario');
        }
        setSuccess('Usuario registrado correctamente');
      }
      setForm(initialForm);
      setEditId(null);
      fetchUsuarios();
      setFormErrors({});
    } catch (err) {
      setError(err.message || 'Error desconocido');
    }
    setLoading(false);
  };

  const handleEdit = u => {
    setForm({
      nombre: u.nombre || '',
      documento: u.documento || '',
      correo: u.correo || '',
      telefono: u.telefono || '',
      direccion: u.direccion || '',
      rol: u.rol || '',
      cargo: u.cargo || '',
      almacenId: u.almacenId ? String(u.almacenId) : '',
      comision: u.comision !== undefined && u.comision !== null ? String(u.comision) : '',
      password: '',
      activo: typeof u.activo !== 'undefined' ? u.activo : true,
      notas: u.notas || ''
    });
    setEditId(u.id);
    setError('');
    setSuccess('');
  };

  const handleToggleEstado = async u => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const tokenLocal = usuario?.token || localStorage.getItem('token') || '';
      const res = await fetch(`/usuarios/${u.id}/toggle-estado`, {
        method: 'PATCH',
        headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');
      setSuccess(data.mensaje || 'Estado actualizado');
      fetchUsuarios();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDelete = id => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const tokenLocal = usuario?.token || localStorage.getItem('token') || '';
      const res = await fetch(`/usuarios/${deleteId}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' } 
      });
      if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        throw new Error(body.error || 'Error al eliminar usuario');
      }
      setSuccess('Usuario eliminado correctamente');
      fetchUsuarios();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
    setShowConfirm(false);
    setDeleteId(null);
  };

  // KPIs
  const totalUsuarios = usuarios.length;
  const activos = usuarios.filter(u => u.activo !== false).length;
  const inactivos = totalUsuarios - activos;
  const admins = usuarios.filter(u => u.rol === 'admin').length;
  const vendedores = usuarios.filter(u => u.rol === 'vendedor').length;

  // Filtrado de usuarios
  const usuariosFiltrados = usuarios.filter(u => {
    const s = search.toLowerCase();
    const textMatch = 
      u.nombre.toLowerCase().includes(s) ||
      u.correo.toLowerCase().includes(s) ||
      (u.documento && u.documento.toLowerCase().includes(s)) ||
      (u.cargo && u.cargo.toLowerCase().includes(s)) ||
      (u.telefono && u.telefono.toLowerCase().includes(s)) ||
      (u.direccion && u.direccion.toLowerCase().includes(s)) ||
      (u.almacenNombre && u.almacenNombre.toLowerCase().includes(s));

    const rolMatch = !filtroRol || u.rol === filtroRol;
    const estadoMatch = !filtroEstado || 
      (filtroEstado === 'activo' && u.activo !== false) ||
      (filtroEstado === 'inactivo' && u.activo === false);

    return textMatch && rolMatch && estadoMatch;
  });

  // Exportar a Excel
  const exportExcel = () => {
    const data = usuariosFiltrados.map(u => ({
      ID: u.id,
      Documento: u.documento || 'N/A',
      Nombre: u.nombre,
      Correo: u.correo,
      Teléfono: u.telefono || 'N/A',
      Dirección: u.direccion || 'N/A',
      Rol: u.rol,
      Cargo: u.cargo || 'N/A',
      Almacén: u.almacenNombre || 'Todos',
      'Comisión %': u.comision ? `${u.comision}%` : '0%',
      Estado: u.activo !== false ? 'Activo' : 'Inactivo',
      'Último Acceso': u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-CO') : 'Nunca'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'usuarios_sistema.xlsx');
  };

  // Exportar a PDF
  const exportPDF = () => {
    const doc = createDoc();
    doc.text('Listado de Usuarios del Sistema', 14, 16);
    tableToPdf(doc, {
      startY: 22,
      head: [['ID', 'Documento', 'Nombre', 'Correo', 'Teléfono', 'Rol / Cargo', 'Almacén', 'Estado']],
      body: usuariosFiltrados.map(u => [
        u.id, 
        u.documento || '-',
        u.nombre, 
        u.correo, 
        u.telefono || '-', 
        `${u.rol}${u.cargo ? ' (' + u.cargo + ')' : ''}`, 
        u.almacenNombre || 'General', 
        u.activo !== false ? 'Activo' : 'Inactivo'
      ])
    });
    savePdf(doc, 'usuarios_sistema.pdf');
  };

  // Paginación
  const totalPages = Math.ceil(usuariosFiltrados.length / rowsPerPage) || 1;
  const paginados = usuariosFiltrados.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleRowsPerPage = e => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  };

  const handlePageChange = newPage => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const formatDate = dateStr => {
    if (!dateStr) return 'Nunca';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="usuarios-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: 12, fontWeight: 600, color: '#2a4365', fontSize: 16 }}>
        {usuario.almacenNombre || (usuario.almacen && usuario.almacen.nombre) ? (
          <>Almacén Actual: <span style={{ color: '#3182ce' }}>{usuario.almacenNombre || usuario.almacen.nombre}</span></>
        ) : null}
      </div>

      <h2 className="section-title" style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a365d', marginBottom: '16px' }}>
        Gestión Integral de Usuarios
      </h2>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3182ce', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdPeople size={32} color="#3182ce" />
          <div>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Usuarios</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2d3748' }}>{totalUsuarios}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #38a169', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdCheckCircle size={32} color="#38a169" />
          <div>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Usuarios Activos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2d3748' }}>{activos}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #e53e3e', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdBlock size={32} color="#e53e3e" />
          <div>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Inactivos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2d3748' }}>{inactivos}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #805ad5', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdAdminPanelSettings size={32} color="#805ad5" />
          <div>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Administradores</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2d3748' }}>{admins}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #dd6b20', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MdStorefront size={32} color="#dd6b20" />
          <div>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Vendedores</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2d3748' }}>{vendedores}</div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ marginBottom: 12, textAlign: 'center', color: '#3182ce', fontWeight: 500 }}>
          <span className="loader" style={{ marginRight: 8 }}></span> Procesando solicitud...
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '12px' }}>{success}</div>}

      {/* Formulario de Usuario Completo */}
      <form 
        className="card" 
        onSubmit={handleSubmit} 
        noValidate 
        style={{ 
          padding: '24px', 
          marginBottom: '24px', 
          borderRadius: '12px',
          borderTop: '4px solid #3182ce',
          background: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 700, 
          color: '#1a365d', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid #edf2f7',
          paddingBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              background: '#ebf8ff', 
              color: '#3182ce', 
              padding: '8px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center' 
            }}>
              <MdPersonAdd size={22} />
            </div>
            <div>
              <span>{editId ? 'Modificar Perfil de Usuario' : 'Registrar Nuevo Usuario Completo'}</span>
              <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#718096', marginTop: '2px' }}>
                {editId ? 'Actualice los datos personales, laborales y credenciales del usuario' : 'Diligencie el expediente de usuario con todos sus datos personales, rol y asignación'}
              </div>
            </div>
          </div>
          {editId && (
            <span style={{ fontSize: '12px', background: '#feebc8', color: '#c05621', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Editando ID #{editId}
            </span>
          )}
        </div>

        {/* SECCIÓN 1: DATOS PERSONALES Y CONTACTO */}
        <div style={{ marginBottom: '24px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdBadge size={18} /> 1. Información Personal e Identificación
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="nombre" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Nombre Completo <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input 
                id="nombre" 
                name="nombre" 
                placeholder="Ej. Juan Carlos Pérez" 
                value={form.nombre} 
                onChange={handleChange} 
                className="input" 
                required 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.nombre && <FieldError>{formErrors.nombre}</FieldError>}
            </div>

            <div>
              <label htmlFor="documento" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Cédula / Documento de Identidad
              </label>
              <input 
                id="documento" 
                name="documento" 
                placeholder="Ej. 1098765432" 
                value={form.documento} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="correo" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Correo Electrónico <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input 
                id="correo" 
                name="correo" 
                placeholder="usuario@empresa.com" 
                value={form.correo} 
                onChange={handleChange} 
                className="input" 
                required 
                type="email" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.correo && <FieldError>{formErrors.correo}</FieldError>}
            </div>

            <div>
              <label htmlFor="telefono" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Teléfono / Celular
              </label>
              <input 
                id="telefono" 
                name="telefono" 
                placeholder="Ej. +57 300 1234567" 
                value={form.telefono} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="direccion" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Dirección de Residencia / Residencia
              </label>
              <input 
                id="direccion" 
                name="direccion" 
                placeholder="Ej. Calle 45 # 23-10, Barrio Centro" 
                value={form.direccion} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: ROL Y ASIGNACIÓN LABORAL */}
        <div style={{ marginBottom: '24px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdWork size={18} /> 2. Rol, Cargo y Asignación Operativa
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="rol" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Rol en Sistema <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <select 
                id="rol" 
                name="rol" 
                value={form.rol} 
                onChange={handleChange} 
                className="input" 
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff' }}
              >
                <option value="">Selecciona un rol</option>
                <option value="admin">Administrador (Control Total)</option>
                <option value="vendedor">Vendedor (Punto de Venta / Cotizaciones)</option>
                <option value="almacen">Encargado de Almacén (Inventario / Movimientos)</option>
              </select>
              {formErrors.rol && <FieldError>{formErrors.rol}</FieldError>}
            </div>

            <div>
              <label htmlFor="cargo" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Cargo / Puesto de Trabajo
              </label>
              <input 
                id="cargo" 
                name="cargo" 
                placeholder="Ej. Asesor Comercial Senior" 
                value={form.cargo} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>

            <div>
              <label htmlFor="almacenId" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Almacén Asignado <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <select 
                id="almacenId" 
                name="almacenId" 
                value={form.almacenId} 
                onChange={handleChange} 
                className="input" 
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff' }}
              >
                <option value="">Selecciona un almacén</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
              {formErrors.almacenId && <FieldError>{formErrors.almacenId}</FieldError>}
            </div>

            <div>
              <label htmlFor="comision" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Porcentaje de Comisión (%)
              </label>
              <input 
                id="comision" 
                name="comision" 
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Ej. 2.5" 
                value={form.comision} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: SEGURIDAD, ESTADO Y NOTAS */}
        <div style={{ marginBottom: '20px', background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2b6cb0', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdLock size={18} /> 3. Credenciales de Acceso, Estado y Observaciones
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '16px' 
          }}>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                {editId ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
              </label>
              <input 
                id="password" 
                name="password" 
                placeholder={editId ? 'Dejar en blanco para conservar actual' : 'Mínimo 6 caracteres'} 
                value={form.password} 
                onChange={handleChange} 
                className="input" 
                type="password" 
                autoComplete="new-password" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              />
              {formErrors.password && <FieldError>{formErrors.password}</FieldError>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="notas" style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
                Notas / Observaciones Internas
              </label>
              <textarea 
                id="notas" 
                name="notas" 
                rows="2"
                placeholder="Añada notas sobre el horario del usuario, observaciones de contratación o permisos especiales..." 
                value={form.notas} 
                onChange={handleChange} 
                className="input" 
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* Sección inferior de opciones y botones */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #edf2f7'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            background: form.activo ? '#f0fff4' : '#fff5f5',
            padding: '8px 14px',
            borderRadius: '8px',
            border: `1px solid ${form.activo ? '#c6f6d5' : '#fed7d7'}`
          }}>
            <input 
              type="checkbox" 
              id="activo" 
              name="activo" 
              checked={form.activo} 
              onChange={handleChange} 
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#38a169' }} 
            />
            <label htmlFor="activo" style={{ fontWeight: 600, fontSize: '13px', color: form.activo ? '#22543d' : '#9b2c2c', cursor: 'pointer' }}>
              {form.activo ? 'Usuario Activo (Permite el inicio de sesión)' : 'Usuario Inactivo (Acceso bloqueado)'}
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
                  setFormErrors({}); 
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
                <MdRefresh size={18} /> Limpiar Formulario
              </button>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '10px 24px', 
                borderRadius: '6px', 
                background: '#3182ce', 
                color: '#ffffff', 
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(49, 130, 206, 0.3)',
                transition: 'background 0.2s'
              }}
            >
              <MdSave size={18} />
              {editId ? 'Guardar Cambios de Perfil' : 'Registrar Usuario'}
            </button>
          </div>
        </div>
      </form>

      {/* Controles de Búsqueda, Filtros y Exportación */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              className="input"
              placeholder="Buscar por nombre, correo, teléfono..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '32px' }}
            />
            <MdSearch size={20} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#a0aec0' }} />
          </div>

          <select 
            className="input" 
            value={filtroRol} 
            onChange={e => { setFiltroRol(e.target.value); setPage(1); }}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="">Todos los Roles</option>
            <option value="admin">Administrador</option>
            <option value="vendedor">Vendedor</option>
            <option value="almacen">Almacén</option>
          </select>

          <select 
            className="input" 
            value={filtroEstado} 
            onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="">Todos los Estados</option>
            <option value="activo">Solo Activos</option>
            <option value="inactivo">Solo Inactivos</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={exportExcel} 
            className="btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#38a169', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }} 
            title="Exportar a Excel"
          >
            <FaFileExcel size={16} /> Exportar Excel
          </button>
          <button 
            onClick={exportPDF} 
            className="btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e53e3e', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }} 
            title="Exportar a PDF"
          >
            <FaFilePdf size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div style={{ overflowX: 'auto' }}>
        <table className="usuarios-table card" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>ID / Doc</th>
              <th style={{ padding: '12px' }}>Usuario</th>
              <th style={{ padding: '12px' }}>Rol / Cargo</th>
              <th style={{ padding: '12px' }}>Contacto & Dirección</th>
              <th style={{ padding: '12px' }}>Almacén / Comisión</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Último Acceso</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginados.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#718096' }}>
                  No se encontraron usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              paginados.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2d3748' }}>#{u.id}</div>
                    {u.documento ? (
                      <div style={{ fontSize: '11px', color: '#718096' }}>Doc: {u.documento}</div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#a0aec0', fontStyle: 'italic' }}>Sin doc</div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#2d3748' }}>{u.nombre}</div>
                    <div style={{ fontSize: '12px', color: '#718096' }}>{u.correo}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      display: 'inline-block',
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      background: u.rol === 'admin' ? '#ebf8ff' : u.rol === 'vendedor' ? '#feebc8' : '#e6fffa',
                      color: u.rol === 'admin' ? '#2b6cb0' : u.rol === 'vendedor' ? '#c05621' : '#234e52'
                    }}>
                      {u.rol}
                    </span>
                    {u.cargo && (
                      <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px', fontWeight: 500 }}>
                        {u.cargo}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>
                    {u.telefono && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4a5568' }}>
                        <MdPhone size={13} color="#718096" /> {u.telefono}
                      </div>
                    )}
                    {u.direccion && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#718096', marginTop: '2px' }}>
                        <MdLocationOn size={13} color="#a0aec0" /> {u.direccion}
                      </div>
                    )}
                    {!u.telefono && !u.direccion && (
                      <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Sin datos de contacto</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 600, color: '#2d3748' }}>
                      {u.almacenNombre || <span style={{ color: '#a0aec0' }}>General</span>}
                    </div>
                    {u.comision ? (
                      <div style={{ fontSize: '12px', color: '#2b6cb0', fontWeight: 600 }}>
                        Comisión: {u.comision}%
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => handleToggleEstado(u)}
                      disabled={loading}
                      title="Haz clic para cambiar estado"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer',
                        background: u.activo !== false ? '#c6f6d5' : '#fed7d7',
                        color: u.activo !== false ? '#22543d' : '#742a2a'
                      }}
                    >
                      {u.activo !== false ? (
                        <>
                          <MdCheckCircle size={14} /> Activo
                        </>
                      ) : (
                        <>
                          <MdBlock size={14} /> Inactivo
                        </>
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#718096' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MdAccessTime size={14} color="#a0aec0" />
                      {formatDate(u.ultimoAcceso)}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-edit" 
                        onClick={() => handleEdit(u)} 
                        disabled={loading} 
                        style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '2px solid #3182ce', color: '#3182ce', borderRadius: '4px', cursor: 'pointer', padding: 0 }} 
                        title="Editar usuario"
                      >
                        <MdEdit size={16} />
                      </button>
                      <button 
                        className="btn btn-delete" 
                        onClick={() => handleDelete(u.id)} 
                        disabled={loading} 
                        style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '2px solid #e53e3e', color: '#e53e3e', borderRadius: '4px', cursor: 'pointer', padding: 0 }} 
                        title="Eliminar usuario"
                      >
                        <MdDelete size={16} />
                      </button>
                      {showConfirm && deleteId === u.id && (
                        <div className="confirm-delete" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div className="confirm-delete-content" style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '350px', textAlign: 'center' }}>
                            <div className="confirm-delete-title" style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>¿Eliminar este usuario?</div>
                            <div className="confirm-delete-message" style={{ fontSize: '13px', color: '#718096', marginBottom: '16px' }}>Esta acción eliminará permanentemente la cuenta.</div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={confirmDelete} className="btn" style={{ background: '#e53e3e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                                Confirmar
                              </button>
                              <button onClick={() => { setShowConfirm(false); setDeleteId(null); }} className="btn" style={{ background: '#cbd5e0', color: '#2d3748', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: '12px' }}>
        <div className="paginacion-info" style={{ fontSize: '14px', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Mostrar</span>
          <select value={rowsPerPage} onChange={handleRowsPerPage} className="input" style={{ width: 'auto', padding: '4px 8px' }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>registros por página</span>
        </div>

        <div className="paginacion" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => handlePageChange(page - 1)} 
            disabled={page === 1} 
            className="btn-paginacion" 
            style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #cbd5e0', color: '#3182ce', borderRadius: '4px', cursor: 'pointer' }} 
            title="Anterior"
          >
            <MdArrowBack size={16} />
          </button>
          <span className="paginacion-info" style={{ fontWeight: 500, fontSize: '14px' }}>
            Página {page} de {totalPages}
          </span>
          <button 
            onClick={() => handlePageChange(page + 1)} 
            disabled={page === totalPages} 
            className="btn-paginacion" 
            style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #cbd5e0', color: '#3182ce', borderRadius: '4px', cursor: 'pointer' }} 
            title="Siguiente"
          >
            <MdArrowForward size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Users;

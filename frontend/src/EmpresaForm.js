import React, { useEffect, useState, useContext, useMemo } from 'react';
import './multinyectores.css';
import { AuthContext } from './AuthContext';
import { 
  MdBusiness, MdReceipt, MdLocationOn, MdPhone, MdMail, MdLanguage, 
  MdAttachMoney, MdInsertPhoto, MdSave, MdRefresh, MdCheckCircle, 
  MdVerifiedUser, MdAssignment, MdInfo, MdOutlineDescription
} from 'react-icons/md';
import { FaBuilding, FaFileInvoice, FaPercent, FaGlobe, FaStamp } from 'react-icons/fa';

function EmpresaForm() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.rol === 'admin';

  const [empresa, setEmpresa] = useState({
    nombre: '',
    nit: '',
    actividad_economica: '',
    representante_legal: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    telefono_secundario: '',
    correo: '',
    sitio_web: '',
    logo_url: '',
    moneda: '$',
    impuesto_porcentaje: 0,
    pie_pagina_factura: 'Gracias por su preferencia. Todo cambio o garantía requiere comprobante original.'
  });

  const [activeSection, setActiveSection] = useState('general'); // 'general', 'contacto', 'comercial', 'logo'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const tokenHeader = useMemo(() => {
    const token = user?.token || localStorage.getItem('token');
    return token ? `Bearer ${token}` : '';
  }, [user?.token]);

  // Cargar datos de la empresa al montar
  const fetchEmpresa = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/empresa', { headers: { 'Authorization': tokenHeader } });
      if (res.status === 404) {
        // Sin datos previos aún
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Estado ${res.status}`);
      }
      const data = await res.json();
      if (data && !data.error) {
        setEmpresa(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      setError('Error al obtener la información de la empresa: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchEmpresa();
  }, [tokenHeader]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmpresa(prev => ({ ...prev, [name]: value }));
  };

  // Manejador de carga de archivo de logo local (convertir a base64 optimizado)
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('El logo debe ser una imagen menor a 5 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 280;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          // Fondo blanco limpio para asegurar legibilidad en facturas
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Convertir a JPEG comprimido ultraligero (~10KB - 20KB)
          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setEmpresa(prev => ({ ...prev, logo_url: resizedBase64 }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Sólo los usuarios administradores pueden modificar los datos de la empresa.');
      return;
    }

    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const res = await fetch('/empresa', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': tokenHeader 
        },
        body: JSON.stringify(empresa)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Respuesta del servidor con código ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEmpresa(prev => ({ ...prev, ...data }));
      setSuccess('¡Perfil e identidad corporativa actualizados exitosamente!');
      window.dispatchEvent(new Event('empresaUpdated'));
    } catch (err) {
      setError('No se pudo guardar la información: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 0' }}>

      {/* HEADER DE LA SECCIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MdBusiness color="#2b6cb0" size={28} /> Configuración de Perfil Corporativo
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Administra la razón social, datos tributarios, contacto y membrete visual utilizado en facturas y recibos.
          </p>
        </div>

        <button 
          onClick={fetchEmpresa} 
          className="btn btn-secundario" 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748' }}
        >
          <MdRefresh size={18} /> Recargar Datos
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px', color: '#4a5568' }}>
          <span className="loader" style={{ marginRight: '8px' }}></span> Cargando perfil de la empresa...
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdCheckCircle size={20} /> {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>

          {/* COLUMNA IZQUIERDA: FORMULARIO POR SECCIONES */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

            {/* SELECCIÓN DE PESTAÑAS DEL FORMULARIO */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '2px solid #edf2f7', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveSection('general')}
                style={{
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeSection === 'general' ? '#2b6cb0' : '#718096',
                  borderBottom: activeSection === 'general' ? '3px solid #2b6cb0' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FaBuilding /> Datos Principales
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('contacto')}
                style={{
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeSection === 'contacto' ? '#2b6cb0' : '#718096',
                  borderBottom: activeSection === 'contacto' ? '3px solid #2b6cb0' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdLocationOn /> Contacto & Ubicación
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('comercial')}
                style={{
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeSection === 'comercial' ? '#2b6cb0' : '#718096',
                  borderBottom: activeSection === 'comercial' ? '3px solid #2b6cb0' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdReceipt /> Facturación & Impuestos
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('logo')}
                style={{
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeSection === 'logo' ? '#2b6cb0' : '#718096',
                  borderBottom: activeSection === 'logo' ? '3px solid #2b6cb0' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdInsertPhoto /> Logo & Marca
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>

              {/* SECCIÓN 1: DATOS PRINCIPALES */}
              {activeSection === 'general' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label htmlFor="empresa-nombre" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                      Nombre de la Empresa / Razón Social *
                    </label>
                    <input 
                      id="empresa-nombre" 
                      name="nombre" 
                      className="input" 
                      value={empresa.nombre} 
                      onChange={handleChange} 
                      required 
                      placeholder="Ej. Multinyectores y Repuestos S.A.S." 
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label htmlFor="empresa-nit" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        NIT / Identificación Tributaria *
                      </label>
                      <input 
                        id="empresa-nit" 
                        name="nit" 
                        className="input" 
                        value={empresa.nit} 
                        onChange={handleChange} 
                        required 
                        placeholder="Ej. 900.123.456-7" 
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label htmlFor="empresa-representante" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Representante Legal
                      </label>
                      <input 
                        id="empresa-representante" 
                        name="representante_legal" 
                        className="input" 
                        value={empresa.representante_legal || ''} 
                        onChange={handleChange} 
                        placeholder="Ej. Carlos Mendoza" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="empresa-actividad" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                      Actividad Económica / Giro del Negocio
                    </label>
                    <input 
                      id="empresa-actividad" 
                      name="actividad_economica" 
                      className="input" 
                      value={empresa.actividad_economica || ''} 
                      onChange={handleChange} 
                      placeholder="Ej. Venta e Importación de Autopartes e Inyectores Diesel/Gasolina" 
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* SECCIÓN 2: CONTACTO Y UBICACIÓN */}
              {activeSection === 'contacto' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                    <div>
                      <label htmlFor="empresa-direccion" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Dirección Comercial Principal *
                      </label>
                      <input 
                        id="empresa-direccion" 
                        name="direccion" 
                        className="input" 
                        value={empresa.direccion} 
                        onChange={handleChange} 
                        required 
                        placeholder="Ej. Av. Principal # 45-67, Zona Industrial" 
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label htmlFor="empresa-ciudad" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Ciudad / Región
                      </label>
                      <input 
                        id="empresa-ciudad" 
                        name="ciudad" 
                        className="input" 
                        value={empresa.ciudad || ''} 
                        onChange={handleChange} 
                        placeholder="Ej. Bogotá" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label htmlFor="empresa-telefono" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Teléfono Principal PBX *
                      </label>
                      <input 
                        id="empresa-telefono" 
                        name="telefono" 
                        className="input" 
                        value={empresa.telefono} 
                        onChange={handleChange} 
                        required 
                        placeholder="Ej. +57 (1) 234-5678" 
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label htmlFor="empresa-telefono-sec" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Teléfono Secundario / WhatsApp
                      </label>
                      <input 
                        id="empresa-telefono-sec" 
                        name="telefono_secundario" 
                        className="input" 
                        value={empresa.telefono_secundario || ''} 
                        onChange={handleChange} 
                        placeholder="Ej. +57 310 9876543" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label htmlFor="empresa-correo" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Correo Electrónico Corporativo *
                      </label>
                      <input 
                        id="empresa-correo" 
                        name="correo" 
                        type="email" 
                        className="input" 
                        value={empresa.correo} 
                        onChange={handleChange} 
                        required 
                        placeholder="ventas@multinyectores.com" 
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label htmlFor="empresa-sitio" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Sitio Web / Catálogo Virtual
                      </label>
                      <input 
                        id="empresa-sitio" 
                        name="sitio_web" 
                        className="input" 
                        value={empresa.sitio_web || ''} 
                        onChange={handleChange} 
                        placeholder="www.multinyectores.com" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN 3: COMERCIAL Y FACTURACIÓN */}
              {activeSection === 'comercial' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label htmlFor="empresa-moneda" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Símbolo de Moneda Principal
                      </label>
                      <select 
                        id="empresa-moneda" 
                        name="moneda" 
                        className="input" 
                        value={empresa.moneda || '$'} 
                        onChange={handleChange}
                        style={{ width: '100%' }}
                      >
                        <option value="$">Pesos / Dólares ($)</option>
                        <option value="USD">Dólares Estadounidenses (USD)</option>
                        <option value="BS">Bolivianos / Bolívares (BS)</option>
                        <option value="EUR">Euros (€)</option>
                        <option value="S/">Soles Peruanos (S/)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="empresa-impuesto" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                        Tasa de Impuesto por Defecto (% IVA)
                      </label>
                      <input 
                        id="empresa-impuesto" 
                        name="impuesto_porcentaje" 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        max="100" 
                        className="input" 
                        value={empresa.impuesto_porcentaje || 0} 
                        onChange={handleChange} 
                        placeholder="Ej. 13 o 19" 
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="empresa-pie" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                      Mensaje / Términos de Garantía al Pie de la Factura
                    </label>
                    <textarea 
                      id="empresa-pie" 
                      name="pie_pagina_factura" 
                      rows={3} 
                      className="input" 
                      value={empresa.pie_pagina_factura || ''} 
                      onChange={handleChange} 
                      placeholder="Escriba los términos de devolución, garantía o agradecimiento..." 
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* SECCIÓN 4: LOGO Y MARCA */}
              {activeSection === 'logo' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                      Cargar Logo Institucional
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      className="input" 
                      style={{ width: '100%', padding: '8px' }}
                    />
                    <small style={{ color: '#718096', display: 'block', marginTop: '4px' }}>
                      Formatos recomendados: PNG o JPG con fondo transparente. Máximo 2MB.
                    </small>
                  </div>

                  <div>
                    <label htmlFor="empresa-logo-url" style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                      O Ingrese URL Directa del Logo
                    </label>
                    <input 
                      id="empresa-logo-url" 
                      name="logo_url" 
                      className="input" 
                      value={empresa.logo_url || ''} 
                      onChange={handleChange} 
                      placeholder="https://ejemplo.com/logo.png" 
                      style={{ width: '100%' }}
                    />
                  </div>

                  {empresa.logo_url && (
                    <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px dashed #cbd5e0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#4a5568' }}>Carga Actual de Marca:</p>
                      <img src={empresa.logo_url} alt="Logo Empresa" style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              )}

              {/* BOTÓN DE GUARDADO */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #edf2f7', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  type="submit" 
                  disabled={saving || !isAdmin} 
                  className="btn btn-principal" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
                >
                  <MdSave size={20} />
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>

            </form>
          </div>

          {/* COLUMNA DERECHA: VISTA PREVIA MEMBRETE / ENCABEZADO */}
          <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileInvoice /> Vista Previa Encabezado de Documentos
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#718096' }}>
                Así se visualizará la identificación en comprobantes y cotizaciones.
              </p>
            </div>

            {/* HOJA SIMULADA DE COMPROBANTE */}
            <div style={{ border: '1px solid #cbd5e0', padding: '16px', borderRadius: '6px', background: '#fcfcfc', fontSize: '12px', color: '#2d3748' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2b6cb0', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  {empresa.logo_url ? (
                    <img src={empresa.logo_url} alt="Logo" style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', marginBottom: '6px' }} />
                  ) : (
                    <div style={{ fontWeight: 800, fontSize: '16px', color: '#2b6cb0', marginBottom: '4px' }}>
                      {empresa.nombre || 'NOMBRE EMPRESA'}
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a202c' }}>{empresa.nombre || 'Nombre de la Empresa'}</div>
                  <div style={{ fontSize: '11px', color: '#4a5568' }}>NIT: {empresa.nit || '000000000-0'}</div>
                  {empresa.actividad_economica && <div style={{ fontSize: '10px', color: '#718096', fontStyle: 'italic' }}>{empresa.actividad_economica}</div>}
                </div>

                <div style={{ textAlign: 'right', background: '#ebf8ff', padding: '8px 10px', borderRadius: '4px', border: '1px solid #bee3f8' }}>
                  <div style={{ fontWeight: 800, color: '#2b6cb0', fontSize: '13px' }}>FACTURA DE VENTA</div>
                  <div style={{ fontSize: '11px', color: '#2c5282' }}>Nº F-000123</div>
                  <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>Fecha: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* DETALLES DE UBICACIÓN Y CONTACTO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#4a5568', marginBottom: '12px' }}>
                <div>
                  <strong>Dirección:</strong> {empresa.direccion || 'Dirección Comercial'} {empresa.ciudad ? `, ${empresa.ciudad}` : ''}
                </div>
                <div>
                  <strong>Teléfono:</strong> {empresa.telefono || 'Tel. Principal'}
                </div>
                <div>
                  <strong>Email:</strong> {empresa.correo || 'contacto@empresa.com'}
                </div>
                {empresa.sitio_web && (
                  <div>
                    <strong>Web:</strong> {empresa.sitio_web}
                  </div>
                )}
              </div>

              {/* MUESTRA DE LEYENDA PIE DE PÁGINA */}
              {empresa.pie_pagina_factura && (
                <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '10px', color: '#718096', textAlign: 'center' }}>
                  {empresa.pie_pagina_factura}
                </div>
              )}

            </div>

            <div style={{ marginTop: '16px', background: '#ebf8ff', borderLeft: '4px solid #3182ce', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', color: '#2c5282' }}>
              <strong><MdInfo style={{ display: 'inline', verticalAlign: 'middle' }} /> Tip Empresarial:</strong> Los datos guardados aquí son compartidos automáticamente en la emisión de facturas electrónicas, reportes y cotizaciones.
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default EmpresaForm;

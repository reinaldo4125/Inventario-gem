import React, { useState, useEffect } from 'react';
import logoImg from './IMG/logo_blue_256.png';
import logoSvg from './IMG/logo.svg';
import './chartjs-setup'; // Asegura que la configuración global de Chart.js esté registrada
import './estilos-globales.css'; // Importar estilos globales
// Decodificar JWT (sin dependencia externa)
function parseJwt (token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  const decoded = parseJwt(token);
  if (!decoded) return true;
  if (!decoded.exp) return false;
  // Considerar expirado si restan menos de 3 segundos
  return (decoded.exp * 1000) <= (Date.now() + 3000);
}
import './multinyectores.css';
import Users from './Users';
import Productos from './Productos';
import Ventas from './Ventas';
import Facturacion from './Facturacion';
import Clientes from './Clientes';
import Login from './Login';
import Dashboard from './Dashboard';
import Reportes from './Reportes';
import EmpresaForm from './EmpresaForm';
import Almacenes from './Almacenes';
import PerfilVendedor from './PerfilVendedor';
import Caja from './Caja';
import Cartera from './Cartera';
import { puede, nombreRol } from './config/permisos';
// ToastContainer global deshabilitado temporalmente para evitar error de tipo de elemento inválido en producción
// import { ToastContainer } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';


function App() {
  const [seccion, setSeccion] = useState('dashboard');
  const [usuario, setUsuario] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [appVersion, setAppVersion] = useState('1.0.0');
  // If AuthContext is provided, use it for login/logout
  let authContext = null;
  try { authContext = require('./AuthContext').AuthContext; } catch {}

  // Función unificada para cerrar sesión y limpiar datos de forma segura
  const cerrarSesion = (motivo = null) => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('usuario');
    if (motivo) {
      localStorage.setItem('auth_notice', motivo);
    }
    setUsuario(null);
    try {
      if (authContext && authContext._currentValue && authContext._currentValue.logout) {
        authContext._currentValue.logout();
      }
    } catch {}
  };

  // Escuchar eventos globales de expiración o token inválido
  useEffect(() => {
    const handleAuthExpired = (event) => {
      const msg = event?.detail?.reason || 'Tu sesión ha expirado o el token es inválido. Por favor inicia sesión nuevamente.';
      cerrarSesion(msg);
    };
    window.addEventListener('auth:expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  // Cargar datos públicos de empresa y versión del sistema
  useEffect(() => {
    const cargarEmpresa = () => {
      fetch('/empresa/public')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.logo_url) {
            setEmpresa(data);
          }
        })
        .catch(() => {});
    };

    fetch('/api/version')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.version) {
          setAppVersion(data.version);
        }
      })
      .catch(() => {});

    cargarEmpresa();
    window.addEventListener('empresaUpdated', cargarEmpresa);
    return () => window.removeEventListener('empresaUpdated', cargarEmpresa);
  }, []);

  // Validar token y programar cierre automático cuando llegue a exp
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (usuario) setUsuario(null);
      return;
    }

    if (isTokenExpired(token)) {
      cerrarSesion('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      return;
    }

    const decoded = parseJwt(token);
    if (!decoded || !decoded.nombre || !decoded.rol) {
      cerrarSesion('Token inválido. Inicia sesión nuevamente.');
      return;
    }

    if (!usuario) {
      setUsuario({
        id: decoded.id,
        nombre: decoded.nombre,
        rol: decoded.rol,
        correo: decoded.correo,
        almacenId: decoded.almacenId,
        almacen: decoded.almacen,
        token
      });
    }

    // Programar temporizador exacto cuando el token expire en vivo
    if (decoded.exp) {
      const msRestantes = (decoded.exp * 1000) - Date.now();
      if (msRestantes > 0) {
        const timerId = setTimeout(() => {
          cerrarSesion('Tu sesión ha expirado automáticamente. Por favor inicia sesión nuevamente.');
        }, msRestantes);
        return () => clearTimeout(timerId);
      } else {
        cerrarSesion('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      }
    }
  }, [usuario]);

  // Verificación periódica cada 15 segundos en caso de cambio de hora o suspensión
  useEffect(() => {
    if (!usuario) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        cerrarSesion('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [usuario]);

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  return (
    <div>
      <header className="header-multinyectores">
        <div className="header-brand">
          <img 
            src={empresa?.logo_url || logoImg} 
            alt={empresa?.nombre || "Logo Multinyectores"} 
            onError={(e) => { e.target.src = logoSvg; }} 
            style={{ maxHeight: '50px', maxWidth: '160px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="titulo">{empresa?.nombre || 'MULTINYECTORES'}</div>
              <span style={{ 
                background: '#e0f2fe', 
                color: '#0369a1', 
                fontSize: '11px', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: '12px',
                border: '1px solid #bae6fd' 
              }}>
                v{appVersion}
              </span>
            </div>
            <div className="subtitulo">INYECCIÓN ELECTRÓNICA & INVENTARIO</div>
          </div>
        </div>
        <div className="header-user-info">
          <span className="user-badge">
            👤 <strong>{usuario.nombre}</strong> ({nombreRol(usuario.rol)})
          </span>
          <button 
            className="btn-principal btn-peligro" 
            onClick={() => cerrarSesion()}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="menu-nav-container">
        <nav className="menu-nav">
          {puede(usuario, ['dashboard.ver', 'dashboard.stock']) && (
            <button 
              onClick={() => setSeccion('dashboard')} 
              className={`nav-btn ${seccion === 'dashboard' ? 'active' : ''}`}
            >
              📊 Dashboard
            </button>
          )}

          {puede(usuario, 'ventas.crear') && (
            <button 
              onClick={() => setSeccion('ventas')} 
              className={`nav-btn ${seccion === 'ventas' ? 'active' : ''}`}
            >
              🛒 Ventas
            </button>
          )}

          {puede(usuario, 'facturas.crear') && (
            <button 
              onClick={() => setSeccion('facturacion')} 
              className={`nav-btn ${seccion === 'facturacion' ? 'active' : ''}`}
            >
              📄 Facturación
            </button>
          )}

          {puede(usuario, 'cartera.ver') && (
            <button 
              onClick={() => setSeccion('cartera')} 
              className={`nav-btn ${seccion === 'cartera' ? 'active' : ''}`}
            >
              📑 Cartera / CxC
            </button>
          )}

          {puede(usuario, 'caja.operar') && (
            <button 
              onClick={() => setSeccion('caja')} 
              className={`nav-btn ${seccion === 'caja' ? 'active' : ''}`}
            >
              💵 Arqueo de Caja
            </button>
          )}

          {puede(usuario, 'productos.ver') && (
            <button 
              onClick={() => setSeccion('productos')} 
              className={`nav-btn ${seccion === 'productos' ? 'active' : ''}`}
            >
              📦 Productos
            </button>
          )}

          {puede(usuario, ['clientes.crear', 'clientes.editar']) && (
            <button 
              onClick={() => setSeccion('clientes')} 
              className={`nav-btn ${seccion === 'clientes' ? 'active' : ''}`}
            >
              👤 Clientes
            </button>
          )}

          {puede(usuario, 'usuarios.gestionar_vendedores') && (
            <button 
              onClick={() => setSeccion('usuarios')} 
              className={`nav-btn ${seccion === 'usuarios' ? 'active' : ''}`}
            >
              👥 {usuario.rol === 'admin_pos' ? 'Personal Sede' : 'Usuarios'}
            </button>
          )}

          {puede(usuario, 'almacenes.gestionar') && (
            <button 
              onClick={() => setSeccion('almacenes')} 
              className={`nav-btn ${seccion === 'almacenes' ? 'active' : ''}`}
            >
              🏬 Almacenes
            </button>
          )}

          {puede(usuario, ['reportes.ver', 'reportes.ver_propios']) && (
            <button 
              onClick={() => setSeccion('reportes')} 
              className={`nav-btn ${seccion === 'reportes' ? 'active' : ''}`}
            >
              📈 {usuario.rol === 'admin_pos' ? 'Reportes Sede' : 'Reportes'}
            </button>
          )}

          {puede(usuario, 'empresa.editar') && (
            <button 
              onClick={() => setSeccion('empresa')} 
              className={`nav-btn ${seccion === 'empresa' ? 'active' : ''}`}
            >
              🏢 Empresa
            </button>
          )}

          {usuario.rol === 'vendedor' && (
            <button 
              onClick={() => setSeccion('perfil')} 
              className={`nav-btn ${seccion === 'perfil' ? 'active' : ''}`}
            >
              👤 Mi Perfil
            </button>
          )}
        </nav>
      </div>

      <main style={{ minHeight: '80vh', padding: '0 8px 32px' }}>
        {seccion === 'dashboard' && puede(usuario, ['dashboard.ver', 'dashboard.stock']) && <Dashboard usuario={usuario} onNavigate={setSeccion} />}
        {seccion === 'ventas' && puede(usuario, 'ventas.crear') && <Ventas usuario={usuario} onNavigate={setSeccion} />}
        {seccion === 'facturacion' && puede(usuario, 'facturas.crear') && <Facturacion usuario={usuario} onNavigate={setSeccion} />}
        {seccion === 'cartera' && puede(usuario, 'cartera.ver') && <Cartera usuario={usuario} />}
        {seccion === 'caja' && puede(usuario, 'caja.operar') && <Caja usuario={usuario} />}
        {seccion === 'productos' && puede(usuario, 'productos.ver') && <Productos usuario={usuario} />}
        {seccion === 'clientes' && puede(usuario, ['clientes.crear', 'clientes.editar']) && <Clientes usuario={usuario} />}
        {seccion === 'usuarios' && puede(usuario, 'usuarios.gestionar_vendedores') && <Users usuario={usuario} />}
        {seccion === 'almacenes' && puede(usuario, 'almacenes.gestionar') && <Almacenes usuario={usuario} onNavigate={setSeccion} />}
        {seccion === 'reportes' && puede(usuario, ['reportes.ver', 'reportes.ver_propios']) && <Reportes usuario={usuario} />}
        {seccion === 'empresa' && puede(usuario, 'empresa.editar') && <EmpresaForm />}
        {seccion === 'perfil' && usuario.rol === 'vendedor' && <PerfilVendedor usuario={usuario} />}
      </main>

      <footer style={{ marginTop: 32, padding: '18px 20px', textAlign: 'center', fontSize: '13px', color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span>Multinyectores © 2026 — Sistema de Gestión Comercial & Inyección Electrónica</span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>v{appVersion}</span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <span>
          Desarrollado por{' '}
          <a 
            href="https://www.linkedin.com/in/reinaldo-duran-castro" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
          >
            Reinaldo Durán
          </a>
        </span>
      </footer>
    </div>
  );
}

export default App;

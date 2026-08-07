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
// ToastContainer global deshabilitado temporalmente para evitar error de tipo de elemento inválido en producción
// import { ToastContainer } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';


function App() {
  const [seccion, setSeccion] = useState('dashboard');
  const [usuario, setUsuario] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  // If AuthContext is provided, use it for login/logout
  let authContext = null;
  try { authContext = require('./AuthContext').AuthContext; } catch {}

  // Cargar datos públicos de empresa para el logo y título de la cabecera
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
    cargarEmpresa();
    window.addEventListener('empresaUpdated', cargarEmpresa);
    return () => window.removeEventListener('empresaUpdated', cargarEmpresa);
  }, []);

  // Al cargar, si hay token, decodifica usuario
  // El tiempo de expiración de la sesión depende del token JWT generado en el backend (por ejemplo, 1h o 2h típicamente).
  // Si el token expira, el backend responde 401 y el frontend redirige automáticamente al login.
  useEffect(() => {
    if (!usuario) {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded = parseJwt(token);
        if (decoded && decoded.nombre && decoded.rol) {
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
      }
    }
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
            <div className="titulo">{empresa?.nombre || 'MULTINYECTORES'}</div>
            <div className="subtitulo">INYECCIÓN ELECTRÓNICA & INVENTARIO</div>
          </div>
        </div>
        <div className="header-user-info">
          <span className="user-badge">
            👤 <strong>{usuario.nombre}</strong> ({usuario.rol})
          </span>
          <button 
            className="btn-principal btn-peligro" 
            onClick={() => {
              setUsuario(null);
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              try {
                const { logout } = require('./AuthContext').AuthContext._currentValue || {};
                if (logout) logout();
              } catch {}
            }}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="menu-nav-container">
        <nav className="menu-nav">
          <button 
            onClick={() => setSeccion('dashboard')} 
            className={`nav-btn ${seccion === 'dashboard' ? 'active' : ''}`}
          >
            📊 Dashboard
          </button>

          {usuario.rol === 'admin' && (
            <>
              <button 
                onClick={() => setSeccion('usuarios')} 
                className={`nav-btn ${seccion === 'usuarios' ? 'active' : ''}`}
              >
                👥 Usuarios
              </button>
              <button 
                onClick={() => setSeccion('clientes')} 
                className={`nav-btn ${seccion === 'clientes' ? 'active' : ''}`}
              >
                👤 Clientes
              </button>
              <button 
                onClick={() => setSeccion('productos')} 
                className={`nav-btn ${seccion === 'productos' ? 'active' : ''}`}
              >
                📦 Productos
              </button>
              <button 
                onClick={() => setSeccion('almacenes')} 
                className={`nav-btn ${seccion === 'almacenes' ? 'active' : ''}`}
              >
                🏬 Almacenes
              </button>
              <button 
                onClick={() => setSeccion('ventas')} 
                className={`nav-btn ${seccion === 'ventas' ? 'active' : ''}`}
              >
                🛒 Ventas
              </button>
              <button 
                onClick={() => setSeccion('facturacion')} 
                className={`nav-btn ${seccion === 'facturacion' ? 'active' : ''}`}
              >
                📄 Facturación
              </button>
              <button 
                onClick={() => setSeccion('caja')} 
                className={`nav-btn ${seccion === 'caja' ? 'active' : ''}`}
              >
                💵 Arqueo de Caja
              </button>
              <button 
                onClick={() => setSeccion('reportes')} 
                className={`nav-btn ${seccion === 'reportes' ? 'active' : ''}`}
              >
                📈 Reportes
              </button>
              <button 
                onClick={() => setSeccion('empresa')} 
                className={`nav-btn ${seccion === 'empresa' ? 'active' : ''}`}
              >
                🏢 Empresa
              </button>
            </>
          )}

          {usuario.rol === 'vendedor' && (
            <>
              <button 
                onClick={() => setSeccion('ventas')} 
                className={`nav-btn ${seccion === 'ventas' ? 'active' : ''}`}
              >
                🛒 Ventas
              </button>
              <button 
                onClick={() => setSeccion('caja')} 
                className={`nav-btn ${seccion === 'caja' ? 'active' : ''}`}
              >
                💵 Arqueo de Caja
              </button>
              <button 
                onClick={() => setSeccion('clientes')} 
                className={`nav-btn ${seccion === 'clientes' ? 'active' : ''}`}
              >
                👤 Clientes
              </button>
              <button 
                onClick={() => setSeccion('productos')} 
                className={`nav-btn ${seccion === 'productos' ? 'active' : ''}`}
              >
                📦 Productos
              </button>
              <button 
                onClick={() => setSeccion('reportes')} 
                className={`nav-btn ${seccion === 'reportes' ? 'active' : ''}`}
              >
                📈 Reportes
              </button>
              <button 
                onClick={() => setSeccion('perfil')} 
                className={`nav-btn ${seccion === 'perfil' ? 'active' : ''}`}
              >
                👤 Mi Perfil
              </button>
            </>
          )}
        </nav>
      </div>

      <main style={{ minHeight: '80vh', padding: '0 8px 32px' }}>
        {seccion === 'almacenes' && usuario.rol === 'admin' && <Almacenes usuario={usuario} />}
        {seccion === 'dashboard' && <Dashboard usuario={usuario} onNavigate={setSeccion} />}
        {seccion === 'usuarios' && usuario.rol === 'admin' && <Users usuario={usuario} />}
        {seccion === 'clientes' && (usuario.rol === 'admin' || usuario.rol === 'vendedor') && <Clientes usuario={usuario} />}
        {seccion === 'productos' && (usuario.rol === 'admin' || usuario.rol === 'vendedor') && <Productos usuario={usuario} />}
        {seccion === 'ventas' && (usuario.rol === 'admin' || usuario.rol === 'vendedor') && <Ventas usuario={usuario} />}
        {seccion === 'caja' && (usuario.rol === 'admin' || usuario.rol === 'vendedor') && <Caja usuario={usuario} />}
        {seccion === 'facturacion' && usuario.rol === 'admin' && <Facturacion usuario={usuario} />}
        {seccion === 'reportes' && (usuario.rol === 'admin' || usuario.rol === 'vendedor') && <Reportes usuario={usuario} />}
        {seccion === 'empresa' && usuario.rol === 'admin' && <EmpresaForm />}
        {seccion === 'perfil' && usuario.rol === 'vendedor' && <PerfilVendedor usuario={usuario} />}
      </main>

      <footer style={{ marginTop: 32, padding: '16px 0', textAlign: 'center', fontSize: 13, color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
        Multinyectores © 2026 — Sistema de Gestión Comercial & Inyección Electrónica
      </footer>
    </div>
  );
}

export default App;

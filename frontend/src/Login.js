import React, { useState, useEffect, useContext } from 'react';
import './multinyectores.css';
import { AuthContext } from './AuthContext';
import logoImg from './IMG/logo_blue_256.png';
import logoSvg from './IMG/logo.svg';

function Login({ onLogin }) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [empresaLogo, setEmpresaLogo] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState('MULTINYECTORES');
  const auth = useContext(AuthContext);

  useEffect(() => {
    fetch('/empresa/public')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.logo_url) setEmpresaLogo(data.logo_url);
          if (data.nombre) setEmpresaNombre(data.nombre);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Credenciales incorrectas');
        throw new Error('Error del servidor. Intenta de nuevo más tarde.');
      }
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      let decoded = null;
      try {
        const base64Url = data.token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        decoded = JSON.parse(jsonPayload);
      } catch {}

      if (auth && auth.login) {
        auth.login({ token: data.token, refreshToken: data.refreshToken, id: decoded?.id, nombre: decoded?.nombre, rol: decoded?.rol, correo: decoded?.correo, almacenId: decoded?.almacenId, almacen: decoded?.almacen });
      }
      if (onLogin) onLogin({ id: decoded?.id, nombre: decoded?.nombre || '', rol: decoded?.rol || '', correo: decoded?.correo || '', token: data.token, almacenId: decoded?.almacenId, almacen: decoded?.almacen });
    } catch (err) {
      if (err && err.message && err.message.includes('Failed to fetch')) {
        setError('No se pudo conectar al servidor. Verifica tu conexión.');
      } else {
        setError(err.message || 'Error desconocido');
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-container" style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'90vh',background:'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',padding:'20px'}}>
      <form onSubmit={handleSubmit} style={{background:'#ffffff',padding:'36px 32px',borderRadius:'12px',boxShadow:'0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',width:'100%',maxWidth:'400px'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'24px'}}>
          <img 
            src={empresaLogo || logoImg} 
            alt={empresaNombre || "Logo Empresa"} 
            onError={(e) => { e.target.src = logoSvg; }}
            style={{height:'64px',marginBottom:'12px',objectFit:'contain',maxWidth:'220px'}} 
          />
          <h2 style={{margin:0,fontSize:'22px',fontWeight:'700',color:'#0f172a',textAlign:'center'}}>{empresaNombre || 'MULTINYECTORES'}</h2>
          <span style={{fontSize:'12px',fontWeight:'600',color:'#64748b',letterSpacing:'0.05em',marginTop:'2px'}}>INYECCIÓN ELECTRÓNICA & INVENTARIO</span>
        </div>

        {error && (
          <div style={{padding:'10px 14px',backgroundColor:'#fef2f2',color:'#991b1b',border:'1px solid #fecaca',borderRadius:'6px',fontSize:'13px',marginBottom:'16px',lineHeight:'1.4'}}>
            {error}
          </div>
        )}

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'12px',fontWeight:'600',color:'#334155',marginBottom:'6px'}}>Usuario o Correo electrónico</label>
          <input 
            type="text" 
            placeholder="admin" 
            value={correo} 
            onChange={e => setCorreo(e.target.value)} 
            required 
            style={{width:'100%',padding:'10px 12px',borderRadius:'6px',border:'1px solid #cbd5e1',fontSize:'14px',outline:'none',boxSizing:'border-box'}} 
          />
        </div>

        <div style={{marginBottom:'20px',position:'relative'}}>
          <label style={{display:'block',fontSize:'12px',fontWeight:'600',color:'#334155',marginBottom:'6px'}}>Contraseña</label>
          <div style={{position:'relative'}}>
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{width:'100%',padding:'10px 40px 10px 12px',borderRadius:'6px',border:'1px solid #cbd5e1',fontSize:'14px',outline:'none',boxSizing:'border-box'}} 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'#64748b',padding:0}}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{width:'100%',padding:'12px',backgroundColor:'#2563eb',color:'#ffffff',border:'none',borderRadius:'6px',fontWeight:'600',fontSize:'15px',cursor:loading ? 'not-allowed' : 'pointer',transition:'background-color 0.2s',boxShadow:'0 2px 4px rgba(37,99,235,0.2)'}}
        >
          {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
        </button>
      </form>
    </div>
  );
}

export default Login;

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
  const [notice, setNotice] = useState('');
  const auth = useContext(AuthContext);

  useEffect(() => {
    const savedNotice = localStorage.getItem('auth_notice');
    if (savedNotice) {
      setNotice(savedNotice);
      localStorage.removeItem('auth_notice');
    }

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
    setNotice('');
    setLoading(true);
    try {
      const cleanCorreo = String(correo || '').trim();
      const cleanPassword = String(password || '').trim();
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: cleanCorreo, password: cleanPassword })
      });
      if (!res.ok) {
        let errorMsg = '';
        try {
          const errData = await res.json();
          errorMsg = errData?.error || errData?.mensaje || '';
        } catch {}
        if (!errorMsg) {
          if (res.status === 401) errorMsg = 'Credenciales incorrectas';
          else if (res.status === 403) errorMsg = 'Cuenta desactivada o sin permisos de acceso';
          else if (res.status === 429) errorMsg = 'Demasiados intentos. Por favor espera un momento.';
          else errorMsg = 'Error del servidor. Intenta de nuevo más tarde.';
        }
        throw new Error(errorMsg);
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

      const userObj = {
        id: decoded?.id || data.id,
        nombre: decoded?.nombre || data.nombre || '',
        rol: decoded?.rol || data.rol || '',
        correo: decoded?.correo || data.correo || '',
        token: data.token,
        refreshToken: data.refreshToken,
        almacenId: decoded?.almacenId || data.almacenId,
        almacen: decoded?.almacen || data.almacen
      };

      if (auth && auth.login) {
        auth.login(userObj);
      }
      if (onLogin) onLogin(userObj);
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
    <div className="login-container" style={{display:'flex',flexDirection:'column',justifyContent:'space-between',alignItems:'center',minHeight:'100vh',background:'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',padding:'20px 20px 0',boxSizing:'border-box'}}>
      <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '20px 0'}}>
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

          {notice && (
            <div style={{padding:'10px 14px',backgroundColor:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',borderRadius:'6px',fontSize:'13px',marginBottom:'16px',lineHeight:'1.4',display:'flex',alignItems:'center',gap:'8px'}}>
              <span>⚠️</span> <span>{notice}</span>
            </div>
          )}

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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
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

      <footer style={{ width: '100%', textAlign: 'center', padding: '16px 20px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent' }}>
        Multinyectores © 2026 — Desarrollado por{' '}
        <a 
          href="https://www.linkedin.com/in/reinaldo-duran-castro" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: '#60a5fa', fontWeight: '600', textDecoration: 'none' }}
        >
          Reinaldo Durán
        </a>
      </footer>
    </div>
  );
}

export default Login;

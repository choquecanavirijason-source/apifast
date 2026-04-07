import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { theme } from '../styles/colors'
import { useDispatch } from 'react-redux';
import { login, getMe } from '@/core/reducer/auth.reducer';
import type { AppDispatch } from '@/store';

// --- NUEVOS ICONOS PROFESIONALES ---
// Instalación recomendada: npm install lucide-react
import { User, Lock, Eye, EyeOff, LogIn, Atom } from 'lucide-react';

export default function Login() {
  const [usuario, setUsuario] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false) // Estado para ver password
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [focusedInput, setFocusedInput] = React.useState<string | null>(null)

  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true) 
    try {
      await dispatch(login({ email: usuario, password })).unwrap();
      await dispatch(getMe()).unwrap();
      navigate('/') 
    } catch (err) {
      setError(typeof err === "string" ? err : 'No se pudo iniciar sesión. Verifica el backend y tus credenciales.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundShape}></div>

      <div style={styles.card}>
        {/* LADO IZQUIERDO: Branding */}
        <div style={styles.imageSection}>
          <div style={styles.imageOverlay}>
            <div style={styles.reactBadge}>
            </div>
           
          </div>
          <img src="/login-illustration.jpg" alt="Login Illustration" style={styles.image} />
        </div>

        {/* LADO DERECHO: Formulario */}
        <div style={styles.formSection}>
          <div style={styles.header}>
            <h2 style={styles.title}>Iniciar Sesión</h2>
            <p style={styles.subtitle}>Accede a tu panel de control</p>
          </div>

          <form onSubmit={submit} style={styles.form}>
            
            {/* Input Usuario */}
            <div style={{...styles.inputContainer, ...(focusedInput === 'user' ? styles.inputFocus : {})}}>
              <User size={18} style={styles.icon} color={focusedInput === 'user' ? theme.accent : '#666'} />
              <input
                type="text"
                placeholder="Usuario o Email"
                value={usuario}
                disabled={loading}
                onFocus={() => setFocusedInput('user')}
                onBlur={() => setFocusedInput(null)}
                onChange={(e) => setUsuario(e.target.value)}
                style={styles.input}
              />
            </div>

            {/* Input Contraseña con OJO */}
            <div style={{...styles.inputContainer, ...(focusedInput === 'pass' ? styles.inputFocus : {})}}>
              <Lock size={18} style={styles.icon} color={focusedInput === 'pass' ? theme.accent : '#666'} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                disabled={loading}
                onFocus={() => setFocusedInput('pass')}
                onBlur={() => setFocusedInput(null)}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={18} color="#888"/> : <Eye size={18} color="#888"/>}
              </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.forgotContainer}>
                <Link to="/forgot-password" style={styles.forgot}>
                ¿Olvidaste tu contraseña?
                </Link>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                style={{
                    ...styles.button, 
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'wait' : 'pointer'
                }}
            >
              {loading ? 'AUTENTICANDO...' : (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap: '10px'}}>
                    INGRESAR <LogIn size={18} />
                </div>
              )}
            </button>

            <div style={styles.footer}>
               ¿No tienes una cuenta? 
               <Link to="/register" style={styles.link}> Regístrate aquí</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: theme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        overflow: 'hidden',
    },
    backgroundShape: {
        position: 'absolute',
        width: '600px', 
        height: '600px',
        background: theme.accent,
        borderRadius: '50%',
        top: '-10%',
        right: '-5%',
        opacity: 0.05,
        filter: 'blur(100px)',
        zIndex: 0,
      },
      card: {
        zIndex: 1,
        width: '900px',
        minHeight: '550px', 
        background: theme.secondary,
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        overflow: 'hidden',
        border: `1px solid rgba(255,255,255,0.05)`,
      },
      imageSection: {
        flex: '1.2',
        position: 'relative',
      },
      image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      },
      imageOverlay: {
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(to bottom, transparent, ${theme.secondary})`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px',
      },
      reactBadge: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.3)',
        padding: '8px 15px',
        borderRadius: '50px',
        width: 'fit-content',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(5px)'
      },
      imageText: {
        color: '#fff',
        fontSize: '3rem',
        fontWeight: '800',
        lineHeight: '1.1',
      },
      formSection: {
        flex: '1',
        padding: '50px 45px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: theme.secondary,
      },
      header: {
        marginBottom: '35px',
      },
      title: {
        fontSize: '1.8rem',
        fontWeight: '700',
        color: '#fff',
        marginBottom: '5px',
      },
      subtitle: {
        fontSize: '0.9rem',
        color: '#888',
      },
      form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      },
      inputContainer: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        padding: '0 15px',
        transition: 'all 0.2s ease',
        border: '1px solid rgba(255,255,255,0.1)',
      },
      inputFocus: {
        background: 'rgba(255,255,255,0.07)',
        borderColor: theme.accent,
      },
      icon: {
        marginRight: '12px',
      },
      input: {
        flex: 1,
        height: '52px',
        background: 'transparent',
        border: 'none',
        color: '#fff',
        outline: 'none',
        fontSize: '0.95rem',
      },
      eyeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      forgotContainer: {
        textAlign: 'right',
      },
      forgot: {
        fontSize: '0.8rem',
        color: '#777',
        textDecoration: 'none',
      },
      button: {
        height: '52px',
        borderRadius: '12px',
        border: 'none',
        background: theme.accent,
        color: '#000', // Texto oscuro sobre fondo brillante suele verse más pro
        fontSize: '0.95rem',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: `0 8px 20px ${theme.accent}33`,
        marginTop: '10px',
      },
      error: {
        color: '#ff6b6b',
        fontSize: '0.85rem',
        textAlign: 'center',
      },
      footer: {
        marginTop: '25px',
        textAlign: 'center',
        fontSize: '0.85rem',
        color: '#777',
      },
      link: {
        color: theme.accent,
        fontWeight: '600',
        textDecoration: 'none',
      },
}
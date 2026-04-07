import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { theme } from '../styles/colors'

export default function Register() {
  const [usuario, setUsuario] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [countryCode, setCountryCode] = React.useState('+591')
  const [phone, setPhone] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Estados para efectos visuales (Focus)
  const [focusedInput, setFocusedInput] = React.useState<string | null>(null)

  const auth = useAuth()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones básicas
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 8) { // Ajustado a 8 para coincidir con el backend
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    try {
      const ok = await auth.register(
        usuario,
        password,
        countryCode,
        phone
      )

      if (ok) {
        navigate('/login')
      } else {
        setError('Error al registrar. El email ya podría existir.')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
    }
  }

  // Helper para manejar el estilo de focus
  const handleFocus = (name: string) => setFocusedInput(name)
  const handleBlur = () => setFocusedInput(null)

  return (
    <div style={styles.page}>

      {/* Fondo decorativo detrás de la tarjeta (Opcional) */}
      <div style={styles.backgroundShape}></div>

      <div style={styles.card}>

        {/* LADO IZQUIERDO: Imagen Artística */}
        <div style={styles.imageSection}>
          <div style={styles.imageOverlay}>
            <h3 style={styles.imageText}>Bienvenido<br /></h3>
          </div>
          <img
            src="/register-illustration.jpg"
            alt="Registro"
            style={styles.image}
          />
        </div>

        {/* LADO DERECHO: Formulario Limpio */}
        <div style={styles.formSection}>
          <div style={styles.header}>
            <h2 style={styles.title}>Crear Cuenta</h2>
            <p style={styles.subtitle}>Bienvenido a la familia</p>
          </div>

          <form onSubmit={submit} style={styles.form}>

            {/* Input Usuario */}
            <div style={{ ...styles.inputContainer, ...(focusedInput === 'user' ? styles.inputFocus : {}) }}>
              <span style={styles.icon}>👤</span>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={usuario}
                onFocus={() => handleFocus('user')}
                onBlur={handleBlur}
                onChange={(e) => setUsuario(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {/* Input Password */}
            <div style={{ ...styles.inputContainer, ...(focusedInput === 'pass' ? styles.inputFocus : {}) }}>
              <span style={styles.icon}>🔒</span>
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onFocus={() => handleFocus('pass')}
                onBlur={handleBlur}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {/* Input Confirm Password */}
            <div style={{ ...styles.inputContainer, ...(focusedInput === 'confirm' ? styles.inputFocus : {}) }}>
              <span style={styles.icon}>🔐</span>
              <input
                type="password"
                placeholder="Repetir contraseña"
                value={confirmPassword}
                onFocus={() => handleFocus('confirm')}
                onBlur={handleBlur}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {/* SECCIÓN DE TELÉFONO UNIFICADA */}
            <div style={{ ...styles.phoneContainer, ...(focusedInput === 'phone' ? styles.inputFocus : {}) }}>
              <input
                type="text"
                value={countryCode}
                maxLength={4}
                onFocus={() => handleFocus('phone')}
                onBlur={handleBlur}
                onChange={(e) => {
                  // Aseguramos que siempre empiece con +
                  const val = e.target.value.startsWith('+') ? e.target.value : '+' + e.target.value;
                  setCountryCode(val);
                }}
                style={styles.countryInput}
              />
              <div style={styles.verticalDivider}></div>
              <input
                type="tel"
                placeholder="Número de celular"
                value={phone}
                onFocus={() => handleFocus('phone')}
                onBlur={handleBlur}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} // Solo números
                style={styles.phoneInput}
                required
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" style={styles.button}>
              EMPEZAR AHORA
            </button>

            <div style={styles.footer}>
              <span style={{ opacity: 0.6 }}>¿Ya tienes cuenta?</span>
              <Link to="/login" style={styles.link}> Iniciar Sesión</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* =======================
   ESTILOS ORIGINALES
======================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: theme.bg, // Usamos tu color de fondo
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  // Elemento decorativo flotante detrás
  backgroundShape: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    background: theme.accent,
    borderRadius: '50%',
    top: '-10%',
    right: '-10%',
    opacity: 0.1,
    filter: 'blur(80px)',
    zIndex: 0,
  },
  card: {
    zIndex: 1,
    width: '900px',
    minHeight: '600px',
    background: theme.secondary, // Fondo oscuro/sólido para la tarjeta
    borderRadius: '30px', // Bordes mucho más redondeados
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    overflow: 'hidden',
    border: `1px solid ${theme.accent}20`, // Borde sutil del color acento
  },
  /* --- SECCIÓN IMAGEN --- */
  imageSection: {
    flex: '1.2', // La imagen ocupa un poco más de espacio
    position: 'relative',
    clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0% 100%)', // Corte diagonal original
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: `linear-gradient(to bottom, ${theme.secondary}80, ${theme.accent}80)`, // Degradado sobre la imagen
    display: 'flex',
    alignItems: 'flex-end',
    padding: '40px',
  },
  imageText: {
    color: '#fff',
    fontSize: '3rem',
    fontWeight: '800',
    lineHeight: '1.1',
    marginBottom: '40px',
  },
  /* --- SECCIÓN FORMULARIO --- */
  formSection: {
    flex: '1',
    padding: '50px 40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    background: theme.secondary, // El fondo del form igual al del card
    color: '#fff',
  },
  header: {
    marginBottom: '30px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px', // Espacio consistente entre inputs
  },
  /* --- INPUTS ESTILIZADOS --- */
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.05)', // Fondo semitransparente
    borderRadius: '12px',
    padding: '0 15px',
    transition: 'all 0.3s ease',
    border: '1px solid transparent',
  },
  inputFocus: {
    background: 'rgba(255,255,255,0.1)',
    border: `1px solid ${theme.accent}`, // Borde color acento al enfocar
    transform: 'translateY(-2px)', // Pequeña elevación
  },
  icon: {
    marginRight: '10px',
    fontSize: '1.1rem',
    opacity: 0.7,
  },
  input: {
    flex: 1,
    height: '50px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    fontSize: '0.95rem',
  },
  /* --- TELÉFONO ESTILO CÁPSULA --- */
  phoneContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    border: '1px solid transparent',
    overflow: 'hidden',
  },
  countryInput: {
    width: '60px',
    height: '50px',
    background: 'transparent', // Fondo ligeramente más oscuro
    border: 'none',
    color: theme.accent, // El código destaca en color
    fontWeight: 'bold',
    textAlign: 'center',
    outline: 'none',
    fontSize: '0.95rem',
  },
  verticalDivider: {
    width: '1px',
    height: '20px',
    background: 'rgba(255,255,255,0.2)',
  },
  phoneInput: {
    flex: 1,
    height: '50px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    paddingLeft: '15px',
    outline: 'none',
    fontSize: '0.95rem',
  },
  /* --- BOTÓN Y EXTRAS --- */
  button: {
    marginTop: '10px',
    height: '50px',
    borderRadius: '12px',
    border: 'none',
    background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}dd)`, // Degradado sutil
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 'bold',
    letterSpacing: '1px',
    cursor: 'pointer',
    boxShadow: `0 4px 15px ${theme.accent}66`, // Sombra brillante del color acento
    transition: 'transform 0.2s',
  },
  error: {
    background: '#ff475722',
    color: '#ff6b81',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#fff',
  },
  link: {
    color: theme.accent,
    fontWeight: 'bold',
    textDecoration: 'none',
    marginLeft: '5px',
  },
}
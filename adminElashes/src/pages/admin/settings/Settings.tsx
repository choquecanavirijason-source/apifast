import React, { useRef } from 'react'
import { applyTheme, themes } from '../../../theme'
import { theme as defaultColors } from '../../../styles/colors'
import { useLogo } from '../../../core/hooks/useLogo'
import useAuth from '../../../core/hooks/useAuth'
import { ImagePlus, Trash2, CheckCircle2 } from 'lucide-react'
import { SectionCard } from '../../../components/common/ui'

const THEME_LABELS: Record<string, string> = { light: 'Claro', ocean: 'Océano', dark: 'Oscuro' }
const THEME_SWATCH: Record<string, string> = { light: 'bg-[#f4f8f6]', ocean: 'bg-[#dcfce7]', dark: 'bg-[#021a12]' }
const BTN_PRIMARY =
  'inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'
const BTN_SECONDARY =
  'inline-flex h-8 items-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-xs font-medium text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)]'

// Fuera del componente: si se definiera adentro, se recrearía en cada tecla y el campo perdería el foco.
const isHex = (v: string) => /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(v)
const normalizeHex = (v: string) => {
  if (!v) return ''
  let s = v.trim()
  if (!s.startsWith('#')) s = '#' + s
  // expand #abc -> #aabbcc
  if (/^#([0-9A-F]{3})$/i.test(s)) {
    const m = s.slice(1)
    s = '#' + m.split('').map(c => c + c).join('')
  }
  return s
}

const HexRow = ({ label, displayLabel, value, onChange, fallback }: { label: string; displayLabel: string; value: string; onChange: (v: string) => void; fallback: string }) => {
  const kebab = label.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  const cssVar = `--${kebab}`
  const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar)?.trim()
  const current = value || computed || fallback
  const normalized = normalizeHex(value || current)
  const valid = isHex(normalized)

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--ui-text-muted)]">{displayLabel}</span>
      <div className="flex items-center gap-2">
        <span
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-[var(--ui-border-strong)]"
          style={{ background: valid ? normalized : 'transparent' }}
        >
          {/* Selector nativo invisible encima de la muestra */}
          <input
            type="color"
            value={valid ? normalized : '#ffffff'}
            onChange={e => onChange(normalizeHex(e.target.value))}
            aria-label={`Elegir ${displayLabel}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <input
          type="text"
          placeholder="#rrggbb"
          value={value || normalized}
          onChange={e => onChange(e.target.value)}
          className={`h-8 w-full min-w-0 rounded-lg border bg-[var(--ui-input)] px-2.5 font-mono text-xs uppercase text-[var(--ui-text)] outline-none transition focus:ring-2 ${
            valid ? 'border-[var(--ui-border-strong)] focus:border-brand-secondary focus:ring-brand-secondary/20' : 'border-rose-300 focus:ring-rose-200'
          }`}
        />
      </div>
      {!valid && <span className="text-[11px] text-rose-600">Código de color inválido</span>}
    </label>
  )
}


export default function Settings() {
  const { hasRole } = useAuth()
  const isSuperAdmin = hasRole('SuperAdmin')
  const [theme, setTheme] = React.useState<string>(() => localStorage.getItem('ui:theme') || 'light')
  const [primary, setPrimary] = React.useState<string>(() => localStorage.getItem('ui:primary') || '')
  const [secondary, setSecondary] = React.useState<string>(() => localStorage.getItem('ui:secondary') || '')
  const [accent, setAccent] = React.useState<string>(() => localStorage.getItem('ui:accent') || '')
  const [bg, setBg] = React.useState<string>(() => localStorage.getItem('ui:bg') || '')
  const [text, setText] = React.useState<string>(() => localStorage.getItem('ui:text') || '')

  // Mobile app colors
  const [primaryMobile, setPrimaryMobile] = React.useState<string>(() => localStorage.getItem('ui:primaryMobile') || '')
  const [secondaryMobile, setSecondaryMobile] = React.useState<string>(() => localStorage.getItem('ui:secondaryMobile') || '')
  const [accentMobile, setAccentMobile] = React.useState<string>(() => localStorage.getItem('ui:accentMobile') || '')
  const [bgMobile, setBgMobile] = React.useState<string>(() => localStorage.getItem('ui:bgMobile') || '')
  const [textMobile, setTextMobile] = React.useState<string>(() => localStorage.getItem('ui:textMobile') || '')

  // Logo
  const { logoBase64, logoName, saveLogo, removeLogo } = useLogo()
  const [logoError, setLogoError] = React.useState<string | null>(null)
  const [logoSuccess, setLogoSuccess] = React.useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = React.useState(false)
  const [pendingLogoFile, setPendingLogoFile] = React.useState<File | null>(null)
  const [pendingLogoPreview, setPendingLogoPreview] = React.useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Helper for validating hex codes and normalizing
  const handleApplyCustom = () => {
    const root = document.documentElement
    if (primary) { const v = normalizeHex(primary); if (isHex(v)) root.style.setProperty('--primary', v) }
    if (secondary) { const v = normalizeHex(secondary); if (isHex(v)) root.style.setProperty('--secondary', v) }
    if (accent) { const v = normalizeHex(accent); if (isHex(v)) root.style.setProperty('--accent', v) }
    if (bg) { const v = normalizeHex(bg); if (isHex(v)) root.style.setProperty('--bg', v) }
    if (text) { const v = normalizeHex(text); if (isHex(v)) root.style.setProperty('--text', v) }
    localStorage.setItem('ui:primary', normalizeHex(primary))
    localStorage.setItem('ui:secondary', normalizeHex(secondary))
    localStorage.setItem('ui:accent', normalizeHex(accent))
    localStorage.setItem('ui:bg', normalizeHex(bg))
    localStorage.setItem('ui:text', normalizeHex(text))
  }

  const handleSelectTheme = (name: string) => {
    setTheme(name)
    localStorage.setItem('ui:theme', name)
  }

  // ── Logo handlers ──────────────────────────────────────────────────────────
  // Revoca la URL de preview anterior para no filtrar memoria.
  React.useEffect(() => {
    return () => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
    }
  }, [pendingLogoPreview])

  /** Solo valida y guarda el archivo en memoria; el guardado real ocurre al presionar "Guardar logo". */
  const handleLogoFile = (file: File) => {
    setLogoError(null)
    setLogoSuccess(false)

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Solo se admiten archivos de imagen (PNG, JPG, WebP).')
      return
    }
    if (file.size > 500 * 1024) {
      setLogoError('El archivo no puede superar 500 KB. Comprime la imagen antes de subirla.')
      return
    }

    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
    setPendingLogoFile(file)
    setPendingLogoPreview(URL.createObjectURL(file))
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleLogoFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoFile(file)
  }

  const handleCancelPendingLogo = () => {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
    setPendingLogoFile(null)
    setPendingLogoPreview(null)
    setLogoError(null)
  }

  /** Sube al backend el archivo seleccionado (solo se llama al presionar "Guardar logo"). */
  const handleConfirmSaveLogo = async () => {
    if (!pendingLogoFile) return
    setLogoError(null)
    setIsUploadingLogo(true)
    try {
      await saveLogo(pendingLogoFile)
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
      setPendingLogoFile(null)
      setPendingLogoPreview(null)
      setLogoSuccess(true)
      setTimeout(() => setLogoSuccess(false), 3000)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setLogoError(detail || (err instanceof Error ? err.message : 'No se pudo guardar el logo.'))
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleRemoveLogo = async () => {
    setLogoError(null)
    setIsRemovingLogo(true)
    try {
      await removeLogo()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setLogoError(detail || (err instanceof Error ? err.message : 'No se pudo quitar el logo.'))
    } finally {
      setIsRemovingLogo(false)
    }
  }

  return (
    <div>
      <h2 className="page-title">Ajustes</h2>

      {/* ── LOGO — solo SuperAdmin ──────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Logo de la aplicación</h3>
          <p style={{ color: 'var(--ui-text-muted)', fontSize: 13, marginBottom: 16 }}>
            Este logo aparece en el menú lateral y en los comprobantes de pago PDF para todos los usuarios. Formato recomendado: PNG con fondo transparente. Máx. 500 KB.
          </p>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* Preview del logo actual */}
            <div style={{
              width: 200, height: 130,
              border: '2px dashed var(--ui-border-strong)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--ui-surface-muted)',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {pendingLogoPreview || logoBase64 ? (
                <img
                  src={pendingLogoPreview ?? logoBase64 ?? undefined}
                  alt={pendingLogoPreview ? 'Logo seleccionado (sin guardar)' : 'Logo actual'}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 8 }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--ui-text-muted)' }}>
                  <ImagePlus style={{ width: 28, height: 28, margin: '0 auto 4px' }} />
                  <span style={{ fontSize: 11 }}>Sin logo</span>
                </div>
              )}
            </div>

            {/* Zona de subida */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--ui-border-strong)',
                  borderRadius: 10,
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--ui-surface-muted)',
                  transition: 'border-color .15s, background .15s',
                  marginBottom: 10,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#6ee7b7'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--ui-surface-hover)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ui-border-strong)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--ui-surface-muted)'
                }}
              >
                <ImagePlus style={{ width: 22, height: 22, margin: '0 auto 6px', color: '#6ee7b7' }} />
                <p style={{ fontSize: 13, color: 'var(--ui-text)', margin: 0 }}>
                  {pendingLogoFile ? (
                    <strong>Cambiar imagen seleccionada</strong>
                  ) : (
                    <><strong>Clic para subir</strong> o arrastra aquí</>
                  )}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 4 }}>PNG, JPG, WebP — máx. 500 KB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileInputChange}
                disabled={isUploadingLogo}
                style={{ display: 'none' }}
              />

              {/* Selección pendiente de guardar */}
              {pendingLogoFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--ui-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pendingLogoFile.name} <em style={{ color: '#d97706' }}>(sin guardar)</em>
                  </span>
                </div>
              )}

              {/* Feedback */}
              {logoError && (
                <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>⚠ {logoError}</p>
              )}
              {logoSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 12, marginBottom: 8 }}>
                  <CheckCircle2 style={{ width: 14, height: 14 }} />
                  <span>Logo guardado correctamente.</span>
                </div>
              )}

              {pendingLogoFile ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => void handleConfirmSaveLogo()}
                    disabled={isUploadingLogo}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #16a34a',
                      background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: isUploadingLogo ? 'default' : 'pointer',
                      opacity: isUploadingLogo ? 0.6 : 1,
                    }}
                  >
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    {isUploadingLogo ? 'Guardando…' : 'Guardar logo'}
                  </button>
                  <button
                    onClick={handleCancelPendingLogo}
                    disabled={isUploadingLogo}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
                      background: 'var(--ui-surface)', color: 'var(--ui-text)', fontSize: 12,
                      cursor: isUploadingLogo ? 'default' : 'pointer',
                      opacity: isUploadingLogo ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                /* Nombre del archivo guardado + botón eliminar */
                logoBase64 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--ui-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {logoName ?? 'logo.png'}
                    </span>
                    <button
                      onClick={() => void handleRemoveLogo()}
                      disabled={isRemovingLogo}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5',
                        background: '#fff1f2', color: '#dc2626', fontSize: 12,
                        cursor: isRemovingLogo ? 'default' : 'pointer',
                        opacity: isRemovingLogo ? 0.6 : 1,
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                      {isRemovingLogo ? 'Quitando…' : 'Quitar logo'}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TEMAS ───────────────────────────────────────────────────────────── */}
      <SectionCard title="Tema" subtitle="Apariencia del panel en este navegador." className="mb-3">
        <div className="flex flex-wrap gap-2">
          {Object.keys(themes).map(key => {
            const active = theme === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectTheme(key)}
                aria-pressed={active}
                className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] font-semibold text-[var(--ui-accent)]'
                    : 'border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]'
                }`}
              >
                <span className={`h-3 w-3 rounded-full border border-black/10 ${THEME_SWATCH[key] ?? 'bg-[var(--ui-surface-muted)]'}`} aria-hidden />
                {THEME_LABELS[key] ?? key}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Colores de la marca (escritorio)"
        subtitle="Colores oficiales de E-Lashes. Son la referencia de la identidad visual; cambiarlos solo afecta a este navegador."
        className="mb-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <HexRow label="Primary" displayLabel="Color principal" value={primary} onChange={setPrimary} fallback={defaultColors.primary} />
          <HexRow label="Secondary" displayLabel="Color secundario" value={secondary} onChange={setSecondary} fallback={defaultColors.secondary} />
          <HexRow label="Accent" displayLabel="Color de acento" value={accent} onChange={setAccent} fallback={defaultColors.accent} />
          <HexRow label="Bg" displayLabel="Fondo" value={bg} onChange={setBg} fallback={defaultColors.bg} />
          <HexRow label="Text" displayLabel="Texto" value={text} onChange={setText} fallback={defaultColors.text} />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
          <button type="button" onClick={handleApplyCustom} className={BTN_PRIMARY} disabled={!(isHex(normalizeHex(primary || defaultColors.primary)) && isHex(normalizeHex(secondary || defaultColors.secondary)) && isHex(normalizeHex(accent || defaultColors.accent)) && isHex(normalizeHex(bg || defaultColors.bg)) && isHex(normalizeHex(text || defaultColors.text)))}>Aplicar</button>
          <button type="button" onClick={() => {
            setPrimary(''); setSecondary(''); setAccent(''); setBg(''); setText('')
            localStorage.removeItem('ui:primary'); localStorage.removeItem('ui:secondary'); localStorage.removeItem('ui:accent'); localStorage.removeItem('ui:bg'); localStorage.removeItem('ui:text')
            applyTheme(theme);
          }} className={BTN_SECONDARY}>Restablecer</button>
        </div>
      </SectionCard>

      <SectionCard
        title="Colores para aplicaciones móviles"
        subtitle="Referencia de colores para la app móvil. Por ahora se guardan solo en este navegador."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <HexRow label="PrimaryMobile" displayLabel="Color principal" value={primaryMobile} onChange={setPrimaryMobile} fallback={defaultColors.primary} />
          <HexRow label="SecondaryMobile" displayLabel="Color secundario" value={secondaryMobile} onChange={setSecondaryMobile} fallback={defaultColors.secondary} />
          <HexRow label="AccentMobile" displayLabel="Color de acento" value={accentMobile} onChange={setAccentMobile} fallback={defaultColors.accent} />
          <HexRow label="BgMobile" displayLabel="Fondo" value={bgMobile} onChange={setBgMobile} fallback={defaultColors.bg} />
          <HexRow label="TextMobile" displayLabel="Texto" value={textMobile} onChange={setTextMobile} fallback={defaultColors.text} />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
          <button type="button" onClick={() => {
            const root = document.documentElement
            const p = normalizeHex(primaryMobile)
            const s = normalizeHex(secondaryMobile)
            const a = normalizeHex(accentMobile)
            const b = normalizeHex(bgMobile)
            const t = normalizeHex(textMobile)
            if (isHex(p)) root.style.setProperty('--primary-mobile', p)
            if (isHex(s)) root.style.setProperty('--secondary-mobile', s)
            if (isHex(a)) root.style.setProperty('--accent-mobile', a)
            if (isHex(b)) root.style.setProperty('--bg-mobile', b)
            if (isHex(t)) root.style.setProperty('--text-mobile', t)
            localStorage.setItem('ui:primaryMobile', p)
            localStorage.setItem('ui:secondaryMobile', s)
            localStorage.setItem('ui:accentMobile', a)
            localStorage.setItem('ui:bgMobile', b)
            localStorage.setItem('ui:textMobile', t)
          }} className={BTN_PRIMARY} disabled={!(isHex(normalizeHex(primaryMobile || defaultColors.primary)) && isHex(normalizeHex(secondaryMobile || defaultColors.secondary)) && isHex(normalizeHex(accentMobile || defaultColors.accent)) && isHex(normalizeHex(bgMobile || defaultColors.bg)) && isHex(normalizeHex(textMobile || defaultColors.text)))}>Aplicar</button>
          <button type="button" onClick={() => {
            setPrimaryMobile(''); setSecondaryMobile(''); setAccentMobile(''); setBgMobile(''); setTextMobile('')
            localStorage.removeItem('ui:primaryMobile'); localStorage.removeItem('ui:secondaryMobile'); localStorage.removeItem('ui:accentMobile'); localStorage.removeItem('ui:bgMobile'); localStorage.removeItem('ui:textMobile')
          }} className={BTN_SECONDARY}>Restablecer</button>
        </div>
      </SectionCard>
    </div>
  )
}

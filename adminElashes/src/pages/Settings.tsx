import React from 'react'
import { applyTheme, themes } from '../theme'
import { theme as defaultColors } from '../styles/colors'

export default function Settings(){
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

  React.useEffect(()=>{
    applyTheme(theme)
  },[theme])

  // Helper for validating hex codes and normalizing
  const isHex = (v:string) => /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(v)
  const normalizeHex = (v:string) => {
    if(!v) return ''
    let s = v.trim()
    if(!s.startsWith('#')) s = '#'+s
    // expand #abc -> #aabbcc
    if(/^#([0-9A-F]{3})$/i.test(s)){
      const m = s.slice(1)
      s = '#'+m.split('').map(c=>c+c).join('')
    }
    return s
  }

  const HexRow = ({label, value, onChange, fallback}:{label:string,value:string,onChange:(v:string)=>void,fallback:string}) => {
    // build css var name from label (kebab-case)
    const kebab = label.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    const cssVar = `--${kebab}`
    const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar)?.trim()
    const current = value || computed || fallback
    const normalized = normalizeHex(value || current)
    const valid = isHex(normalized)

    return (
      <label style={{display:'flex',flexDirection:'column',gap:6,minWidth:180}}>
        {label.replace(/([a-z])([A-Z])/g, '$1 $2')}
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input type="color" value={normalized || '#ffffff'} onChange={e=>onChange(normalizeHex(e.target.value))} />
          <input type="text" placeholder="#rrggbb" value={value || normalized} onChange={e=>onChange(e.target.value)} style={{padding:'6px 8px',borderRadius:8,border: valid? '1px solid #e6eef2':'1px solid #f5c6cb',minWidth:110}} />
          <div style={{width:28,height:28,borderRadius:6,background: valid? normalized : '#fff',border:'1px solid rgba(0,0,0,0.06)'}} />
          {!valid && <span style={{color:'crimson',fontSize:12}}>Invalid hex</span>}
        </div>
      </label>
    )
  }

  const handleApplyCustom = ()=>{
    // apply custom colors by setting CSS variables
    const root = document.documentElement
    if(primary){ const v=normalizeHex(primary); if(isHex(v)) root.style.setProperty('--primary', v) }
    if(secondary){ const v=normalizeHex(secondary); if(isHex(v)) root.style.setProperty('--secondary', v) }
    if(accent){ const v=normalizeHex(accent); if(isHex(v)) root.style.setProperty('--accent', v) }
    if(bg){ const v=normalizeHex(bg); if(isHex(v)) root.style.setProperty('--bg', v) }
    if(text){ const v=normalizeHex(text); if(isHex(v)) root.style.setProperty('--text', v) }
    // persist
    localStorage.setItem('ui:primary', normalizeHex(primary))
    localStorage.setItem('ui:secondary', normalizeHex(secondary))
    localStorage.setItem('ui:accent', normalizeHex(accent))
    localStorage.setItem('ui:bg', normalizeHex(bg))
    localStorage.setItem('ui:text', normalizeHex(text))
  }

  const handleSelectTheme = (name:string)=>{
    setTheme(name)
    localStorage.setItem('ui:theme', name)
    // clear any custom stored colors (optional)
    // localStorage.removeItem('ui:primary')
    // localStorage.removeItem('ui:secondary')
  }

  return (
    <div>
      <h2 className="page-title">Ajustes</h2>

      <div className="card" style={{marginBottom:16}}>
        <h3 style={{marginTop:0}}>Temas</h3>
        <div style={{display:'flex',gap:12,marginTop:12}}>
          {Object.keys(themes).map(key => (
            <button
              key={key}
              onClick={() => handleSelectTheme(key)}
              style={{padding:'10px 14px',borderRadius:10,border: theme===key? '2px solid var(--accent)':'1px solid #e6eef2',background:'#fff',cursor:'pointer'}}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>Colores personalizados (Escritorio)</h3>
        <div style={{display:'flex',gap:12,alignItems:'flex-start',marginTop:12,flexWrap:'wrap'}}>
          <HexRow label="Primary" value={primary} onChange={setPrimary} fallback={defaultColors.primary} />
          <HexRow label="Secondary" value={secondary} onChange={setSecondary} fallback={defaultColors.secondary} />
          <HexRow label="Accent" value={accent} onChange={setAccent} fallback={defaultColors.accent} />
          <HexRow label="Bg" value={bg} onChange={setBg} fallback={defaultColors.bg} />
          <HexRow label="Text" value={text} onChange={setText} fallback={defaultColors.text} />

          <div style={{display:'flex',gap:8,alignItems:'center',width:'100%',marginTop:8}}>
            <button onClick={handleApplyCustom} className="card" style={{padding:'8px 12px',cursor:'pointer'}} disabled={!(isHex(normalizeHex(primary||defaultColors.primary)) && isHex(normalizeHex(secondary||defaultColors.secondary)) && isHex(normalizeHex(accent||defaultColors.accent)) && isHex(normalizeHex(bg||defaultColors.bg)) && isHex(normalizeHex(text||defaultColors.text)))}>Apply</button>
            <button onClick={()=>{
              setPrimary(''); setSecondary(''); setAccent(''); setBg(''); setText('')
              localStorage.removeItem('ui:primary'); localStorage.removeItem('ui:secondary'); localStorage.removeItem('ui:accent'); localStorage.removeItem('ui:bg'); localStorage.removeItem('ui:text')
              applyTheme(theme);
            }} style={{padding:'8px 12px',cursor:'pointer'}}>Reset</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3 style={{marginTop:0}}>Colores para Aplicaciones móviles</h3>
        <div style={{display:'flex',gap:12,alignItems:'flex-start',marginTop:12,flexWrap:'wrap'}}>
          <HexRow label="PrimaryMobile" value={primaryMobile} onChange={setPrimaryMobile} fallback={defaultColors.primary} />
          <HexRow label="SecondaryMobile" value={secondaryMobile} onChange={setSecondaryMobile} fallback={defaultColors.secondary} />
          <HexRow label="AccentMobile" value={accentMobile} onChange={setAccentMobile} fallback={defaultColors.accent} />
          <HexRow label="BgMobile" value={bgMobile} onChange={setBgMobile} fallback={defaultColors.bg} />
          <HexRow label="TextMobile" value={textMobile} onChange={setTextMobile} fallback={defaultColors.text} />

          <div style={{display:'flex',gap:8,alignItems:'center',width:'100%',marginTop:8}}>
            <button onClick={()=>{
              const root = document.documentElement
              const p = normalizeHex(primaryMobile)
              const s = normalizeHex(secondaryMobile)
              const a = normalizeHex(accentMobile)
              const b = normalizeHex(bgMobile)
              const t = normalizeHex(textMobile)
              if(isHex(p)) root.style.setProperty('--primary-mobile', p)
              if(isHex(s)) root.style.setProperty('--secondary-mobile', s)
              if(isHex(a)) root.style.setProperty('--accent-mobile', a)
              if(isHex(b)) root.style.setProperty('--bg-mobile', b)
              if(isHex(t)) root.style.setProperty('--text-mobile', t)
              localStorage.setItem('ui:primaryMobile', p)
              localStorage.setItem('ui:secondaryMobile', s)
              localStorage.setItem('ui:accentMobile', a)
              localStorage.setItem('ui:bgMobile', b)
              localStorage.setItem('ui:textMobile', t)
            }} className="card" style={{padding:'8px 12px',cursor:'pointer'}} disabled={!(isHex(normalizeHex(primaryMobile||defaultColors.primary)) && isHex(normalizeHex(secondaryMobile||defaultColors.secondary)) && isHex(normalizeHex(accentMobile||defaultColors.accent)) && isHex(normalizeHex(bgMobile||defaultColors.bg)) && isHex(normalizeHex(textMobile||defaultColors.text)))}>Apply mobile</button>

            <button onClick={()=>{
              setPrimaryMobile(''); setSecondaryMobile(''); setAccentMobile(''); setBgMobile(''); setTextMobile('')
              localStorage.removeItem('ui:primaryMobile'); localStorage.removeItem('ui:secondaryMobile'); localStorage.removeItem('ui:accentMobile'); localStorage.removeItem('ui:bgMobile'); localStorage.removeItem('ui:textMobile')
            }} style={{padding:'8px 12px',cursor:'pointer'}}>Reset mobile</button>
          </div>
        </div>
      </div>
    </div>
  )
}

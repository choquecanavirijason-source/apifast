export type Theme = {
  name: string
  vars: Record<string,string>
}

const brandVars = {
  '--primary': '#094732',
  '--secondary': '#9F8351',
  '--tertiary': '#000000',
  '--accent': '#9F8351',
  '--brand': '#094732',
  '--brand-secondary': '#9F8351',
  '--brand-tertiary': '#000000',
}

export const themes: Record<string,Theme> = {
  light: {
    name: 'light',
    vars: {
      ...brandVars,
      '--bg': '#f8fafc',
      '--surface': '#ffffff',
      '--muted': '#64748b',
      '--text': '#000000',
      '--ui-canvas': '#f4f8f6',
      '--ui-surface': '#ffffff',
      '--ui-surface-muted': '#f8fafc',
      '--ui-surface-hover': '#f1f5f9',
      '--ui-border': '#e2e8f0',
      '--ui-border-strong': '#cbd5e1',
      '--ui-text': '#1e293b',
      '--ui-text-muted': '#64748b',
      '--ui-input': '#ffffff'
    }
  },
  ocean: {
    name: 'ocean',
    vars: {
      ...brandVars,
      '--bg': '#ecfdf5',
      '--surface': '#ffffff',
      '--muted': '#5b6b73',
      '--text': '#000000',
      '--ui-canvas': '#ecfdf5',
      '--ui-surface': '#ffffff',
      '--ui-surface-muted': '#f0fdf4',
      '--ui-surface-hover': '#dcfce7',
      '--ui-border': '#bbf7d0',
      '--ui-border-strong': '#86efac',
      '--ui-text': '#052e21',
      '--ui-text-muted': '#4b635b',
      '--ui-input': '#ffffff'
    }
  },
  dark: {
    name: 'dark',
    vars: {
      ...brandVars,
      '--bg': '#021a12',
      '--surface': '#042a1c',
      '--muted': '#9aa6b2',
      '--text': '#f8fafc',
      '--ui-canvas': '#021a12',
      '--ui-surface': '#062f23',
      '--ui-surface-muted': '#0a3a2b',
      '--ui-surface-hover': '#0d4734',
      '--ui-border': '#285947',
      '--ui-border-strong': '#4d7667',
      '--ui-text': '#f8fafc',
      '--ui-text-muted': '#b8c8c1',
      '--ui-input': '#08271d'
    }
  }
}

export function applyTheme(themeName: string){
  const theme = themes[themeName]
  if(!theme) return
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k,v])=> root.style.setProperty(k,v))
  root.classList.remove(...Object.keys(themes).map(t=>`theme-${t}`))
  root.classList.add(`theme-${themeName}`)
}

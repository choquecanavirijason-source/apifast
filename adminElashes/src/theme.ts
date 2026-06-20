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
      '--text': '#000000'
    }
  },
  ocean: {
    name: 'ocean',
    vars: {
      ...brandVars,
      '--bg': '#ecfdf5',
      '--surface': '#ffffff',
      '--muted': '#5b6b73',
      '--text': '#000000'
    }
  },
  dark: {
    name: 'dark',
    vars: {
      ...brandVars,
      '--bg': '#021a12',
      '--surface': '#042a1c',
      '--muted': '#9aa6b2',
      '--text': '#ffffff'
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
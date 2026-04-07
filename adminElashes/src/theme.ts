export type Theme = {
  name: string
  vars: Record<string,string>
}

export const themes: Record<string,Theme> = {
  light: {
    name: 'light',
    vars: {
      '--primary': '#0f172a',
      '--secondary': '#0ea5a6',
      '--accent': '#7c3aed',
      '--bg': '#f8fafc',
      '--surface': '#ffffff',
      '--muted': '#64748b',
      '--text': '#0f172a'
    }
  },
  ocean: {
    name: 'ocean',
    vars: {
      '--primary': '#0b2545',
      '--secondary': '#0ea5a6',
      '--accent': '#3dd3c1',
      '--bg': '#eaf8fb',
      '--surface': '#ffffff',
      '--muted': '#5b6b73',
      '--text': '#092235'
    }
  },
  dark: {
    name: 'dark',
    vars: {
      '--primary': '#071126',
      '--secondary': '#1fb6ff',
      '--accent': '#8b5cf6',
      '--bg': '#081023',
      '--surface': '#0f172a',
      '--muted': '#9aa6b2',
      '--text': '#e6eef6'
    }
  }
}

export function applyTheme(themeName: string){
  const theme = themes[themeName]
  if(!theme) return
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k,v])=> root.style.setProperty(k,v))
  // Also add a class for optional theme-specific selectors
  root.classList.remove(...Object.keys(themes).map(t=>`theme-${t}`))
  root.classList.add(`theme-${themeName}`)
}

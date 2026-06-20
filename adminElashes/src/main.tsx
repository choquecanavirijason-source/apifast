import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'react-toastify/dist/ReactToastify.css'
import './styles.css'
import { applyTheme } from './theme'
import { AuthProvider } from './auth/auth'
import { Provider } from 'react-redux'
import {store} from './store'

// apply saved theme and custom colors on startup
const savedTheme = localStorage.getItem('ui:theme')
if(savedTheme) applyTheme(savedTheme)
const savedPrimary = localStorage.getItem('ui:primary')
document.documentElement.style.setProperty('--primary', savedPrimary ?? '#094732')
const savedSecondary = localStorage.getItem('ui:secondary')
document.documentElement.style.setProperty('--secondary', savedSecondary ?? '#9F8351')
document.documentElement.style.setProperty('--tertiary', '#000000')
document.documentElement.style.setProperty('--brand', '#094732')
document.documentElement.style.setProperty('--brand-hover', '#063324')
document.documentElement.style.setProperty('--brand-secondary', '#9F8351')
document.documentElement.style.setProperty('--brand-secondary-hover', '#85754a')
document.documentElement.style.setProperty('--brand-tertiary', '#000000')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
    <AuthProvider>
      <App />
    </AuthProvider>
    </Provider>
  </React.StrictMode>
)

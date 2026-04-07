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
if(savedPrimary) document.documentElement.style.setProperty('--primary', savedPrimary)
const savedSecondary = localStorage.getItem('ui:secondary')
if(savedSecondary) document.documentElement.style.setProperty('--secondary', savedSecondary)

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
    <AuthProvider>
      <App />
    </AuthProvider>
    </Provider>
  </React.StrictMode>
)

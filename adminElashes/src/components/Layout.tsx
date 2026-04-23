
import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from './Header'
import AppSidebar from './AppSidebar'

export default function Layout(){
  const location = useLocation()
  const [collapsed, setCollapsed] = React.useState(true)
  const isPosTrackingFullscreen = location.pathname.startsWith('/admin/pos-tracking')

  // Estado para el botón flotante
  const [pos, setPos] = React.useState({ x: 30, y: 30 })
  const [dragging, setDragging] = React.useState(false)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = React.useState(false)
  const floatBtnRef = React.useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Handlers para arrastrar el botón flotante
  // Mejor UX: solo arrastrar si realmente se mueve, y no disparar click accidental
  const dragState = React.useRef({ moved: false })
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    dragState.current.moved = false
    const rect = floatBtnRef.current?.getBoundingClientRect()
    setOffset({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    })
    e.preventDefault()
  }
  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        setPos(prev => {
          // Limitar dentro de la ventana
          const minX = 0
          const minY = 0
          const maxX = window.innerWidth - 42
          const maxY = window.innerHeight - 42
          let newX = e.clientX - offset.x
          let newY = e.clientY - offset.y
          newX = Math.max(minX, Math.min(newX, maxX))
          newY = Math.max(minY, Math.min(newY, maxY))
          return { x: newX, y: newY }
        })
        dragState.current.moved = true
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      setDragging(false)
    }
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, offset])

  // Click solo si no se arrastró (ahora con onClick para un solo click)
  const handleClick = (e: React.MouseEvent) => {
    if (!dragState.current.moved) {
      navigate('/admin/pos-tracking')
    }
  }

  if (isPosTrackingFullscreen) {
    return <Outlet />
  }

  return (
    <div className="app-layout">
      <AppSidebar collapsed={collapsed} />
      <div className="content">
        <Header setCollapsed={setCollapsed} collapsed={collapsed} />
        <main className="main"><Outlet /></main>
        {/* Botón flotante movible */}
        <div
          ref={floatBtnRef}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 1000,
            cursor: dragging ? 'grabbing' : 'pointer',
            transition: dragging ? 'none' : 'box-shadow 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            borderRadius: '50%',
            background: '#2563eb',
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            userSelect: 'none',
          }}
          onMouseDown={onMouseDown}
          onClick={handleClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Icono de caja/trabajo */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2" ry="2"></rect>
            <path d="M16 3v4M8 3v4M3 11h18"></path>
          </svg>
          {/* Tooltip */}
          {showTooltip && (
            <div
              style={{
                position: 'absolute',
                left: 50,
                top: 0,
                background: '#222',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              Ir a POS Tracking
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

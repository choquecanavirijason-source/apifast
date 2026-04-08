import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import AppSidebar from './AppSidebar'

export default function Layout(){
  const location = useLocation()
  const [collapsed, setCollapsed] = React.useState(true)
  const isPosTrackingFullscreen = location.pathname.startsWith('/admin/pos-tracking')

  if (isPosTrackingFullscreen) {
    return <Outlet />
  }

  return (
    <div className="app-layout">
      <AppSidebar collapsed={collapsed} />
      <div className="content">
        <Header setCollapsed={setCollapsed} collapsed={collapsed} />
        <main className="main"><Outlet /></main>
      </div>
    </div>
  )
}

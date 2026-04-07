import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import AppSidebar from './AppSidebar'

export default function Layout(){
  const [collapsed, setCollapsed] = React.useState(false)

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

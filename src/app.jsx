import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/navigation'
import Dashboard from './components/dashboard'
import Campaigns from './components/campaigns'
import Subscribers from './components/subscribers'
import Settings from './components/settings'
import { WhopProvider } from './context/WhopContext'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeWhop()
  }, [])

  const initializeWhop = async () => {
    try {
      if (window.Whop) {
        const whop = await window.Whop.init()
        const userData = await whop.me()
        const planData = await whop.plan()
        
        setUser({
          id: userData.id,
          email: userData.email,
          username: userData.username,
          plan: planData,
          whopInstance: whop,
          hasAccess: true
        })
      } else {
        // Development fallback
        setUser({
          id: 'demo_user',
          email: 'demo@ledge.marketing',
          username: 'Demo User',
          plan: { name: 'Growth Plan', id: 'growth' },
          hasAccess: true,
          isDemo: true
        })
      }
    } catch (error) {
      console.error('Whop initialization error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading Ledge Marketing...</div>
      </div>
    )
  }

  return (
    <WhopProvider value={user}>
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/subscribers" element={<Subscribers />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </WhopProvider>
  )
}

export default App
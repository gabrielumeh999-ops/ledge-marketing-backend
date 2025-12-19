import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWhop } from '../context/WhopContext'

const Navigation = () => {
  const location = useLocation()
  const user = useWhop()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/campaigns', label: 'Campaigns' },
    { path: '/subscribers', label: 'Subscribers' },
    { path: '/settings', label: 'Settings' }
  ]

  return (
    <nav style={{ 
      background: '#0D2818', 
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 'bold' }}>
          Ledge Marketing
        </Link>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                color: location.pathname === item.path ? '#A7F3D0' : 'white',
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                background: location.pathname === item.path ? 'rgba(167, 243, 208, 0.1)' : 'transparent'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'white' }}>
        <span style={{ 
          background: 'rgba(167, 243, 208, 0.2)', 
          padding: '0.25rem 0.75rem', 
          borderRadius: '12px',
          fontSize: '0.875rem'
        }}>
          {user.plan?.name || 'Free Plan'}
        </span>
        <span>{user.email || user.username}</span>
      </div>
    </nav>
  )
}

export default Navigation
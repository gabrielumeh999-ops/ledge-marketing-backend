import React, { useState } from 'react'
import { useWhop } from '../context/WhopContext'
import { userAPI } from '../services/api'

const Settings = () => {
  const user = useWhop()
  const [form, setForm] = useState({
    email: user.email || '',
    name: user.username || ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    
    try {
      const response = await userAPI.update({
        whopUserId: user.id,
        name: form.name
      })
      
      if (response.data.success) {
        setMessage('Profile updated successfully')
      }
    } catch (error) {
      setMessage('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Settings</h1>
      
      {message && (
        <div style={{ margin: '1rem 0', padding: '0.5rem', background: '#d4edda', borderRadius: '4px' }}>
          {message}
        </div>
      )}
      
      <div style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Account Email</label>
          <input
            type="email"
            disabled
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              background: '#f5f5f5',
              cursor: 'not-allowed',
              color: '#666'
            }}
            value={form.email}
          />
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666', fontSize: '0.875rem' }}>
            Managed by Whop - cannot be changed
          </small>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Display Name / Business Name</label>
          <input
            type="text"
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            placeholder="John's Marketing Agency"
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Current Plan</label>
          <input
            type="text"
            disabled
            style={{ width: '100%', padding: '0.5rem', background: '#f5f5f5' }}
            value={user.plan?.name || 'Free Plan'}
          />
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ 
            background: '#28a745', 
            color: 'white', 
            padding: '0.75rem 1.5rem', 
            border: 'none', 
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default Settings

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
        email: form.email,
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
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
          <input
            type="email"
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Display Name</label>
          <input
            type="text"
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
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
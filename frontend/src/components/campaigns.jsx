import React, { useState } from 'react'
import { useWhop } from '../context/WhopContext'
import { campaignAPI } from '../services/api'

const Campaigns = () => {
  const user = useWhop()
  const [form, setForm] = useState({
    campaignName: '',
    subject: '',
    html: '<h1>Hello!</h1><p>Your email content here.</p>',
    recipients: '',
    type: 'marketing'
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const recipients = form.recipients.split(',').map(email => email.trim()).filter(email => email)
      
      const response = await campaignAPI.send({
        whopUserId: user.id,
        campaignName: form.campaignName,
        subject: form.subject,
        html: form.html,
        to: recipients,
        type: form.type
      })

      if (response.data.success) {
        setResult({ success: true, message: response.data.message })
        setForm({
          campaignName: '',
          subject: '',
          html: '<h1>Hello!</h1><p>Your email content here.</p>',
          recipients: '',
          type: 'marketing'
        })
      } else {
        setResult({ success: false, message: response.data.message })
      }
    } catch (error) {
      setResult({ success: false, message: error.response?.data?.message || 'Failed to send campaign' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Create Email Campaign</h1>
      
      {result && (
        <div style={{ 
          padding: '1rem', 
          margin: '1rem 0', 
          background: result.success ? '#d4edda' : '#f8d7da',
          borderRadius: '4px'
        }}>
          {result.message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Campaign Name</label>
          <input
            type="text"
            required
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.campaignName}
            onChange={(e) => setForm({...form, campaignName: e.target.value})}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Subject</label>
          <input
            type="text"
            required
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.subject}
            onChange={(e) => setForm({...form, subject: e.target.value})}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email Type</label>
          <select
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.type}
            onChange={(e) => setForm({...form, type: e.target.value})}
          >
            <option value="marketing">Marketing</option>
            <option value="transactional">Transactional</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email Content (HTML)</label>
          <textarea
            required
            rows="8"
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
            value={form.html}
            onChange={(e) => setForm({...form, html: e.target.value})}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Recipients (comma-separated emails)</label>
          <textarea
            required
            rows="3"
            style={{ width: '100%', padding: '0.5rem' }}
            value={form.recipients}
            onChange={(e) => setForm({...form, recipients: e.target.value})}
            placeholder="email1@example.com, email2@example.com"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{ 
            background: '#007bff', 
            color: 'white', 
            padding: '0.75rem 1.5rem', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Send Campaign'}
        </button>
      </form>
    </div>
  )
}

export default Campaigns
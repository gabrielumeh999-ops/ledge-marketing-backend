import React, { useState, useEffect } from 'react'
import { useWhop } from '../context/WhopContext'
import { campaignAPI, subscriberAPI } from '../services/api'

const Campaigns = () => {
  const user = useWhop()
  const [form, setForm] = useState({
    campaignName: '',
    subject: '',
    html: '<h1>Hello!</h1><p>Your email content here.</p>',
    recipients: '',
    recipientType: 'all',
    selectedEmails: [],
    type: 'marketing'
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [subscribers, setSubscribers] = useState([])
  const [subscriberCounts, setSubscriberCounts] = useState({ all: 0, vip: 0 })
  const [loadingSubscribers, setLoadingSubscribers] = useState(false)

  useEffect(() => {
    loadSubscribers()
  }, [user.id])

  const loadSubscribers = async () => {
    try {
      setLoadingSubscribers(true)
      const response = await subscriberAPI.getAll(user.id)
      
      if (response.data.success) {
        const subs = response.data.subscribers
        setSubscribers(subs)
        
        // Calculate counts
        const allCount = subs.filter(s => s.status === 'active').length
        const vipCount = subs.filter(s => s.status === 'active' && s.is_vip === true).length
        
        setSubscriberCounts({ all: allCount, vip: vipCount })
      }
    } catch (error) {
      console.error('Error loading subscribers:', error)
    } finally {
      setLoadingSubscribers(false)
    }
  }

  const getRecipientCount = () => {
    if (form.recipientType === 'all') return subscriberCounts.all
    if (form.recipientType === 'vip') return subscriberCounts.vip
    if (form.recipientType === 'custom') return form.selectedEmails.length
    return 0
  }

  const handleEmailSelection = (email, isChecked) => {
    if (isChecked) {
      setForm({...form, selectedEmails: [...form.selectedEmails, email]})
    } else {
      setForm({...form, selectedEmails: form.selectedEmails.filter(e => e !== email)})
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      let requestData = {
        whopUserId: user.id,
        campaignName: form.campaignName,
        subject: form.subject,
        html: form.html,
        type: form.type,
        recipientType: form.recipientType
      }

      // Add appropriate recipients based on type
      if (form.recipientType === 'custom') {
        if (form.selectedEmails.length === 0) {
          alert('Please select at least one recipient')
          setLoading(false)
          return
        }
        requestData.customEmails = form.selectedEmails
      }
      
      const response = await campaignAPI.send(requestData)

      if (response.data.success) {
        setResult({ success: true, message: response.data.message })
        setForm({
          campaignName: '',
          subject: '',
          html: '<h1>Hello!</h1><p>Your email content here.</p>',
          recipients: '',
          recipientType: 'all',
          selectedEmails: [],
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
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Recipients</label>
          
          {/* Recipient Type Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="recipientType"
                value="all"
                checked={form.recipientType === 'all'}
                onChange={(e) => setForm({...form, recipientType: e.target.value, selectedEmails: []})}
                style={{ marginRight: '0.75rem' }}
              />
              <div style={{ flex: 1 }}>
                <strong>All Active Subscribers</strong>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Send to all {subscriberCounts.all} active contacts
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', background: '#fff3cd', borderRadius: '4px', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="recipientType"
                value="vip"
                checked={form.recipientType === 'vip'}
                onChange={(e) => setForm({...form, recipientType: e.target.value, selectedEmails: []})}
                style={{ marginRight: '0.75rem' }}
              />
              <div style={{ flex: 1 }}>
                <strong>⭐ VIP Subscribers Only</strong>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Send to {subscriberCounts.vip} VIP contacts only
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="recipientType"
                value="custom"
                checked={form.recipientType === 'custom'}
                onChange={(e) => setForm({...form, recipientType: e.target.value})}
                style={{ marginRight: '0.75rem' }}
              />
              <div style={{ flex: 1 }}>
                <strong>Custom Selection</strong>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Choose specific contacts ({form.selectedEmails.length} selected)
                </div>
              </div>
            </label>
          </div>

          {/* Custom Selection Checkbox List */}
          {form.recipientType === 'custom' && (
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '1rem',
              background: 'white'
            }}>
              {loadingSubscribers ? (
                <p style={{ textAlign: 'center', color: '#666' }}>Loading contacts...</p>
              ) : subscribers.filter(s => s.status === 'active').length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666' }}>No active subscribers found</p>
              ) : (
                subscribers.filter(s => s.status === 'active').map(sub => (
                  <label key={sub.id} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
                    <input
                      type="checkbox"
                      checked={form.selectedEmails.includes(sub.email)}
                      onChange={(e) => handleEmailSelection(sub.email, e.target.checked)}
                      style={{ marginRight: '0.75rem' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>
                        {sub.name || 'N/A'} {sub.is_vip && '⭐'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>{sub.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}

          {/* Recipient Count Summary */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#e7f3ff', 
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            <strong>📧 Will send to: {getRecipientCount()} recipient(s)</strong>
          </div>
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

import React, { useState, useEffect } from 'react'
import { useWhop } from '../context/WhopContext'
import { campaignAPI, subscriberAPI, userAPI } from '../services/api'

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
  
  // ✅ NEW: Email counter state
  const [usage, setUsage] = useState(null)
  const [loadingUsage, setLoadingUsage] = useState(true)

  useEffect(() => {
    loadSubscribers()
    loadUsageData()
  }, [user.id])

  // ✅ NEW: Load usage data for email counter
  const loadUsageData = async () => {
    try {
      setLoadingUsage(true)
      const response = await userAPI.verify(user.id)
      
      if (response.data.success) {
        setUsage(response.data.user)
      }
    } catch (error) {
      console.error('Error loading usage data:', error)
    } finally {
      setLoadingUsage(false)
    }
  }

  const loadSubscribers = async () => {
    try {
      setLoadingSubscribers(true)
      const response = await subscriberAPI.getAll(user.id)
      
      if (response.data.success) {
        const subs = response.data.subscribers
        setSubscribers(subs)
        
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
        
        // ✅ Reload usage data after successful send
        loadUsageData()
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
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Create Email Campaign</h1>
      
      {/* ✅ NEW: EMAIL COUNTER WIDGET */}
      {usage && !loadingUsage && (
        <div style={{ 
          background: 'linear-gradient(135deg, #0D2818 0%, #1a3828 100%)',
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1.5rem',
          marginBottom: '2rem',
          border: '2px solid #2D4A3A'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#A7F3D0', fontSize: '1.25rem' }}>
              📧 Email Sends Remaining
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#9CA3AF', fontSize: '0.875rem' }}>
              {usage.planName} • {form.type === 'marketing' ? 'Marketing' : 'Transactional'} Emails
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Daily Counter */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#9CA3AF' }}>
                <span>Daily Remaining</span>
                <span>{form.type === 'marketing' ? usage.daily_marketing_sent : usage.daily_transactional_sent} / {form.type === 'marketing' ? usage.marketing_limit_daily : usage.transactional_limit_daily}</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: '#1a3828', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${((form.type === 'marketing' ? usage.daily_marketing_sent : usage.daily_transactional_sent) / (form.type === 'marketing' ? usage.marketing_limit_daily : usage.transactional_limit_daily)) * 100}%`, 
                  height: '100%', 
                  background: (form.type === 'marketing' ? usage.daily_marketing_remaining : usage.daily_transactional_remaining) <= 2 ? '#EF4444' : '#A7F3D0',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#A7F3D0', marginTop: '0.75rem' }}>
                {form.type === 'marketing' ? usage.daily_marketing_remaining : usage.daily_transactional_remaining}
              </div>
            </div>
            
            <div style={{ width: '2px', height: '60px', background: '#2D4A3A' }}></div>
            
            {/* Monthly Counter */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#9CA3AF' }}>
                <span>Monthly Remaining</span>
                <span>{form.type === 'marketing' ? usage.monthly_marketing_sent : usage.monthly_transactional_sent} / {form.type === 'marketing' ? usage.marketing_limit_monthly : usage.transactional_limit_monthly}</span>
              </div>
              <div style={{ width: '100%', height: '10px', background: '#1a3828', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${((form.type === 'marketing' ? usage.monthly_marketing_sent : usage.monthly_transactional_sent) / (form.type === 'marketing' ? usage.marketing_limit_monthly : usage.transactional_limit_monthly)) * 100}%`, 
                  height: '100%', 
                  background: (form.type === 'marketing' ? usage.monthly_marketing_remaining : usage.monthly_transactional_remaining) <= 50 ? '#F59E0B' : '#A7F3D0',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#A7F3D0', marginTop: '0.75rem' }}>
                {form.type === 'marketing' ? usage.monthly_marketing_remaining : usage.monthly_transactional_remaining}
              </div>
            </div>
          </div>

          {/* Warning Messages */}
          {((form.type === 'marketing' && (usage.daily_marketing_remaining <= 2 || usage.monthly_marketing_remaining <= 50)) ||
            (form.type === 'transactional' && (usage.daily_transactional_remaining <= 2 || usage.monthly_transactional_remaining <= 50))) && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#FCA5A5',
              fontSize: '0.875rem'
            }}>
              ⚠️ {(form.type === 'marketing' ? usage.daily_marketing_remaining : usage.daily_transactional_remaining) <= 2 
                ? 'Daily limit almost reached!' 
                : 'Monthly limit running low!'} Consider upgrading your plan.
            </div>
          )}
        </div>
      )}
      
      {result && (
        <div style={{ 
          padding: '1rem', 
          margin: '1rem 0', 
          background: result.success ? '#d4edda' : '#f8d7da',
          borderRadius: '4px',
          color: result.success ? '#155724' : '#721c24'
        }}>
          {result.message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Email Type</label>
          <select
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            value={form.type}
            onChange={(e) => setForm({...form, type: e.target.value})}
          >
            <option value="marketing">Marketing</option>
            {usage && usage.transactional_enabled && (
              <option value="transactional">Transactional</option>
            )}
          </select>
          {!usage?.transactional_enabled && (
            <small style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
              Transactional emails available on Starter plan and above
            </small>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Campaign Name</label>
          <input
            type="text"
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            value={form.campaignName}
            onChange={(e) => setForm({...form, campaignName: e.target.value})}
            placeholder="e.g., Newsletter #5"
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Subject</label>
          <input
            type="text"
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            value={form.subject}
            onChange={(e) => setForm({...form, subject: e.target.value})}
            placeholder="Your email subject line"
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Email Content (HTML)</label>
          <textarea
            required
            rows="8"
            style={{ width: '100%', padding: '0.75rem', fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: '4px' }}
            value={form.html}
            onChange={(e) => setForm({...form, html: e.target.value})}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Recipients</label>
          
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
          disabled={loading || (usage && (
            (form.type === 'marketing' && usage.daily_marketing_remaining <= 0) ||
            (form.type === 'transactional' && usage.daily_transactional_remaining <= 0)
          ))}
          style={{ 
            background: (loading || (usage && (
              (form.type === 'marketing' && usage.daily_marketing_remaining <= 0) ||
              (form.type === 'transactional' && usage.daily_transactional_remaining <= 0)
            ))) ? '#ccc' : '#007bff', 
            color: 'white', 
            padding: '0.75rem 2rem', 
            border: 'none', 
            borderRadius: '4px',
            cursor: (loading || (usage && (
              (form.type === 'marketing' && usage.daily_marketing_remaining <= 0) ||
              (form.type === 'transactional' && usage.daily_transactional_remaining <= 0)
            ))) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {loading ? 'Sending...' : 'Send Campaign'}
        </button>
        
        {usage && (
          (form.type === 'marketing' && usage.daily_marketing_remaining <= 0) ||
          (form.type === 'transactional' && usage.daily_transactional_remaining <= 0)
        ) && (
          <p style={{ marginTop: '1rem', color: '#EF4444', fontWeight: '600' }}>
            ⚠️ Daily limit reached. Please upgrade your plan or wait until tomorrow.
          </p>
        )}
      </form>
    </div>
  )
}

export default Campaigns

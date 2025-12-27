import React, { useState, useEffect } from 'react'
import { useWhop } from '../context/WhopContext'
import { subscriberAPI } from '../services/api'

const Subscribers = () => {
  const user = useWhop()
  
  const [subscribers, setSubscribers] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0 })
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterVip, setFilterVip] = useState(false)

  useEffect(() => {
    loadSubscribers()
  }, [user.id, filterVip])

  const loadSubscribers = async () => {
    try {
      setLoading(true)
      const response = await subscriberAPI.getAll(user.id)
      
      if (response.data.success) {
        let subs = response.data.subscribers
        
        // Filter VIP if enabled
        if (filterVip) {
          subs = subs.filter(sub => sub.is_vip === true)
        }
        
        setSubscribers(subs)
        setStats(response.data.stats)
      }
    } catch (error) {
      console.error('Error loading subscribers:', error)
      alert('Failed to load subscribers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getContactLimit = () => {
    if (!user.plan) return 25
    
    const limits = {
      'Free Plan': 25,
      'Starter Plan': 100,
      'Growth Plan': 250,
      'Pro Plan': 400
    }
    
    return limits[user.plan?.name] || 25
  }

  const handleAddSubscriber = async () => {
    if (!newEmail) {
      alert('Please enter an email address')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      alert('Please enter a valid email address')
      return
    }
    
    const limit = getContactLimit()
    if (stats.total >= limit) {
      alert(`You've reached your contact limit of ${limit}. Upgrade your plan to add more contacts.`)
      return
    }

    setSaving(true)
    
    try {
      const response = await subscriberAPI.add({
        whopUserId: user.id,
        email: newEmail,
        name: newName
      })

      if (response.data.success) {
        alert('Subscriber added successfully!')
        setNewEmail('')
        setNewName('')
        setShowAddModal(false)
        loadSubscribers() // Reload the list
      }
    } catch (error) {
      console.error('Error adding subscriber:', error)
      const message = error.response?.data?.message || 'Failed to add subscriber'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSubscriber = async (id) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) {
      return
    }

    try {
      const response = await subscriberAPI.delete(id, user.id)
      
      if (response.data.success) {
        alert('Subscriber deleted successfully!')
        loadSubscribers() // Reload the list
      }
    } catch (error) {
      console.error('Error deleting subscriber:', error)
      alert('Failed to delete subscriber. Please try again.')
    }
  }

  const handleToggleVip = async (id) => {
    try {
      const response = await subscriberAPI.toggleVip(id, user.id)

      if (response.data.success) {
        loadSubscribers() // Reload the list
      }
    } catch (error) {
      console.error('Error toggling VIP:', error)
      alert('Failed to update VIP status')
    }
  }

  const handleUnsubscribe = async (id) => {
    try {
      const response = await subscriberAPI.update(id, {
        whopUserId: user.id,
        status: 'unsubscribed'
      })

      if (response.data.success) {
        alert('Subscriber unsubscribed')
        loadSubscribers()
      }
    } catch (error) {
      console.error('Error updating subscriber:', error)
      alert('Failed to update subscriber')
    }
  }

  const contactLimit = getContactLimit()
  const slotsRemaining = contactLimit - stats.total

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading subscribers...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Subscribers</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {stats.active} active subscribers • {slotsRemaining} slots remaining
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={slotsRemaining <= 0}
          style={{
            background: slotsRemaining <= 0 ? '#ccc' : '#28a745',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: slotsRemaining <= 0 ? 'not-allowed' : 'pointer',
            fontWeight: '600'
          }}
        >
          + Add Subscriber
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#28a745' }}>{stats.total}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Total Contacts</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#007bff' }}>{stats.active}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Active</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#6c757d' }}>{stats.unsubscribed}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Unsubscribed</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#ffc107' }}>{contactLimit}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Plan Limit</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setFilterVip(!filterVip)}
          style={{
            background: filterVip ? '#ffc107' : 'transparent',
            color: filterVip ? 'black' : '#007bff',
            padding: '0.75rem 1.5rem',
            border: '1px solid ' + (filterVip ? '#ffc107' : '#007bff'),
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {filterVip ? '⭐ Showing VIP Only' : '☆ Show All'}
        </button>
        <button
          onClick={() => alert('CSV import feature coming soon!')}
          style={{
            background: '#007bff',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Import CSV
        </button>
        <button
          onClick={() => alert('Export feature coming soon!')}
          style={{
            background: 'transparent',
            color: '#007bff',
            padding: '0.75rem 1.5rem',
            border: '1px solid #007bff',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Export List
        </button>
      </div>

      {/* Subscribers Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8f9fa' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>VIP</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Added</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No subscribers yet</p>
                  <p>Add your first subscriber to get started!</p>
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem' }}>{sub.name || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>{sub.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleToggleVip(sub.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        padding: '0.25rem'
                      }}
                      title={sub.is_vip ? 'Remove from VIP' : 'Mark as VIP'}
                    >
                      {sub.is_vip ? '⭐' : '☆'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      background: sub.status === 'active' ? '#d4edda' : '#f8d7da',
                      color: sub.status === 'active' ? '#155724' : '#721c24'
                    }}>
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {sub.status === 'active' && (
                        <button
                          onClick={() => handleUnsubscribe(sub.id)}
                          style={{
                            background: '#ffc107',
                            color: 'black',
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Unsubscribe
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSubscriber(sub.id)}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h2>Add New Subscriber</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="subscriber@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Name (Optional)
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewEmail('')
                  setNewName('')
                }}
                disabled={saving}
                style={{
                  background: 'transparent',
                  color: '#666',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscriber}
                disabled={saving}
                style={{
                  background: saving ? '#ccc' : '#28a745',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Adding...' : 'Add Subscriber'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Subscribers

import React, { useState } from 'react'
import { useWhop } from '../context/WhopContext'

const Subscribers = () => {
  const user = useWhop()
  
  // Mock subscriber data (in production, this would come from your backend)
  const [subscribers, setSubscribers] = useState([
    { id: 1, email: 'customer1@example.com', name: 'John Doe', status: 'Active', joined: '2024-01-15' },
    { id: 2, email: 'customer2@example.com', name: 'Jane Smith', status: 'Active', joined: '2024-02-20' },
    { id: 3, email: 'customer3@example.com', name: 'Bob Johnson', status: 'Unsubscribed', joined: '2024-03-10' },
  ])
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')

  // Get contact limit based on plan
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

  const handleAddSubscriber = () => {
    if (!newEmail) {
      alert('Please enter an email address')
      return
    }
    
    const limit = getContactLimit()
    if (subscribers.length >= limit) {
      alert(`You've reached your contact limit of ${limit}. Upgrade your plan to add more contacts.`)
      return
    }
    
    const newSubscriber = {
      id: subscribers.length + 1,
      email: newEmail,
      name: newName || 'Unknown',
      status: 'Active',
      joined: new Date().toISOString().split('T')[0]
    }
    
    setSubscribers([...subscribers, newSubscriber])
    setNewEmail('')
    setNewName('')
    setShowAddModal(false)
    alert('Subscriber added successfully!')
  }

  const handleDeleteSubscriber = (id) => {
    if (confirm('Are you sure you want to delete this subscriber?')) {
      setSubscribers(subscribers.filter(sub => sub.id !== id))
    }
  }

  const activeCount = subscribers.filter(s => s.status === 'Active').length
  const contactLimit = getContactLimit()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Subscribers</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {activeCount} active subscribers • {contactLimit - subscribers.length} slots remaining
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#28a745',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + Add Subscriber
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#28a745' }}>{subscribers.length}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Total Contacts</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#007bff' }}>{activeCount}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>Active</p>
        </div>
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '2rem', color: '#6c757d' }}>
            {subscribers.filter(s => s.status === 'Unsubscribed').length}
          </h3>
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
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Joined</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No subscribers yet</p>
                  <p>Add your first subscriber to get started!</p>
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem' }}>{sub.name}</td>
                  <td style={{ padding: '1rem' }}>{sub.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      background: sub.status === 'Active' ? '#d4edda' : '#f8d7da',
                      color: sub.status === 'Active' ? '#155724' : '#721c24'
                    }}>
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{sub.joined}</td>
                  <td style={{ padding: '1rem' }}>
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
                style={{
                  background: 'transparent',
                  color: '#666',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscriber}
                style={{
                  background: '#28a745',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Subscriber
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '4px'
      }}>
        <p style={{ margin: 0, color: '#004085' }}>
          <strong>Note:</strong> This is demo data. In production, subscribers will be stored in your database and synced with your actual email campaigns.
        </p>
      </div>
    </div>
  )
}

export default Subscribers

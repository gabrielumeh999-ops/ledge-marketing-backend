import React, { useState, useEffect } from 'react'
import { useWhop } from '../context/WhopContext'
import { userAPI, analyticsAPI } from '../services/api'

const Dashboard = () => {
  const user = useWhop()
  const [usage, setUsage] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [user.id])

  const fetchDashboardData = async () => {
    try {
      const [userRes, analyticsRes] = await Promise.all([
        userAPI.verify(user.id),
        analyticsAPI.get(user.id)
      ])

      if (userRes.data.success) {
        setUsage(userRes.data.user)
      }

      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.analytics)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Welcome back, {user.username}</h1>
      
      {usage && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
            <h3>Marketing Emails</h3>
            <p>{usage.monthly_marketing_sent} / {usage.marketing_limit_monthly} monthly</p>
            <p>{usage.daily_marketing_sent} / {usage.marketing_limit_daily} daily</p>
          </div>
          
          {usage.transactional_enabled && (
            <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
              <h3>Transactional Emails</h3>
              <p>{usage.monthly_transactional_sent} / {usage.transactional_limit_monthly} monthly</p>
              <p>{usage.daily_transactional_sent} / {usage.transactional_limit_daily} daily</p>
            </div>
          )}
          
          <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
            <h3>Contacts</h3>
            <p>{usage.contacts_count} / {usage.contact_limit} used</p>
          </div>
        </div>
      )}
      
      {analytics && usage.analytics_enabled && (
        <div style={{ marginTop: '2rem', background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
          <h3>Analytics</h3>
          <p>Total Campaigns: {analytics.total_campaigns}</p>
          <p>Open Rate: {analytics.open_rate}</p>
          <p>Click Rate: {analytics.click_rate}</p>
        </div>
      )}
    </div>
  )
}

export default Dashboard
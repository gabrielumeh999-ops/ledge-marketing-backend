import React from 'react'
import { useWhop } from '../context/WhopContext'

const Subscribers = () => {
  const user = useWhop()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Subscribers</h1>
      <p>Coming soon: Manage your email subscribers here.</p>
      <p>Your current plan allows up to {user.plan?.name === 'Free Plan' ? '25' : 
        user.plan?.name === 'Starter Plan' ? '100' :
        user.plan?.name === 'Growth Plan' ? '250' : '400'} contacts.</p>
    </div>
  )
}

export default Subscribers
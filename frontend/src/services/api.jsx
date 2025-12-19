import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add Whop user ID if available
api.interceptors.request.use((config) => {
  const whopUserId = localStorage.getItem('whopUserId')
  if (whopUserId && config.data) {
    config.data.whopUserId = whopUserId
  }
  return config
})

export const userAPI = {
  verify: (whopUserId) => api.get(`/user/${whopUserId}/verify`),
  update: (data) => api.post('/user/update', data)
}

export const campaignAPI = {
  send: (data) => api.post('/send-email', data)
}

export const analyticsAPI = {
  get: (whopUserId) => api.get(`/analytics?whopUserId=${whopUserId}`)
}

export default api
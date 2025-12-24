import axios from 'axios'

// Determine the API base URL based on environment
const getApiBaseUrl = () => {
  // In production, use the environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:5000'
  }
  
  // Fallback to same origin
  return window.location.origin
}

const API_BASE_URL = getApiBaseUrl()

console.log('🔗 API Base URL:', API_BASE_URL)

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
})

// Request interceptor to add Whop user ID if available
api.interceptors.request.use((config) => {
  const whopUserId = localStorage.getItem('whopUserId')
  if (whopUserId && config.data) {
    config.data.whopUserId = whopUserId
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('Network Error: No response received')
    } else {
      console.error('Error:', error.message)
    }
    return Promise.reject(error)
  }
)

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

export const subscriberAPI = {
  getAll: (whopUserId) => api.get(`/subscribers?whopUserId=${whopUserId}`),
  add: (data) => api.post('/subscribers', data),
  update: (id, data) => api.put(`/subscribers/${id}`, data),
  delete: (id, whopUserId) => api.delete(`/subscribers/${id}?whopUserId=${whopUserId}`),
  bulkImport: (data) => api.post('/subscribers/bulk', data)
}

export default api

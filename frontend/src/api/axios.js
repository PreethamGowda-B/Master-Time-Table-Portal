import axios from 'axios'

const BACKEND = import.meta.env.VITE_API_URL || 'https://master-time-table-portal.onrender.com'

const api = axios.create({ baseURL: `${BACKEND}/api` })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Token ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    // Only logout on 401 for authenticated endpoints, not on page-load data fetches
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      // Don't logout if it's a background/optional data fetch
      const skipLogout = ['/faculty-availability/all/', '/auth/admin-exists/']
      if (!skipLogout.some(u => url.includes(u))) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.dispatchEvent(new CustomEvent('auth:logout'))
      }
    }
    return Promise.reject(err)
  }
)

export default api

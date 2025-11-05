import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL: API_BASE,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

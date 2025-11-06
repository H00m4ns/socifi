import axios from 'axios'

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL: API_BASE,
})

// inject JWT kalau ada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ---- Auth APIs ----
export type User = {
  id: number
  username?: string | null
  displayName?: string | null
  walletAddress?: string | null
  profilePictureUrl?: string | null
}

export type VerifyResp = {
  token?: string
  user?: User
}

export async function getNonce(address: string) {
  const { data } = await api.get(`/auth/nonce/${address}`)
  return data
}

// call verify with walletAddress + optional username/profilePictureUrl
export async function verifyWithPayload(payload: any): Promise<VerifyResp> {
  const { data } = await api.post('/auth/verify', payload)
  return data
}

export async function getMe(): Promise<{ user?: User; balance?: number }> {
  const { data } = await api.get('/me')
  return data
}

export async function registerUser(payload: {
  address: string
  username: string
  profilePictureUrl?: string
}): Promise<{ token: string; user: User }> {
  const { data } = await api.post('/auth/register', payload)
  return data
}

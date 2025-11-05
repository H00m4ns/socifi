import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit'
import { useEffect, useState } from 'react'
import { api } from './lib/api'

type PostItem = {
  id: number
  imageUrl: string
  caption?: string
  createdAt: string
  user?: { displayName?: string; walletAddress?: string }
  likeCount: number
  commentCount: number
}

export default function App() {
  const account = useCurrentAccount()
  const { mutateAsync: signMsg } = useSignPersonalMessage()
  const [jwt, setJwt] = useState<string | null>(localStorage.getItem('jwt'))
  const [posts, setPosts] = useState<PostItem[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')

  // auto-login setelah wallet connect
  useEffect(() => {
    (async () => {
      if (!account?.address) return
      try {
        const addr = account.address
        const { data: { nonce } } = await api.get(`/auth/nonce/${addr}`)
        const message = `Login to SociFi\nAddress: ${addr}\nNonce: ${nonce}`
        const sig = await signMsg({ message: new TextEncoder().encode(message) })

        // NOTE: BE kita belum verifikasi signature, kirim minimal data
        const { data } = await api.post('/auth/verify', {
          walletAddress: addr,
          displayName: `user-${addr.slice(0, 6)}`,
          // signature/publicKey opsional sesuai BE
          // signature: Array.from(sig.signature),
          // publicKey: Array.from(sig.publicKey),
        })

        localStorage.setItem('jwt', data.token)
        setJwt(data.token)
        await loadFeed()
      } catch (e) {
        console.error('login failed', e)
      }
    })()
  }, [account?.address])

  async function loadFeed() {
    const { data } = await api.get<PostItem[]>('/posts')
    setPosts(data)
  }

  useEffect(() => {
    loadFeed()
  }, [])

  async function submitPost() {
    if (!jwt) return alert('Connect & login dulu')
    if (!imageUrl) return alert('Isi image URL')
    await api.post('/posts', { imageUrl, caption })
    setImageUrl('')
    setCaption('')
    await loadFeed()
  }

  async function likePost(id: number) {
    if (!jwt) return alert('Connect & login dulu')
    await api.post('/likes', { postId: id })
    await loadFeed()
  }

  async function commentPost(id: number) {
    if (!jwt) return alert('Connect & login dulu')
    const content = prompt('Tulis komentar') || ''
    if (!content) return
    await api.post('/comments', { postId: id, content })
    await loadFeed()
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>SociFi (mini)</h1>

      {!account?.address ? (
        <p>Silakan klik “Connect” (kanan atas) untuk sambung wallet Slush/Sui Wallet.</p>
      ) : (
        <p>Connected: {account.address}</p>
      )}

      {/* Form Post */}
      <div style={{ display: 'grid', gap: 8, margin: '16px 0', border: '1px solid #eee', padding: 12 }}>
        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <input
          placeholder="Caption (opsional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <button onClick={submitPost}>Post (reward 0.005 SUI)</button>
      </div>

      {/* Feed */}
      <div>
        {posts.map((p) => (
          <div key={p.id} style={{ border: '1px solid #eee', padding: 12, margin: '12px 0' }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
              {p.user?.displayName} — {p.user?.walletAddress}
            </div>
            <img src={p.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />
            {p.caption && <div style={{ marginTop: 8 }}>{p.caption}</div>}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <button onClick={() => likePost(p.id)}>Like (0.005)</button>
              <button onClick={() => commentPost(p.id)}>Comment (0.005)</button>
              <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                👍 {p.likeCount} · 💬 {p.commentCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

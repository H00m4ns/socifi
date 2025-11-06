import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { HomeIcon, MessageCircleOffIcon, SearchIcon } from "lucide-react";
import Card from "../partials/Card";
import Posting from "./Posting";
import { api, type User, getNonce, verifyWithPayload, getMe } from "../lib/api";

export default function Main() {
  const account = useCurrentAccount(); // dari dapp-kit
  const address = account?.address;
  const shortAddr = useMemo(
    () => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""),
    [address]
  );

  const [user, setUser] = useState<User | null>(null);
  const { mutateAsync: signMsg } = useSignPersonalMessage()
  const [posts, setPosts] = useState<Array<any>>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any | null>(null)
  const [commentText, setCommentText] = useState('')
  const [needRegister, setNeedRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [pp, setPp] = useState('')
  const [balance, setBalance] = useState<number | null>(null)

  // load posts
  async function fetchPosts() {
    setLoadingPosts(true)
    try {
      const { data } = await api.get('/posts')
      setPosts(data)
    } catch (e) {
      console.error('Failed to load posts', e)
    } finally {
      setLoadingPosts(false)
    }
  }

  useEffect(() => { fetchPosts() }, [])

  // when wallet connects, perform sign+verify flow here (Main handles auth)
  useEffect(() => {
    const run = async () => {
      if (!address) return
      try {
        // fetch nonce
        const { nonce } = await getNonce(address)
        const message = `Login to SociFi\nAddress: ${address}\nNonce: ${nonce}`
        const sig = await signMsg({ message: new TextEncoder().encode(message) })

        // call verify (backend may require username for new users)
        try {
          const payload: any = {
            walletAddress: address,
            displayName: `user-${address.slice(0,6)}`,
            signature: Array.from((sig as any).signature),
          }
          const resp = await verifyWithPayload(payload)
          if (resp.token) {
            localStorage.setItem('jwt', resp.token)
          }
          if (resp.user) setUser(resp.user as any)

          // load balance
          const me = await getMe()
          setBalance(me.balance ?? null)
        } catch (e: any) {
          const err = e?.response?.data?.error || e?.message || ''
          if (err.includes('username is required')) {
            // show register modal
            setNeedRegister(true)
          } else {
            console.error('verify failed', e)
          }
        }
      } catch (e) {
        console.error('signin failed', e)
      }
    }
    run()
  }, [address])

  async function onSubmitRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!address) return
    try {
      // re-run sign flow to get current nonce and signature
      const { nonce } = await getNonce(address)
      const message = `Login to SociFi\nAddress: ${address}\nNonce: ${nonce}`
      const sig = await signMsg({ message: new TextEncoder().encode(message) })

      const payload: any = {
        walletAddress: address,
        displayName: `user-${address.slice(0,6)}`,
        username: username.trim(),
        profilePictureUrl: pp.trim() || null,
        signature: Array.from((sig as any).signature),
      }
      const resp = await verifyWithPayload(payload)
      if (resp.token) localStorage.setItem('jwt', resp.token)
      if (resp.user) setUser(resp.user as any)
      setNeedRegister(false)

      const me = await getMe()
      setBalance(me.balance ?? null)
    } catch (e) {
      console.error('[register] error', e)
      const err = (e as any)?.response?.data?.error || (e as any)?.message || ''
      alert('Gagal mendaftar: ' + err)
    }
  }

  // Load details + comments for a post
  async function loadPostDetails(postId: number) {
    try {
      const { data } = await api.get(`/posts/${postId}`)
      setSelectedPost(data)
    } catch (e) {
      console.error('Failed to load post details', e)
    }
  }

  async function handleLike(postId?: number) {
    if (!postId) return
    try {
      await api.post('/likes', { postId })
      await fetchPosts()
      if (selectedPost?.id === postId) await loadPostDetails(postId)
      // refresh balance after like (reward claim may have been created)
      try {
        const me = await getMe()
        setBalance(me.balance ?? null)
      } catch (e) {
        console.warn('failed to refresh balance after like', e)
      }
    } catch (e: any) {
      const err = e?.response?.data?.error || e?.message || 'Failed to like'
      alert(err)
    }
  }

  async function handleOpenComments(postId?: number) {
    if (!postId) return
    await loadPostDetails(postId)
  }

  async function submitComment() {
    if (!selectedPost) return
    if (!commentText.trim()) return alert('Isi komentar dulu')
    try {
      await api.post('/comments', { postId: selectedPost.id, content: commentText.trim() })
      setCommentText('')
      await loadPostDetails(selectedPost.id)
      await fetchPosts()
      // refresh balance after comment
      try {
        const me = await getMe()
        setBalance(me.balance ?? null)
      } catch (e) {
        console.warn('failed to refresh balance after comment', e)
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Gagal komentar')
    }
  }

  // (optional) later: handle register flow here. For now auth is handled in App.tsx.

  return (
    <div className="w-full">
      <div className="container max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-9 divide-neutral-200">
          {/* Sidebar kiri */}
          <div className="col-span-2 h-screen sticky top-0">
            <div className="w-full h-full flex flex-col gap-4 p-4">
              <a href="/" className="text-2xl font-bold text-neutral-800">
                SociFi
              </a>

              <div className="w-full flex items-center justify-center flex-col text-start">
                <a className="w-full py-2 rounded-xl px-4 hover:bg-neutral-100 flex items-center gap-2">
                  <HomeIcon className="text-neutral-600" size={18} />
                  Beranda
                </a>
                <a className="w-full py-2 rounded-xl px-4 hover:bg-neutral-100 flex items-center gap-2">
                  <SearchIcon className="text-neutral-600" size={18} />
                  Jelajahi
                </a>
              </div>

              {/* Kartu saldo & identitas sederhana */}
              <div className="w-full mt-2">
                <div className="p-4 rounded-2xl border border-neutral-200">
                  <p className="text-sm text-neutral-500">Balance</p>
                  {/* Kamu bisa isi angka real pakai Sui SDK nanti */}
                  <h2 className="text-3xl font-bold">{balance != null ? balance.toFixed(4) : '0.0000'}</h2>
                  <p className="text-xs text-neutral-500">SUI</p>
                </div>

                <div className="mt-3 p-4 rounded-2xl border border-neutral-200">
                  <p className="text-xs text-neutral-500 mb-1">
                    {user?.username ? "Alias" : "Alias / Wallet Address"}
                  </p>
                  <p className="font-medium truncate">
                    {user?.username || shortAddr || "-"}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {address || "Wallet address"}
                  </p>
                </div>

                <div className="mt-3">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>

          {/* Feed tengah */}
          <div className="col-span-5 min-h-screen p-4 border-x border-neutral-200">
            <h1 className="text-xl font-bold text-neutral-800">Postingan</h1>

            {/* Form posting, bisa disable kalau belum login backend */}
            <div className="mt-4 opacity-100">
              <Posting />
            </div>

            {/* Posts loaded from backend */}
            {loadingPosts ? (
              <p className="text-sm text-neutral-500">Loading posts…</p>
            ) : (
              posts.map((p: any) => (
                <Card
                  key={p.id}
                  postId={p.id}
                  // prefer username (handle null), then displayName
                  alias={p.user?.username || p.user?.displayName || 'Anon'}
                  address={p.user?.walletAddress || 'unknown'}
                  image={p.imageUrl}
                  avatar={p.user?.profilePictureUrl ?? null}
                  likeCount={p.likeCount}
                  commentCount={p.commentCount}
                  onLike={handleLike}
                  onComment={handleOpenComments}
                />
              ))
            )}
          </div>

          {/* Sidebar kanan - comments panel */}
          <div className="col-span-2 p-4">
            <h1 className="text-xl font-bold text-neutral-800">Comments</h1>
            {!selectedPost ? (
              <div className="w-full p-5 rounded-2xl border border-neutral-200 mt-4 flex flex-col items-center justify-center">
                <MessageCircleOffIcon size={64} className="text-neutral-300" />
                <p className="text-neutral-500 font-semibold mt-2">Pilih posting untuk lihat komentar</p>
              </div>
            ) : (
              <div className="w-full mt-4">
                <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="w-full h-48 bg-neutral-200">
                    {selectedPost.imageUrl ? (
                      <img src={selectedPost.imageUrl} alt="post" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-300 overflow-hidden">
                        {selectedPost.user?.profilePictureUrl ? (
                          <img src={selectedPost.user.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <div className="font-medium">{selectedPost.user?.username || selectedPost.user?.displayName}</div>
                        <div className="text-xs text-neutral-500">{selectedPost.user?.walletAddress}</div>
                      </div>
                    </div>
                    {selectedPost.caption ? <p className="mt-3">{selectedPost.caption}</p> : null}
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Komentar</h4>
                  <div className="max-h-64 overflow-auto space-y-3">
                    {selectedPost.comments && selectedPost.comments.length > 0 ? (
                      selectedPost.comments.map((c: any) => (
                        <div key={c.id} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-300 overflow-hidden">
                              {c.user?.profilePictureUrl ? (
                                <img src={c.user.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{c.user?.username || c.user?.displayName || 'Anon'}</div>
                              <div className="text-xs text-neutral-500">{c.user?.walletAddress}</div>
                            </div>
                          </div>
                          <p className="mt-2 text-sm">{c.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500">Belum ada komentar</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full border rounded-lg p-2"
                      placeholder="Tulis komentar..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={submitComment} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Kirim</button>
                      <button onClick={() => setSelectedPost(null)} className="px-4 py-2 border rounded-lg">Tutup</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registration modal (shown when backend requires username) */}
      {needRegister && address && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-1">Buat Akun</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Wallet <span className="font-mono">{shortAddr}</span> belum
              terdaftar. Lengkapi data di bawah ini.
            </p>

            <form onSubmit={onSubmitRegister} className="flex flex-col gap-3">
              <label className="text-sm">
                Username
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="unknown"
                  required
                />
              </label>

              <label className="text-sm">
                Profile picture URL (opsional)
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring"
                  value={pp}
                  onChange={(e) => setPp(e.target.value)}
                  placeholder="https://…/avatar.png"
                />
              </label>

              <div className="flex items-center gap-2 mt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-500 text-white font-medium py-2"
                >
                  Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setNeedRegister(false)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

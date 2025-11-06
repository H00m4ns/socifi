// src/index.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { PrismaClient, reward_claims_action_type } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { hasHotWallet, getHotWallet, getRewardMist, sendReward } from './sui/hotwallet';


// taruh di paling atas (setelah import)
const toNum = (v: any) => (typeof v === 'bigint' ? Number(v) : v)
const toStr = (v: any) => (typeof v === 'bigint' ? v.toString() : String(v))

// opsional: mapper user & post
const mapUser = (u: any) =>
  u
    ? {
        id: toNum(u.id),
        username: u.username,
        profilePictureUrl: u.profile_picture,
        displayName: u.display_name,
        walletAddress: u.wallet_address,
        createdAt: u.created_at,
      }
    : null

const mapPost = (p: any) => ({
  id: toNum(p.id),
  imageUrl: p.image_url,
  caption: p.caption,
  createdAt: p.created_at,
  user: p.users
    ? {
        username: p.users.username,
        displayName: p.users.display_name,
        walletAddress: p.users.wallet_address,
        profilePictureUrl: p.users.profile_picture,
      }
    : null,
  likeCount: Array.isArray(p.likes) ? p.likes.length : 0,
  commentCount: Array.isArray(p.comments) ? p.comments.length : 0,
})


/** =============== Setup dasar =============== */
const app = express()
app.use(express.json())
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
const prisma = new PrismaClient()

// Setup uploads directory and static serving for profile pictures
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
app.use('/uploads', express.static(UPLOAD_DIR))

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

/** =============== Sui config =============== */
// const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet'
const SUI_NETWORK = 'testnet'
const sui = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) })
const REWARD_MIST = BigInt(process.env.REWARD_AMOUNT_MIST || '5000000') // 0.005 SUI
const REWARD_SENDER_ADDR = process.env.REWARD_SENDER_ADDR || ''
const REWARD_SENDER_SECRET = process.env.REWARD_SENDER_SECRET || '' // base64 (RAW 32 bytes)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

/** =============== Health =============== */
app.get('/health', (_req, res) => {
  const hw = getHotWallet();
  res.json({
    ok: true,
    network: process.env.SUI_NETWORK || 'testnet',
    rewardMist: getRewardMist().toString(),
    sender: hw.address,
    hasHotWallet: hasHotWallet(),
  });
});

/** =============== Admin: send arbitrary reward (dev only) =============== */
app.post('/admin/send-reward', async (req, res) => {
  try {
    if (!hasHotWallet()) return res.status(500).json({ error: 'Hot wallet not configured on server' });

    const { toAddress, amountMist } = req.body;
    if (!toAddress) return res.status(400).json({ error: 'toAddress required' });

    const amt: bigint = amountMist != null ? BigInt(amountMist) : getRewardMist();
    const digest = await sendReward(toAddress, amt);

    res.json({ ok: true, digest });
  } catch (e: any) {
    console.error('/admin/send-reward error:', e);
    res.status(500).json({ error: e?.message || 'reward_failed' });
  }
});

/** =============== Auth (nonce + verify) =============== */
const nonces = new Map<string, string>() // wallet(lowercase) -> nonce

app.get('/auth/nonce/:wallet', (req, res) => {
  const wallet = String(req.params.wallet || '').toLowerCase()
  if (!wallet) return res.status(400).json({ error: 'Wallet required' })
  const nonce = Math.random().toString(36).slice(2)
  nonces.set(wallet, nonce)
  res.json({ nonce })
})

app.post('/auth/verify', async (req, res) => {
  try {
    const { walletAddress, /* signature, publicKey, */ displayName, username, profilePictureUrl } = req.body || {}
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress is required' })

    const expected = nonces.get(String(walletAddress).toLowerCase())
    if (!expected) return res.status(400).json({ error: 'Nonce not found' })

    // TODO(Prod): verify signature server-side

    // validate optional profile picture URL
    const isValidUrl = (u: any) => {
      if (u == null) return true
      if (typeof u !== 'string') return false
      if (u.length > 2048) return false
      try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:' } catch { return false }
    }
    if (!isValidUrl(profilePictureUrl)) return res.status(400).json({ error: 'Invalid profilePictureUrl' })

    const existing = await (prisma as any).user.findUnique({ where: { wallet_address: walletAddress } })
    if (existing) {
      // update optional fields
      const updated = await (prisma as any).user.update({
        where: { id: existing.id },
        data: {
          display_name: displayName || existing.display_name,
          profile_picture: profilePictureUrl ?? existing.profile_picture,
        },
      })
      const token = jwt.sign({ uid: Number(updated.id), wa: walletAddress }, JWT_SECRET, { expiresIn: '7d' })
      return res.json({ token, user: mapUser(updated) })
    }

    // New user must provide username (unique)
    if (!username || String(username).trim().length === 0) {
      return res.status(400).json({ error: 'username is required for new users' })
    }
    const taken = await (prisma as any).user.findUnique({ where: { username } })
    if (taken) return res.status(409).json({ error: 'username already taken' })

    const user = await (prisma as any).user.create({
      data: {
        wallet_address: walletAddress,
        username,
        display_name: displayName || `user-${walletAddress.slice(0, 6)}`,
        profile_picture: profilePictureUrl ?? null,
      },
    })

    const token = jwt.sign({ uid: Number(user.id), wa: walletAddress }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: mapUser(user) })

  } catch (e) {
    console.error('/auth/verify error:', e)
    res.status(500).json({ error: 'Auth failed' })
  }
})

// Upload endpoint for profile pictures (no auth required)
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    // preserve extension
    const ext = path.extname(file.originalname) || ''
    const newName = `${file.filename}${ext}`
    const oldPath = path.join(UPLOAD_DIR, file.filename)
    const newPath = path.join(UPLOAD_DIR, newName)
    fs.renameSync(oldPath, newPath)

    const host = process.env.HOST || `http://localhost:${process.env.PORT || 4000}`
    const url = `${host}/uploads/${newName}`
    res.json({ url })
  } catch (e) {
    console.error('/upload error', e)
    res.status(500).json({ error: 'Upload failed' })
  }
})

/** =============== Middleware auth =============== */
type AuthedReq = express.Request & { auth?: { uid: bigint; wa: string } }
function auth(req: AuthedReq, res: express.Response, next: express.NextFunction) {
  try {
    const h = String(req.headers.authorization || '')
    const token = h.startsWith('Bearer ') ? h.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    req.auth = jwt.verify(token, JWT_SECRET) as any
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

/** =============== Feed =============== */
app.get('/posts', async (_req, res) => {
  try {
    const list = await prisma.post.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        users: true,
        likes: { select: { id: true } },
        comments: { select: { id: true } },
      },
    })
    res.json(list.map(mapPost))
  } catch (e) {
    console.error('/posts list error:', e)
    res.status(500).json({ error: 'Failed to load posts' })
  }
})

/** =============== Get single post with comments =============== */
app.get('/posts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Invalid post id' })
    const p = await prisma.post.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
        likes: true,
        comments: { include: { users: true }, orderBy: { created_at: 'asc' } },
      },
    })
    if (!p) return res.status(404).json({ error: 'Post not found' })

    const result = {
      id: toNum(p.id),
      imageUrl: p.image_url,
      caption: p.caption,
      createdAt: p.created_at,
      user: p.users
        ? {
            username: (p.users as any).username,
            displayName: p.users.display_name,
            walletAddress: p.users.wallet_address,
            profilePictureUrl: p.users.profile_picture,
          }
        : null,
      likeCount: Array.isArray(p.likes) ? p.likes.length : 0,
      commentCount: Array.isArray(p.comments) ? p.comments.length : 0,
      comments: (p.comments || []).map((c: any) => ({
        id: toNum(c.id),
        content: c.content,
        createdAt: c.created_at,
        user: c.users ? { displayName: c.users.display_name, walletAddress: c.users.wallet_address, profilePictureUrl: c.users.profile_picture, username: (c.users as any).username } : null,
      })),
    }

    res.json(result)
  } catch (e) {
    console.error('/posts/:id error', e)
    res.status(500).json({ error: 'Failed to load post' })
  }
})

/** =============== Me (user info + balance) =============== */
app.get('/me', auth, async (req: AuthedReq, res) => {
  try {
    const uid = req.auth!.uid
    const user = await prisma.user.findUnique({ where: { id: uid } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    // sum reward_claims.amount_mist for this user
    const agg = await prisma.rewardClaim.aggregate({
      where: { user_id: uid },
      _sum: { amount_mist: true },
    })
    const totalMist = agg._sum.amount_mist ?? BigInt(0)
    const balanceSui = Number(totalMist) / 1e9

    res.json({ user: mapUser(user), balance: balanceSui })
  } catch (e) {
    console.error('/me error', e)
    res.status(500).json({ error: 'Failed to load me' })
  }
})


/** =============== Buat Post (+ reward sekali) =============== */
app.post('/posts', auth, async (req: AuthedReq, res) => {
  try {
    const { imageUrl, caption } = req.body || {}
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' })
    const uid = req.auth!.uid

    const post = await prisma.post.create({
      data: { user_id: uid, image_url: imageUrl, caption },
    })

    // reward action: post
    try {
      const existed = await prisma.rewardClaim.findUnique({
        where: {
          post_id_user_id_action_type: {
            post_id: post.id,
            user_id: uid,
            action_type: 'post',
          },
        },
      })
      if (!existed) {
        const u = await prisma.user.findUnique({ where: { id: uid } })
        const digest = u ? await sendReward(u.wallet_address, REWARD_MIST) : null
        await prisma.rewardClaim.create({
          data: {
            post_id: post.id,
            user_id: uid,
            action_type: reward_claims_action_type.post,
            amount_mist: REWARD_MIST,
            tx_digest: digest ?? null,
          },
        })
      }
    } catch (e) {
      console.error('[posts] reward error:', e)
    }

    res.json({ id: toNum(post.id) })
  } catch (e) {
    console.error('/posts error:', e)
    res.status(500).json({ error: 'Failed to create post' })
  }
})

/** =============== Like (+ reward sekali) =============== */
app.post('/likes', auth, async (req: AuthedReq, res) => {
  try {
    const { postId } = req.body || {}
    const uid = req.auth!.uid
    // ensure post exists
    const post = await prisma.post.findUnique({ where: { id: BigInt(postId) } })
    if (!post) return res.status(404).json({ error: 'Post not found' })

    // prevent users from liking their own post
    if (post.user_id === uid) return res.status(400).json({ error: 'Cannot like your own post' })

    const like = await prisma.like
      .create({ data: { post_id: BigInt(postId), user_id: uid } })
      .catch(() => null)
    if (!like) return res.status(409).json({ error: 'Already liked' })

    try {
      const existed = await prisma.rewardClaim.findUnique({
        where: {
          post_id_user_id_action_type: {
            post_id: BigInt(postId),
            user_id: uid,
            action_type: 'like',
          },
        },
      })
      if (!existed) {
        const u = await prisma.user.findUnique({ where: { id: uid } })
        const digest = u ? await sendReward(u.wallet_address, REWARD_MIST) : null
        await prisma.rewardClaim.create({
          data: {
            post_id: BigInt(postId),
            user_id: uid,
            action_type: reward_claims_action_type.like,
            amount_mist: REWARD_MIST,
            tx_digest: digest ?? null,
          },
        })
      }
    } catch (e) {
      console.error('[likes] reward error:', e)
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('/likes error:', e)
    res.status(500).json({ error: 'Failed to like' })
  }
})

/** =============== Comment (+ reward sekali) =============== */
app.post('/comments', auth, async (req: AuthedReq, res) => {
  try {
    const { postId, content } = req.body || {}
    if (!content) return res.status(400).json({ error: 'content is required' })
    const uid = req.auth!.uid
    // ensure post exists
    const post = await prisma.post.findUnique({ where: { id: BigInt(postId) } })
    if (!post) return res.status(404).json({ error: 'Post not found' })

    // prevent users from commenting on their own post
    if (post.user_id === uid) return res.status(400).json({ error: 'Cannot comment on your own post' })

    const comment = await prisma.comment.create({
      data: { post_id: BigInt(postId), user_id: uid, content },
    })

    try {
      const existed = await prisma.rewardClaim.findUnique({
        where: {
          post_id_user_id_action_type: {
            post_id: BigInt(postId),
            user_id: uid,
            action_type: 'comment',
          },
        },
      })
      if (!existed) {
        const u = await prisma.user.findUnique({ where: { id: uid } })
        const digest = u ? await sendReward(u.wallet_address, REWARD_MIST) : null
        await prisma.rewardClaim.create({
          data: {
            post_id: BigInt(postId),
            user_id: uid,
            action_type: reward_claims_action_type.comment,
            amount_mist: REWARD_MIST,
            tx_digest: digest ?? null,
          },
        })
      }
    } catch (e) {
      console.error('[comments] reward error:', e)
    }

    res.json({ id: toNum(comment.id) })
  } catch (e) {
    console.error('/comments error:', e)
    res.status(500).json({ error: 'Failed to comment' })
  }
})

/** =============== Start server =============== */
const PORT = Number(process.env.PORT || 4000)
app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT} (network=${SUI_NETWORK})`)
})

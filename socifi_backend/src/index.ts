// src/index.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { PrismaClient, reward_claims_action_type } from '@prisma/client'
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'

// taruh di paling atas (setelah import)
const toNum = (v: any) => (typeof v === 'bigint' ? Number(v) : v)
const toStr = (v: any) => (typeof v === 'bigint' ? v.toString() : String(v))

// opsional: mapper user & post
const mapUser = (u: any) =>
  u
    ? {
        id: toNum(u.id),
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
  user: p.users ? { displayName: p.users.display_name, walletAddress: p.users.wallet_address } : null,
  likeCount: Array.isArray(p.likes) ? p.likes.length : 0,
  commentCount: Array.isArray(p.comments) ? p.comments.length : 0,
})


/** =============== Setup dasar =============== */
const app = express()
app.use(express.json())
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
const prisma = new PrismaClient()

/** =============== Sui config =============== */
// const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet'
const SUI_NETWORK = 'testnet'
const sui = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) })
const REWARD_MIST = BigInt(process.env.REWARD_AMOUNT_MIST || '5000000') // 0.005 SUI
const REWARD_SENDER_ADDR = process.env.REWARD_SENDER_ADDR || ''
const REWARD_SENDER_SECRET = process.env.REWARD_SENDER_SECRET || '' // base64 (RAW 32 bytes)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

function getHotWallet(): Ed25519Keypair | null {
  try {
    if (!REWARD_SENDER_SECRET) return null
    const raw = Buffer.from(REWARD_SENDER_SECRET, 'base64')
    if (raw.length !== 32) {
      console.error('REWARD_SENDER_SECRET harus RAW 32 bytes (base64)')
      return null
    }
    return Ed25519Keypair.fromSecretKey(new Uint8Array(raw))
  } catch (e) {
    console.error('Gagal init hot wallet:', e)
    return null
  }
}

async function sendReward(toAddress: string, amountMist: bigint): Promise<string | null> {
  const kp = getHotWallet()
  if (!kp) {
    console.warn('[reward] skipped (no hot wallet)')
    return null
  }
  try {
    const tx = new TransactionBlock()
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountMist)])
    tx.transferObjects([coin], tx.pure(toAddress))
    tx.setGasBudget(2_000_000)

    const res = await sui.signAndExecuteTransactionBlock({
      signer: kp,
      transactionBlock: tx,
      options: { showEffects: true },
    })
    console.log('[reward] sent:', res.digest)
    return res.digest
  } catch (e) {
    console.error('[reward] error:', e)
    return null
  }
}

/** =============== Health =============== */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    network: SUI_NETWORK,
    rewardMist: REWARD_MIST.toString(),
    sender: REWARD_SENDER_ADDR || null,
    hasHotWallet: Boolean(REWARD_SENDER_SECRET),
  })
})

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
    const { walletAddress, /* signature, publicKey, */ displayName } = req.body || {}
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress is required' })

    const expected = nonces.get(String(walletAddress).toLowerCase())
    if (!expected) return res.status(400).json({ error: 'Nonce not found' })

    // TODO(Prod): verifikasi signature di server

    const user = await prisma.user.upsert({
      where: { wallet_address: walletAddress },
      update: { display_name: displayName || `user-${walletAddress.slice(0, 6)}` },
      create: { wallet_address: walletAddress, display_name: displayName || `user-${walletAddress.slice(0, 6)}` },
    })

    // const token = jwt.sign({ uid: user.id, wa: walletAddress }, JWT_SECRET, { expiresIn: '7d' })
    // res.json({ token, user })

    const token = jwt.sign({ uid: Number(user.id), wa: walletAddress }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: mapUser(user) })   // ← aman dari BigInt

  } catch (e) {
    console.error('/auth/verify error:', e)
    res.status(500).json({ error: 'Auth failed' })
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
        users: { select: { id: true, display_name: true, wallet_address: true, created_at: true } },
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

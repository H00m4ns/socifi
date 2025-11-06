import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { api } from "./lib/api";
import Main from "./components/Main";

type PostItem = {
  id: number;
  imageUrl: string;
  caption?: string;
  createdAt: string;
  user?: { displayName?: string; walletAddress?: string; profilePictureUrl?: string | null };
  likeCount: number;
  commentCount: number;
};

export default function App() {
  const account = useCurrentAccount();
  const { mutateAsync: signMsg } = useSignPersonalMessage();
  const [jwt, setJwt] = useState<string | null>(localStorage.getItem("jwt"));
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");

  // auto-login setelah wallet connect
  useEffect(() => {
    (async () => {
      if (!account?.address) return;
      try {
        const addr = account.address;
        const {
          data: { nonce },
        } = await api.get(`/auth/nonce/${addr}`);
        const message = `Login to SociFi\nAddress: ${addr}\nNonce: ${nonce}`;
        const sig = await signMsg({
          message: new TextEncoder().encode(message),
        });

        // NOTE: BE kita belum verifikasi signature, kirim minimal data
        try {
          const { data } = await api.post("/auth/verify", {
            walletAddress: addr,
            displayName: `user-${addr.slice(0, 6)}`,
          });
          localStorage.setItem("jwt", data.token);
          setJwt(data.token);
          await loadFeed();
        } catch (err: any) {
          // if backend requires username for new users, prompt user
          const msg = err?.response?.data?.error || err?.message || ''
          if (msg.includes('username is required')) {
            // prompt until non-empty and not cancelled
            let username = ''
            while (!username) {
              const v = prompt('Pilih username (unik) — akan dipakai sebagai alias', '') || ''
              if (!v) continue
              username = v.trim()
            }
            let profilePictureUrl: string | null = prompt('Profile picture URL (http/https) — boleh kosong', '') || ''
            profilePictureUrl = (profilePictureUrl as string).trim() || null

            // try again with username + optional profile picture
            const { data } = await api.post('/auth/verify', {
              walletAddress: addr,
              displayName: `user-${addr.slice(0, 6)}`,
              username,
              profilePictureUrl,
            })
            localStorage.setItem('jwt', data.token)
            setJwt(data.token)
            await loadFeed()
          } else {
            console.error('login failed', err)
          }
        }
      } catch (e) {
        console.error("login failed", e);
      }
    })();
  }, [account?.address]);

  async function loadFeed() {
    const { data } = await api.get<PostItem[]>("/posts");
    setPosts(data);
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function submitPost() {
    if (!jwt) return alert("Connect & login dulu");
    if (!imageUrl) return alert("Isi image URL");
    await api.post("/posts", { imageUrl, caption });
    setImageUrl("");
    setCaption("");
    await loadFeed();
  }

  async function likePost(id: number) {
    if (!jwt) return alert("Connect & login dulu");
    await api.post("/likes", { postId: id });
    await loadFeed();
  }

  async function commentPost(id: number) {
    if (!jwt) return alert("Connect & login dulu");
    const content = prompt("Tulis komentar") || "";
    if (!content) return;
    await api.post("/comments", { postId: id, content });
    await loadFeed();
  }

  return (
    <>
      <Main />
    </>
  );
}

import { CameraIcon, ImageIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

type Props = {
  avatar?: string | null;
  onPosted?: () => Promise<void> | void;
  canInteract?: boolean;
};

export default function Posting({ avatar, onPosted }: Props) {
  // default to true if not provided (backwards compatible)
  const canInteract = arguments[0]?.canInteract ?? true
  const [imageUrl, setImageUrl] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [tmpUrl, setTmpUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePost() {
    if (!canInteract) return alert('Connect wallet to post')
    if (!imageUrl) return alert("Isi image URL dulu")
    try {
      setLoading(true)
      await api.post('/posts', { imageUrl, caption })
      setImageUrl("")
      setCaption("")
      if (onPosted) await onPosted()
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Gagal posting')
    } finally {
      setLoading(false)
    }
  }

  function openImageModal() {
    if (!canInteract) return alert('Connect wallet to add image')
    setTmpUrl("")
    setShowModal(true)
  }

  function confirmImage() {
    setImageUrl(tmpUrl.trim())
    setShowModal(false)
  }

  return (
    <div className="w-full p-4 rounded-xl border border-neutral-300 relative">
      <div className="w-full flex flex-col justify-center items-start gap-4">
        <div className="w-full flex items-center gap-4">
          <div className="w-10 h-10 aspect-square rounded-full overflow-hidden bg-neutral-300">
            {avatar ? (
              <img src={avatar} alt="pp" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="w-full flex flex-col">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              type="text"
              className="border-none outline-none w-full text-neutral-700"
              placeholder="Write Content here..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openImageModal} className="p-2 rounded-full hover:cursor-pointer hover:bg-neutral-300">
              <CameraIcon size={22} className="text-neutral-500" />
            </button>
          </div>
        </div>

          <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-200 flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt="preview" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon size={128} className="text-neutral-400" />
              </div>
            )}
          </div>

          {!canInteract ? (
            <div className="w-full mt-2 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-600 flex items-center justify-between">
              <div>Hubungkan wallet untuk membuat postingan.</div>
              <div className="text-xs text-neutral-500">View only</div>
            </div>
          ) : (
            <button
              onClick={handlePost}
              disabled={loading}
              className="w-full bg-blue-400 font-semibold text-neutral-50 p-2 rounded-lg flex items-center gap-2 justify-center hover:cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Posting...' : 'Posting'}
              <PencilIcon size={18} />
            </button>
          )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Tambah Gambar (URL)</h3>
              <button onClick={() => setShowModal(false)}>
                <XIcon />
              </button>
            </div>
            <input
              value={tmpUrl}
              onChange={(e) => setTmpUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full border rounded p-2 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Batal</button>
              <button onClick={confirmImage} className="px-4 py-2 bg-blue-500 text-white rounded">Gunakan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

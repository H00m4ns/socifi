import { CameraIcon, ImageIcon, PencilIcon } from "lucide-react";

export default function Posting() {
  return (
    <div className="w-full p-4 rounded-xl border border-neutral-300">
      <div className="w-full flex flex-col justify-center items-start gap-4">
        <div className="w-full flex items-center gap-4">
          <div className="w-10 h-10 aspect-square rounded-full bg-neutral-300"></div>
          <div className="w-full flex flex-col items-center justify-center">
            <input
              type="text"
              className="border-none outline-none w-full text-neutral-700"
              placeholder="Write Content here..."
            />
          </div>
          <div className="p-2 rounded-full hover:cursor-pointer hover:bg-neutral-300">
            <CameraIcon size={30} className="text-neutral-500" />
          </div>
        </div>
        <div className="w-full aspect-square bg-neutral-300 rounded-xl flex items-center justify-center">
          <ImageIcon size={128} className="text-neutral-400" />
        </div>
        <button className="w-full bg-blue-400 font-semibold text-neutral-50 p-2 rounded-lg flex items-center gap-2 justify-center hover:cursor-pointer">
          Posting
          <PencilIcon size={18} />
        </button>
      </div>
    </div>
  );
}

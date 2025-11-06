import { ImageIcon } from "lucide-react";

type Card = {
  alias: string;
  address: string;
  image?: string;
};

export default function Card(card: Card) {
  return (
    <div className="w-full my-5">
      <div className="flex flex-col justify-center items-start gap-4">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-neutral-300"></div>
          <div className="flex flex-col items-start justify-center">
            <h1 className="text-md font-medium">{card.alias}</h1>
            <p className="text-xs text-neutral-500">{card.address}</p>
          </div>
        </div>
        <div
          className={`w-full aspect-square bg-neutral-300 rounded-xl flex items-center justify-center bg-[url('${card.image}')]`}
        >
          <ImageIcon size={128} className="text-neutral-400" />
        </div>
      </div>
    </div>
  );
}

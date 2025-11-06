import { ImageIcon } from "lucide-react";

type Card = {
  alias: string;
  address: string;
  image?: string;
  avatar?: string | null;
};

export default function Card(card: Card) {
  return (
    <div className="w-full my-5">
      <div className="flex flex-col justify-center items-start gap-4">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-300">
            {card.avatar ? (
              // simple <img> avatar
              <img src={card.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col items-start justify-center">
            <h1 className="text-md font-medium">{card.alias}</h1>
            <p className="text-xs text-neutral-500">{card.address}</p>
          </div>
        </div>
        <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-200">
          {card.image ? (
            <img src={card.image} alt="post" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={128} className="text-neutral-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

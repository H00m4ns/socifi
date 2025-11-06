import { ConnectButton } from "@mysten/dapp-kit";
import { HomeIcon, MessageCircleOffIcon, SearchIcon } from "lucide-react";
import Card from "../partials/Card";
import Posting from "./Posting";

export default function Main() {
  return (
    <div className="w-full">
      <div className="container max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-9 divide-neutral-200">
          <div className="col-span-2 h-screen sticky top-0">
            <div className="w-full h-full flex flex-col gap-4 p-4">
              <a href="/" className="text-2xl font-bold text-neutral-800">
                SociFi
              </a>
              <div className="w-full flex items-center justify-center flex-col text-start">
                <a
                  href="/"
                  className="w-full font-semibold text-neutral-600 text-lg flex items-center gap-2 hover:bg-neutral-200 p-2 rounded-lg"
                >
                  <HomeIcon size={25} />
                  Beranda
                </a>
                <a
                  href="/"
                  className="w-full font-semibold text-neutral-500 text-lg flex items-center gap-2 hover:bg-neutral-200 p-2 rounded-lg"
                >
                  <SearchIcon size={25} />
                  Jelajahi
                </a>
              </div>
              <div className="w-full mt-auto flex flex-col gap-2">
                <div className="w-full rounded-xl border-2 border-neutral-300 p-4 flex flex-col items-start justify-center gap-2">
                  <h1 className="text-md font-semibold text-neutral-600">
                    Balance
                  </h1>
                  <h1 className="font-bold text-5xl text-neutral-700">
                    0.2000
                  </h1>
                  <p className="text-lg text-neutral-500">SUI</p>
                </div>
                <div className="w-full rounded-xl border-2 border-neutral-300 p-4 flex flex-col items-start justify-center gap-2">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-300"></div>
                    <div className="flex flex-col">
                      <h1 className="text-md font-medium">
                        Alias / Wallet Address
                      </h1>
                      <p className="text-xs text-neutral-500">Wallet address</p>
                    </div>
                  </div>
                </div>
                <ConnectButton className="w-full hover:cursor-pointer font-semibold! bg-blue-400! text-neutral-50!" />
              </div>
            </div>
          </div>
          <div className="col-span-4 h-fit">
            <div className="w-full h-full border-x border-neutral-300 p-4">
              <h1 className="text-2xl font-bold sticky top-0 bg-white py-4 text-neutral-800">
                Postingan
              </h1>
              <div className="w-full flex flex-col gap-2 py-4">
                {/* Card */}
                <Posting />
              </div>
              <div className="w-full flex flex-col gap-2 py-4">
                {/* Card */}
                <Card alias="Alias / Wallet Address" address="Wallet Address" />
                <Card alias="Alias / Wallet Address" address="Wallet Address" />
                <Card alias="Alias / Wallet Address" address="Wallet Address" />
              </div>
            </div>
          </div>
          <div className="col-span-3 h-fit sticky top-0">
            <div className="w-full p-4">
              <h1 className="text-2xl font-bold sticky top-0 bg-white py-4 text-neutral-800">
                Comments
              </h1>
              <div className="w-full rounded-xl border border-neutral-300 flex items-center justify-center flex-col gap-4 p-8">
                <MessageCircleOffIcon size={64} className="text-neutral-400" />
                <p className="text-2xl font-bold text-neutral-400">
                  Post Not Found
                </p>
              </div>
              <div className="w-full rounded-xl border border-neutral-300 flex items-start justify-center flex-col gap-4 p-8 mt-4 divide-y divide-neutral-300">
                <div className="w-full py-4">
                  <div className="flex gap-4 w-full">
                    <div className="w-10 h-10 rounded-full bg-neutral-300"></div>
                    <div className="flex flex-col">
                      <h1 className="text-md font-medium">
                        Alias / Wallet Address
                      </h1>
                      <p className="text-xs text-neutral-500">Wallet address</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-800 mt-2">
                    Content heree...
                  </p>
                </div>
                <div className="w-full py-4">
                  <div className="flex gap-4 w-full">
                    <div className="w-10 h-10 rounded-full bg-neutral-300"></div>
                    <div className="flex flex-col">
                      <h1 className="text-md font-medium">
                        Alias / Wallet Address
                      </h1>
                      <p className="text-xs text-neutral-500">Wallet address</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-800 mt-2">
                    Content heree...
                  </p>
                </div>
                <div className="w-full py-4">
                  <div className="flex gap-4 w-full">
                    <div className="w-10 h-10 rounded-full bg-neutral-300"></div>
                    <div className="flex flex-col">
                      <h1 className="text-md font-medium">
                        Alias / Wallet Address
                      </h1>
                      <p className="text-xs text-neutral-500">Wallet address</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-800 mt-2">
                    Content heree...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

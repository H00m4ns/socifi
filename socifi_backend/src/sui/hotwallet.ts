// src/sui/hotWallet.ts
import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';

const url = getFullnodeUrl('testnet');
export const sui = new SuiClient({ url });

let keypair: Ed25519Keypair | null = null;

function toAddress(kp: Ed25519Keypair) {
  return kp.getPublicKey().toSuiAddress();
}

function loadKey() {
  if (keypair) return;
  const raw = process.env.SUI_SECRET || process.env.REWARD_SENDER_SECRET;
  console.log('Raw private key:', raw || 'empty');
  if (!raw) return;
  keypair = Ed25519Keypair.fromSecretKey(raw);
}

export function hasHotWallet(): boolean {
  loadKey();
  return keypair !== null;
}

export function getHotWallet(): { keypair: Ed25519Keypair | null; address: string | null } {
  loadKey();
  return { keypair, address: keypair ? toAddress(keypair) : null };
}

export function getRewardMist(): bigint {
  // Prioritas: REWARD_MIST lalu REWARD_AMOUNT_MIST
  const v = process.env.REWARD_MIST ?? process.env.REWARD_AMOUNT_MIST;
  if (!v) return 5_000_000n;
  // buang spasi/komentar yang tak sengaja tertulis
  const clean = v.split('#')[0].split('(')[0].trim();
  return BigInt(clean);
}

export async function sendReward(toAddress: string, amountMist?: bigint): Promise<string> {
  loadKey();
  if (!keypair) throw new Error('HOT_WALLET_NOT_CONFIGURED');

  const amt = amountMist ?? getRewardMist();

  const tx = new Transaction();
  // bigint langsung, jangan tx.pure()
  const [coin] = tx.splitCoins(tx.gas, [amt]);
  // address harus dibungkus sebagai pure address
  tx.transferObjects([coin], tx.pure.address(toAddress));
  tx.setGasBudget(10_000_000); // 0.01 SUI

  const res = await sui.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showBalanceChanges: true },
  });

  await sui.waitForTransaction({ digest: res.digest });
  return res.digest;
}

import { keccak256 as viemKeccak, stringToBytes, type Hex } from "viem";

export function toBytes(s: string): Uint8Array {
  return stringToBytes(s);
}

export function keccak256(bytes: Uint8Array): Hex {
  return viemKeccak(bytes);
}

export function toHex(bytes: Uint8Array): Hex {
  return (`0x${Buffer.from(bytes).toString("hex")}`) as Hex;
}

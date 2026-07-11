import { describe, expect, it } from "vitest";
import { extractAddress, formatScanCard, helpText } from "./format.js";
import type { TokenOverview } from "@vane/shared-types";

const token: TokenOverview = {
  dataSource: "demo",
  address: "0x1111111111111111111111111111111111111111",
  chainId: 4663,
  name: "Test Token",
  symbol: "TEST",
  decimals: 18,
  priceUsd: 0.0001,
  marketCapUsd: 100_000,
  fdvUsd: 120_000,
  liquidityUsd: 25_000,
  volume1hUsd: 5_000,
  volume24hUsd: 40_000,
  buys1h: 40,
  sells1h: 12,
  holders: 321,
  uniqueBuyers: 88,
  ageMinutes: 45,
  athFdvUsd: 150_000,
  athMinutesAgo: 12,
  deployer: "0x2222222222222222222222222222222222222222",
  processingState: { market: "ready", holders: "ready", contract: "ready", graph: "ready" },
  topHolders: [],
  connectedSupplyPct: 11,
  confirmedConnectedSupplyPct: 4,
  probableConnectedSupplyPct: 11,
  freshWalletPct: 22,
  integrity: { total: 61, distribution: 0, contract: 0, liquidity: 0, developer: 0, behavior: 0 },
  momentum: { total: 70, velocity: 0, buyPressure: 0, holderGrowth: 0, smartWallets: 0 },
  dataConfidence: { level: "high", reasons: [] },
  cluster: null,
  findings: [],
  summary: "Test summary.",
  summaryEvidenceIds: [],
  warnings: [],
} as unknown as TokenOverview;

describe("extractAddress", () => {
  it("finds a 0x address", () => {
    expect(extractAddress("scan 0xAbC1111111111111111111111111111111111111 pls")).toBe(
      "0xabc1111111111111111111111111111111111111",
    );
  });

  it("finds a bare 40-hex address", () => {
    expect(extractAddress("abc1111111111111111111111111111111111111")).toBe(
      "0xabc1111111111111111111111111111111111111",
    );
  });

  it("returns null when no address exists", () => {
    expect(extractAddress("hello world")).toBeNull();
  });
});

describe("formatScanCard", () => {
  it("labels demo data prominently", () => {
    const card = formatScanCard(token, "https://vane.example.com");
    expect(card).toContain("DEMONSTRATION DATA");
    expect(card).toContain("$TEST");
    expect(card).toContain("https://vane.example.com/token/");
  });

  it("omits the demo banner for indexed data", () => {
    const card = formatScanCard({ ...token, dataSource: "indexed" }, "https://vane.example.com");
    expect(card).not.toContain("DEMONSTRATION DATA");
  });
});

describe("helpText", () => {
  it("lists the intelligence bot commands", () => {
    expect(helpText()).toContain("/scan");
    expect(helpText()).toContain("/ask");
  });
});

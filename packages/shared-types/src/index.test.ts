import { describe, expect, it } from "vitest";
import { classifySearchInput, normalizeAddress, shortAddress } from "./index.js";

describe("shared-types", () => {
  it("normalizes addresses", () => {
    expect(normalizeAddress("0xABC")).toBe("0xabc");
  });

  it("shortens addresses", () => {
    expect(shortAddress("0x8a2e897abb6bf1d77c61cb3fa6c093ac71dc0efd")).toContain("…");
  });

  it("classifies search input", () => {
    expect(classifySearchInput("0x8a2e897abb6bf1d77c61cb3fa6c093ac71dc0efd")).toBe("address");
    expect(classifySearchInput("Is this bundled?")).toBe("question");
    expect(classifySearchInput("NASDAQ")).toBe("symbol");
  });
});

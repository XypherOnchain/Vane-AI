"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { isLikelyAddress, isLikelyTx } from "@vane/shared";

export function SearchBox({
  large,
  placeholder = "Paste a token, wallet, or transaction",
}: {
  large?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    if (isLikelyTx(value)) {
      router.push(`/ask?q=${encodeURIComponent(value)}`);
      return;
    }
    if (isLikelyAddress(value)) {
      router.push(`/token/${value.toLowerCase()}`);
      return;
    }
    router.push(`/radar?q=${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={onSubmit} style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          className="field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 220, padding: large ? "1.15rem 1.25rem" : undefined }}
        />
        <button className="btn btn-primary" type="submit">
          Scan Token
        </button>
      </div>
    </form>
  );
}

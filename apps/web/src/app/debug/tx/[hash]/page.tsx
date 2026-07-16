import { redirect } from "next/navigation";

/** Deep-link target: vane://debug/tx/:hash and Telegram “Open in Vane” */
export default async function DebugTxHashPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  redirect(`/debug/tx?hash=${encodeURIComponent(hash)}`);
}

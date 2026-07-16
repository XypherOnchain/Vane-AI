import { redirect } from "next/navigation";

export default async function TransactionRedirect({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  redirect(`/debug/tx?hash=${encodeURIComponent(hash)}`);
}

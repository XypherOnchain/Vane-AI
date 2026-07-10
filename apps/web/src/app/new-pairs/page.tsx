import RadarPage from "../radar/page";

export const dynamic = "force-dynamic";

export default async function NewPairsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  return RadarPage({ searchParams: Promise.resolve({ ...sp, mode: "new-pairs" }) });
}

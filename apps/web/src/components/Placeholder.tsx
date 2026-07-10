export default function Placeholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="px-4 py-12 pb-24 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">{title}</h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

/** Product chrome lives in AppShell — avoid a second header bar. */
export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

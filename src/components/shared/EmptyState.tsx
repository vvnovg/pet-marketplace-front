export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
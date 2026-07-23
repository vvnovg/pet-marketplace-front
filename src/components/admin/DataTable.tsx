"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; }

export function DataTable<T>({
  columns, rows, emptyState, loading, rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyState?: ReactNode;
  loading?: boolean;
  rowClassName?: (row: T) => string;
}) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>;
  }
  if (rows.length === 0) return <>{emptyState ?? null}</>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-left font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-t", rowClassName?.(row))}>
              {columns.map((c) => <td key={c.key} className="px-3 py-2 align-top">{c.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
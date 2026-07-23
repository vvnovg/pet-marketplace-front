"use client";

import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { getStatistics } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStatistics } from "@/types/api";

const BAR_COLOR = "hsl(var(--primary))";

function toData(map: Record<string, number> | undefined, t: (k: string) => string) {
  return Object.entries(map ?? {})
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ name: t(k), value: v as number }))
    .sort((a, b) => b.value - a.value);
}

export default function StatisticsPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const ts = useTranslations("Admin.statistics");
  const tStatus = useTranslations("Status");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<AdminStatistics>({
    queryKey: ["admin", "statistics"],
    queryFn: () => getStatistics(),
    staleTime: 60_000,
  });

  const allZero = (s?: AdminStatistics) =>
    !!s && s.totalUsers === 0 && s.activeUsers === 0 && s.listingsCreatedToday === 0 && s.listingsCreatedThisWeek === 0 && s.listingsCreatedThisMonth === 0
    && Object.values(s.listingsByStatus).every((v) => !v)
    && Object.values(s.bookingsByStatus).every((v) => !v)
    && Object.values(s.reviewsByStatus).every((v) => !v);

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{ts("title")}</h1>
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      </div>
    );
  }

  const tiles = data ? [
    { label: ts("totalUsers"), value: data.totalUsers },
    { label: ts("activeUsers"), value: data.activeUsers },
    { label: ts("listingsToday"), value: data.listingsCreatedToday },
    { label: ts("listingsWeek"), value: data.listingsCreatedThisWeek },
    { label: ts("listingsMonth"), value: data.listingsCreatedThisMonth },
  ] : [];

  const Chart = ({ title, map }: { title: string; map: Record<string, number> | undefined }) => {
    const rows = toData(map, (k) => tStatus(k as never));
    if (rows.length === 0) return null;
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <div style={{ height: Math.max(160, rows.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip cursor={{ fillOpacity: 0.1 }} />
                <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{ts("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["admin", "statistics"] }); refetch(); }}>{tc("refresh")}</Button>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : allZero(data) ? (
        <EmptyState>{tc("empty")}</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{tile.value}</div>
                  <div className="text-xs text-muted-foreground">{tile.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Chart title={ts("listingsByStatus")} map={data.listingsByStatus as Record<string, number>} />
            <Chart title={ts("bookingsByStatus")} map={data.bookingsByStatus as Record<string, number>} />
            <Chart title={ts("reviewsByStatus")} map={data.reviewsByStatus as Record<string, number>} />
          </div>
        </>
      )}
    </div>
  );
}
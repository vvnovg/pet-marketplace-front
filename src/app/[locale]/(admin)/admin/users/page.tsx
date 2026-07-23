"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { getAdminUsers, updateUserStatus, updateUserRole, type AdminUsersParams } from "@/lib/api/endpoints/admin";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/components/auth/useSession";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminUser, Page, Role } from "@/types/api";

const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN", "MODERATOR"];

type Filters = { search: string; role: "" | Role; active: "" | "true" | "false"; verified: "" | "true" | "false"; page: number; size: number };

const readInitial = (): Filters => {
  if (typeof window === "undefined") return { search: "", role: "", active: "", verified: "", page: 0, size: 10 };
  const sp = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => { const v = sp.get(k); return v ? Math.max(0, Number(v) || d) : d; };
  return {
    search: sp.get("search") ?? "",
    role: (sp.get("role") as Filters["role"]) ?? "",
    active: (sp.get("active") as Filters["active"]) ?? "",
    verified: (sp.get("verified") as Filters["verified"]) ?? "",
    page: num("page", 0),
    size: num("size", 10),
  };
};

function initials(u: AdminUser): string {
  const a = (u.firstName ?? "").trim()[0] ?? "";
  const b = (u.lastName ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || (u.email[0] ?? "?").toUpperCase();
}

export default function UsersPage() {
  const t = useTranslations("Admin");
  const tc = useTranslations("Admin.common");
  const tu = useTranslations("Admin.users");
  const qc = useQueryClient();
  const { user: me } = useSession();
  const [filters, setFilters] = useState<Filters>(readInitial);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const queryParams: AdminUsersParams = useMemo(() => ({
    search: debouncedSearch || null,
    role: filters.role || null,
    active: filters.active === "" ? null : filters.active === "true",
    verified: filters.verified === "" ? null : filters.verified === "true",
    page: filters.page,
    size: filters.size,
  }), [debouncedSearch, filters.role, filters.active, filters.verified, filters.page, filters.size]);

  const { data, isLoading, isError, refetch } = useQuery<Page<AdminUser>>({
    queryKey: ["admin", "users", queryParams],
    queryFn: () => getAdminUsers(queryParams),
  });

  // Sync filters to URL (shareable) without navigation/scroll.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (filters.search) sp.set("search", filters.search);
    if (filters.role) sp.set("role", filters.role);
    if (filters.active) sp.set("active", filters.active);
    if (filters.verified) sp.set("verified", filters.verified);
    if (filters.page) sp.set("page", String(filters.page));
    if (filters.size !== 10) sp.set("size", String(filters.size));
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [filters]);

  // Reset to page 0 when filters change (debounced search included).
  useEffect(() => { setFilters((f) => ({ ...f, page: 0 })); }, [debouncedSearch, filters.role, filters.active, filters.verified]);

  const [dialog, setDialog] = useState<{ user: AdminUser; kind: "block" | "unblock" } | null>(null);

  const onMutated = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    setDialog(null);
  };
  const onMutError = (e: unknown) => {
    setDialog(null);
    if (e instanceof ApiError && e.status === 403) toast.error(tc("forbidden"));
    else if (e instanceof ApiError) toast.error(tc("error", { detail: e.detail }));
    else toast.error(tc("error", { detail: "—" }));
  };

  const statusMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { active: boolean; reason?: string } }) => updateUserStatus(id, body),
    onSuccess: () => { toast.success(tc("saved")); onMutated(); },
    onError: onMutError,
  });
  const roleMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role: Role } }) => updateUserRole(id, body),
    onSuccess: () => { toast.success(tc("saved")); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: onMutError,
  });

  const isSelf = (u: AdminUser) => !!me && u.id === me.id;

  const columns: Column<AdminUser>[] = [
    { key: "user", header: tu("colUser"), cell: (u) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(u)}</div>
        <div className="min-w-0">
          <div className="truncate">{u.firstName ?? ""} {u.lastName ?? ""}</div>
          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
        </div>
      </div>
    ) },
    { key: "role", header: tu("colRole"), cell: (u) => (
      isSelf(u) ? <StatusBadge value={u.role} />
      : <Select aria-label={tu("changeRole")} value={u.role} className="h-9 w-36"
          disabled={roleMut.isPending} onChange={(e) => roleMut.mutate({ id: u.id, body: { role: e.target.value as Role } })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
    ) },
    { key: "verified", header: tu("colVerified"), cell: (u) => u.verified ? tc("yes") : tc("no") },
    { key: "active", header: tu("colActive"), cell: (u) => u.active ? tc("yes") : tc("no") },
    { key: "reviews", header: tu("colReviews"), cell: (u) => String(u.totalReviews ?? 0) },
    { key: "created", header: tu("colCreated"), cell: (u) => new Date(u.createdAt).toLocaleDateString() },
    { key: "actions", header: tu("colActions"), cell: (u) => {
      return (
        <Button variant={u.active ? "destructive" : "outline"} size="sm"
          disabled={isSelf(u)}
          onClick={() => setDialog({ user: u, kind: u.active ? "block" : "unblock" })}>
          {u.active ? tu("block") : tu("unblock")}
        </Button>
      );
    } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tu("title")}</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">{t("back")}</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={tu("search")} placeholder={tu("searchPlaceholder")} value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} className="h-9 w-60" />
        <Select aria-label={tu("role")} value={filters.role} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as Filters["role"] }))}>
          <option value="">{tu("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select aria-label={tu("active")} value={filters.active} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value as Filters["active"] }))}>
          <option value="">{tu("allActive")}</option>
          <option value="true">{tc("yes")}</option>
          <option value="false">{tc("no")}</option>
        </Select>
        <Select aria-label={tu("verified")} value={filters.verified} className="h-9 w-36"
          onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value as Filters["verified"] }))}>
          <option value="">{tu("allVerified")}</option>
          <option value="true">{tc("yes")}</option>
          <option value="false">{tc("no")}</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", role: "", active: "", verified: "", page: 0, size: 10 })}>{tc("resetFilters")}</Button>
      </div>

      {isError ? (
        <EmptyState><div className="space-y-2"><div>{tc("loadingError")}</div><Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button></div></EmptyState>
      ) : (
        <DataTable<AdminUser> columns={columns} rows={data?.content ?? []} loading={isLoading}
          rowClassName={(u) => (u.active ? "" : "opacity-60")}
          emptyState={<EmptyState>{tc("empty")}</EmptyState>} />
      )}

      {data ? <Pagination page={data} onPageChange={(n) => setFilters((f) => ({ ...f, page: n }))} onSizeChange={(s) => setFilters((f) => ({ ...f, size: s, page: 0 }))} /> : null}

      <ConfirmModerationDialog
        open={!!dialog}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog?.kind === "block" ? "block" : "unblock"}
        submitting={statusMut.isPending}
        requireReason={dialog?.kind === "block"}
        title={dialog?.kind === "block" ? tu("confirmBlockTitle") : tu("confirmUnblockTitle")}
        description={dialog?.kind === "block" ? (dialog.user.role === "ADMIN" ? tu("blockAdminWarn") + " " + tu("confirmBlockDesc") : tu("confirmBlockDesc")) : undefined}
        onConfirm={(reason) => {
          if (!dialog) return;
          statusMut.mutate({ id: dialog.user.id, body: { active: dialog.kind === "unblock", reason } });
        }}
      />
    </div>
  );
}
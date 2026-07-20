"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n";
import { locales, type Locale } from "@/lib/i18n/config";

export function LocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      aria-label="locale"
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
      className="border rounded px-2 py-1"
    >
      {locales.map((l) => (
        <option key={l} value={l}>{l.toUpperCase()}</option>
      ))}
    </select>
  );
}
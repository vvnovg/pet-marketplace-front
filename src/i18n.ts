import { createNavigation } from "next-intl/navigation";
import { locales } from "@/lib/i18n/config";
export const localePrefix = "always" as const;
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation({ locales, localePrefix });
import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";
import type { Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const l = ((await requestLocale) as Locale | undefined) ?? defaultLocale;
  return {
    locale: l,
    messages: (await import(`../../messages/${l}.json`)).default,
  };
});
import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";
import type { Locale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  const l = (locale as Locale) ?? defaultLocale;
  return {
    locale: l,
    messages: (await import(`../../messages/${l}.json`)).default,
  };
});
import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Link href="/" className="text-primary underline mt-4 inline-block">{t("back")}</Link>
    </div>
  );
}
import { useTranslations } from "next-intl";
export default function Home() {
  const t = useTranslations("Home");
  return <h1 className="text-2xl font-bold">{t("welcome")}</h1>;
}
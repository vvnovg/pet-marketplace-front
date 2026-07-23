import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { LocaleSwitch } from "./LocaleSwitch";
import { UserMenu } from "./UserMenu";

export function Header() {
  const t = useTranslations("Nav");
  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold text-lg">PetMarketplace</Link>
        <nav className="flex items-center gap-4">
          <Link href="/catalog">{t("catalog")}</Link>
          <UserMenu />
          <LocaleSwitch />
        </nav>
      </div>
    </header>
  );
}
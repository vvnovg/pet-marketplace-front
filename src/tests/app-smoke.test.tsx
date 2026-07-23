import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import Home from "@/app/[locale]/page";
import ru from "@/messages/ru.json";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next-intl/navigation", () => ({}));

describe("Home", () => {
  it("renders the localized welcome title and catalog CTA", () => {
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        <Home />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Маркетплейс животных")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Перейти в каталог" })).toHaveAttribute("href", "/catalog");
  });
});
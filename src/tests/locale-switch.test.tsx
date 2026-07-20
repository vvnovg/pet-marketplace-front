import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({ useLocale: () => "ru" }));
const replace = vi.fn();
vi.mock("@/i18n", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));
vi.mock("@/lib/i18n/config", () => ({ locales: ["ru", "en"] }));

import { LocaleSwitch } from "@/components/layout/LocaleSwitch";

describe("LocaleSwitch", () => {
  it("renders options for ru and en", () => {
    render(<LocaleSwitch />);
    expect(screen.getByLabelText("locale")).toBeInTheDocument();
    expect(screen.getByText("RU")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });
  it("calls router.replace with chosen locale", async () => {
    render(<LocaleSwitch />);
    await userEvent.selectOptions(screen.getByLabelText("locale"), "en");
    expect(replace).toHaveBeenCalledWith("/", { locale: "en" });
  });
});
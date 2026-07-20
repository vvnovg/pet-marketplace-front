import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import Home from "@/app/[locale]/page";
import ru from "@/messages/ru.json";

describe("Home", () => {
  it("renders the localized welcome title", () => {
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        <Home />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Маркетплейс животных")).toBeInTheDocument();
  });
});
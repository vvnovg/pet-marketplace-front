import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ru from "@/messages/ru.json";
import { ListingCard } from "@/components/catalog/ListingCard";
import { ImageGallery } from "@/components/catalog/ImageGallery";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
import { BookingDialog } from "@/components/catalog/BookingDialog";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/listings/l1",
}));
vi.mock("next-intl/navigation", () => ({}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); server.close(); });

const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (node: React.ReactNode, user: { id: string; role: string } | null = { id: "me", role: "BUYER" }) => render(
  <QueryClientProvider client={mkQc()}>
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SessionContext.Provider value={{ user: user as never, status: user ? "authenticated" : "unauthenticated" }}>
        {node}
      </SessionContext.Provider>
    </NextIntlClientProvider>
  </QueryClientProvider>,
);

const imgs = () => document.body.querySelectorAll("img");

describe("ListingCard", () => {
  it("renders title, price, image and links to detail", () => {
    render(<NextIntlClientProvider locale="ru" messages={ru}><ListingCard id="l1" title="Kitten" price="100" currency="USD" locationCity="Moscow" mainImageUrl="/img.jpg" status="ACTIVE" /></NextIntlClientProvider>);
    expect(screen.getByText("Kitten")).toBeInTheDocument();
    expect(screen.getByText("100 USD")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/listings/l1");
  });
});

describe("ImageGallery", () => {
  it("renders main image and switches on thumbnail click", async () => {
    const user = userEvent.setup();
    render(<NextIntlClientProvider locale="ru" messages={ru}><ImageGallery images={[
      { id: "i1", url: "/a.jpg", orderIndex: 0, isMain: true },
      { id: "i2", url: "/b.jpg", orderIndex: 1, isMain: false },
    ]} /></NextIntlClientProvider>);
    expect(imgs()[0]).toHaveAttribute("src", "/a.jpg");
    await user.click(screen.getAllByRole("button")[1]!);
    expect(imgs()[0]).toHaveAttribute("src", "/b.jpg");
  });

  it("renders placeholder when no images", () => {
    render(<NextIntlClientProvider locale="ru" messages={ru}><ImageGallery images={[]} /></NextIntlClientProvider>);
    expect(imgs().length).toBe(0);
  });
});

describe("FavoriteButton", () => {
  it("shows login prompt for guest", () => {
    render(<NextIntlClientProvider locale="ru" messages={ru}><QueryClientProvider client={mkQc()}><SessionContext.Provider value={{ user: null, status: "unauthenticated" }}><FavoriteButton listingId="l1" /></SessionContext.Provider></QueryClientProvider></NextIntlClientProvider>);
    expect(screen.getByText(ru.Listing.loginToFav)).toBeInTheDocument();
  });

  it("toggles favorite for logged user", async () => {
    let favoritesData: unknown[] = [{ id: "f1", listing: { id: "l1", title: "t", price: "1", currency: "USD", locationCity: null, mainImageUrl: null, status: "ACTIVE" }, createdAt: "t" }];
    server.use(
      http.get("*/api/proxy/favorites", () => HttpResponse.json(favoritesData)),
      http.delete("*/api/proxy/favorites/:id", () => { favoritesData = []; return new HttpResponse(null, { status: 204 }); }),
    );
    const user = userEvent.setup();
    wrap(<FavoriteButton listingId="l1" />);
    expect(await screen.findByText(ru.Listing.removeFromFavorites)).toBeInTheDocument();
    await user.click(screen.getByText(ru.Listing.removeFromFavorites));
    await waitFor(() => expect(screen.getByText(ru.Listing.addToFavorites)).toBeInTheDocument());
  });
});

function BookingDialogStateful({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  return <BookingDialog listingId={listingId} open={open} onOpenChange={setOpen} />;
}

describe("BookingDialog", () => {
  it("creates booking on submit", async () => {
    let booked = false;
    server.use(http.post("*/api/proxy/listings/:id/book", () => { booked = true; return HttpResponse.json({ id: "b1", status: "PENDING" }); }));
    const user = userEvent.setup();
    wrap(<BookingDialogStateful listingId="l1" />);
    await user.click(screen.getByText(ru.Listing.book));
    await user.click(screen.getByText(ru.Listing.bookingSubmit));
    await waitFor(() => expect(booked).toBe(true));
  });
});
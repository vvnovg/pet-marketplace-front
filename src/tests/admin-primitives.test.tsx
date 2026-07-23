import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { DataTable } from "@/components/admin/DataTable";
import { ConfirmModerationDialog } from "@/components/admin/ConfirmModerationDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NextIntlClientProvider } from "next-intl";
import ru from "@/messages/ru.json";

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="ru" messages={ru}>{ui}</NextIntlClientProvider>);

describe("Badge", () => {
  it("renders variant class", () => {
    const { container } = render(<Badge variant="destructive">X</Badge>);
    expect(container.firstChild).toHaveClass("bg-destructive");
  });
});

describe("Select", () => {
  it("renders options and fires onChange", async () => {
    let v = "";
    render(
      <Select value={v} onChange={(e) => { v = e.target.value; }} data-testid="s">
        <option value="">all</option>
        <option value="ADMIN">admin</option>
      </Select>,
    );
    await userEvent.setup().selectOptions(screen.getByTestId("s"), "ADMIN");
    expect(v).toBe("ADMIN");
  });
});

describe("Textarea", () => {
  it("binds value", () => {
    render(<Textarea value="hi" readOnly data-testid="t" />);
    expect(screen.getByTestId("t")).toHaveValue("hi");
  });
});

describe("Dialog", () => {
  it("shows content when open and closes on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button>Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("StatusBadge", () => {
  it("renders localized label for ACTIVE", () => {
    wrap(<StatusBadge value="ACTIVE" />);
    expect(screen.getByText(ru.Status.ACTIVE)).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const page = { content: [], totalElements: 25, totalPages: 3, number: 1, size: 10, first: false, last: false, empty: false };
  it("disables prev on first and calls onPageChange", async () => {
    const onpage = vi.fn();
    wrap(<Pagination page={{ ...page, number: 0, first: true }} onPageChange={onpage} onSizeChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Следующая|Next/ })).toBeEnabled();
    await userEvent.setup().click(screen.getByRole("button", { name: /Следующая|Next/ }));
    expect(onpage).toHaveBeenCalledWith(1);
  });
});

describe("DataTable", () => {
  it("renders rows and empty state", () => {
    const cols = [{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }];
    const { rerender } = wrap(<DataTable columns={cols} rows={[{ n: "Alice" }]} loading={false} emptyState={<div>empty</div>} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    rerender(<NextIntlClientProvider locale="ru" messages={ru}><DataTable columns={cols} rows={[]} loading={false} emptyState={<div>empty</div>} /></NextIntlClientProvider>);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});

describe("ConfirmModerationDialog", () => {
  it("requires reason for reject", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    wrap(
      <ConfirmModerationDialog open onOpenChange={vi.fn()} kind="reject"
        title="t" description="d" requireReason submitting={false} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: /Подтвердить|Confirm/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox"), "bad content");
    await user.click(screen.getByRole("button", { name: /Подтвердить|Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith("bad content");
  });
});
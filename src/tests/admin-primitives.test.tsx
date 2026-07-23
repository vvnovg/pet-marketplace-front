import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Checkbox } from "@/components/ui";

function Harness() {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      id="diet-keto"
      label="Keto"
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
    />
  );
}

describe("Checkbox", () => {
  it("toggles when clicking the visible checkbox square", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Checkbox id="diet-test" label="Vegan" checked={false} onChange={onChange} />,
    );
    // The visible styled square is the first span inside the wrapping label
    const box = container.querySelector("label > span");
    expect(box).not.toBeNull();
    fireEvent.click(box!);
    expect(onChange).toHaveBeenCalled();
  });

  it("toggles when clicking the label text", () => {
    const onChange = vi.fn();
    render(<Checkbox id="diet-test2" label="Halal" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText("Halal"));
    expect(onChange).toHaveBeenCalled();
  });

  it("controlled harness flips checked state via the label", () => {
    render(<Harness />);
    const input = screen.getByRole("checkbox", { name: "Keto" }) as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.click(screen.getByText("Keto"));
    expect(input.checked).toBe(true);
  });
});

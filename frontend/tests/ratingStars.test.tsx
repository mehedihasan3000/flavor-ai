import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RatingStars } from "../src/components/recipes/rating-stars";

describe("RatingStars", () => {
  it("renders a clipped overlay at the fractional width with full-size stars", () => {
    const { container } = render(<RatingStars value={4} count={1} size="sm" />);

    // Overlay is the absolutely-positioned row clipped to 4/5 = 80%.
    const overlay = container.querySelector("span.absolute");
    expect(overlay).not.toBeNull();
    expect((overlay as HTMLElement).style.width).toBe("80%");

    // Every overlay star must keep its size (shrink-0) so it aligns exactly
    // with the gray base row instead of squeezing into the percent width,
    // and carry the filled amber color (text-*, not fill-*: the Star path is
    // fill="currentColor", so fill-* classes never recolor it).
    const overlayStars = overlay!.querySelectorAll("svg");
    expect(overlayStars).toHaveLength(5);
    for (const star of overlayStars) {
      expect(star).toHaveClass("shrink-0");
      expect(star).toHaveClass("text-amber-400");
    }

    const baseStars = container.querySelectorAll("span.relative > span:not(.absolute) > svg");
    expect(baseStars).toHaveLength(5);
    for (const star of baseStars) {
      expect(star).toHaveClass("text-border-strong");
    }

    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Rated 4.0 out of 5 stars, 1 rating",
    );
  });

  it("renders an empty overlay for unrated recipes", () => {
    const { container } = render(<RatingStars value={0} count={0} size="sm" />);
    const overlay = container.querySelector("span.absolute");
    expect((overlay as HTMLElement | null)?.style.width).toBe("0%");
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("calls onRate with the clicked star in interactive mode", () => {
    const onRate = vi.fn();
    render(<RatingStars value={0} interactive onRate={onRate} />);

    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it("fills the selected stars amber and leaves the rest unfilled", () => {
    render(<RatingStars value={3} interactive onRate={vi.fn()} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    radios.forEach((radio, index) => {
      const star = radio.querySelector("svg");
      expect(star).not.toBeNull();
      if (index < 3) {
        expect(star).toHaveClass("text-amber-400");
      } else {
        expect(star).toHaveClass("text-border-strong");
      }
    });
  });

  it("disables the picker while a rating is submitting", () => {
    const onRate = vi.fn();
    render(<RatingStars value={0} interactive disabled onRate={onRate} />);

    const radio = screen.getByRole("radio", { name: "3 stars" });
    expect(radio).toBeDisabled();
    fireEvent.click(radio);
    expect(onRate).not.toHaveBeenCalled();
  });
});

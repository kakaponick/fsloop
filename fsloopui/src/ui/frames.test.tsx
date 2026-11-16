// @vitest-environment jsdom
import "./test-setup.ts";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { FrameStrip, THUMB, WHEEL_GESTURE_GAP, type Frame } from "./frames.tsx";
import { renderUi } from "./test-utils.tsx";

// The production shape: 8 frames of a run, each about 104 kB on disk (common.md → Map).
const frames: Frame[] = Array.from({ length: 8 }, (_, i) => ({ src: `/api/frame/p1-final-${i}.png`, name: `p1-final-${i}.png` }));

const title = () => screen.getByRole("dialog").querySelector('[data-slot="dialog-title"]')?.textContent;

describe("frames", () => {
  test("a thumbnail reserves its box before the image loads", () => {
    renderUi(<FrameStrip frames={frames} />);
    const thumbs = screen.getAllByRole("button", { name: /^Открыть кадр / });
    expect(thumbs).toHaveLength(8);
    for (const thumb of thumbs) {
      expect(thumb).toHaveClass("h-thumb-h", "w-thumb-w", "shrink-0");
      const img = thumb.querySelector("img")!;
      expect(img).toHaveAttribute("width", String(THUMB.width));
      expect(img).toHaveAttribute("height", String(THUMB.height));
      expect(img).toHaveAttribute("loading", "lazy");
    }
  });

  test("the viewer opens over the page named by its file and steps by ‹ ›, ←/→ and the wheel, stopping at the ends", async () => {
    let t = 1000;
    const user = userEvent.setup();
    renderUi(<FrameStrip frames={frames} now={() => t} />);
    await user.click(screen.getByRole("button", { name: "Открыть кадр p1-final-0.png" }));
    expect(title()).toBe("p1-final-0.png");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 из 8 кадров");
    expect(screen.getByRole("dialog").querySelector('[data-slot="frame-stage"]')).toHaveFocus();
    expect(screen.getByRole("dialog").querySelector('[data-slot="frame-stage"]')).toHaveClass("h-stage-h", "w-stage-w");

    await user.keyboard("{ArrowRight}");
    expect(title()).toBe("p1-final-1.png");

    const stage = screen.getByRole("dialog").querySelector('[data-slot="frame-stage"]')!;
    fireEvent.wheel(stage, { deltaY: 120 });
    fireEvent.wheel(stage, { deltaY: 120 });
    expect(title()).toBe("p1-final-2.png");
    t += WHEEL_GESTURE_GAP + 1;
    fireEvent.wheel(stage, { deltaY: 120 });
    expect(title()).toBe("p1-final-3.png");
    t += WHEEL_GESTURE_GAP + 1;
    fireEvent.wheel(stage, { deltaY: -80 });
    expect(title()).toBe("p1-final-2.png");

    await user.click(screen.getByRole("button", { name: "Предыдущий кадр" }));
    await user.click(screen.getByRole("button", { name: "Предыдущий кадр" }));
    await user.click(screen.getByRole("button", { name: "Предыдущий кадр" }));
    expect(title()).toBe("p1-final-0.png");
    expect(screen.getByRole("button", { name: "Предыдущий кадр" })).toHaveAttribute("aria-disabled", "true");

    for (let i = 0; i < 9; i++) await user.click(screen.getByRole("button", { name: "Следующий кадр" }));
    expect(title()).toBe("p1-final-7.png");
    expect(screen.getByRole("dialog")).toHaveTextContent("8 из 8 кадров");
  });

  test("Escape closes the viewer and focus returns to the thumbnail that opened it", async () => {
    const user = userEvent.setup();
    renderUi(<FrameStrip frames={frames} />);
    const thumb = screen.getByRole("button", { name: "Открыть кадр p1-final-3.png" });
    await user.click(thumb);
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(thumb).toHaveFocus();
  });

  test("past the limit, «ещё N кадров» opens the viewer on the first frame it hides", async () => {
    const user = userEvent.setup();
    renderUi(<FrameStrip frames={frames} limit={5} />);
    expect(screen.getAllByRole("button", { name: /^Открыть кадр / })).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "ещё 3 кадра" }));
    expect(title()).toBe("p1-final-5.png");
  });
});

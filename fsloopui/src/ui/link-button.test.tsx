// @vitest-environment jsdom
// p3-verdict-critic-code-verdict-2#code-2: a button drawn as a link is one shared part of `@/ui` — the reader's jumps,
// «показать все», a clamp's «развернуть» / «свернуть», «свернуть» under the run header's «Ждёт вас» — never a view's
// own copy of the library's link variant.
import "./test-setup.ts";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { applyStylesheet } from "../app/layout-testing.ts";
import { LinkButton } from "./index.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every source file under `src/`, but the library's own components and the tests. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "components" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("LinkButton", () => {
  test("p3-verdict-critic-code-verdict-2#code-2: one part, exported from `@/ui` — underlined at rest like every link, regular weight, no padding of its own", async () => {
    render(
      <p className="text-sm">
        Перейти: <LinkButton onClick={() => undefined}>Расход токенов</LinkButton>
      </p>,
    );
    const button = screen.getByRole("button", { name: "Расход токенов" });
    await applyStylesheet();
    const s = getComputedStyle(button);
    expect(s.textDecorationLine).toBe("underline");
    expect(s.fontWeight).toBe("400");
    expect(s.paddingLeft).toBe("0px");
    expect(s.paddingRight).toBe("0px");
    expect(s.height).toBe("auto");
  });

  test("p3-verdict-critic-code-verdict-2#code-2: no file draws its own `Button variant=\"link\"` — the link button is the one", () => {
    const own = sources(SRC)
      .filter((file) => !file.endsWith("link-button.tsx"))
      .filter((file) => /variant="link"/.test(readFileSync(file, "utf8").replace(/\r\n/g, "\n")))
      .map((file) => relative(SRC, file).replace(/\\/g, "/"));
    expect(own).toEqual([]);
  });
});

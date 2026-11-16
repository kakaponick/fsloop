// The running-text renderer (rules/ui → Layout 5): a finding's rule, observation and fix, a report's sections, a
// journal entry and a goal keep their form — paragraphs, line breaks, bullet and numbered lists, headings, inline
// code and bold — at a capped reading measure. A markdown table or a code block scrolls sideways in its own
// bounded container. Ids become links only through the resolver the caller gives. The text is parsed into React
// elements, never into HTML: a tag in the text is shown as text. A view that searches the text passes the search's
// hit painter (`highlight`), so its hits wear the table's one mark; punctuation right after inline code keeps to it.
// A caller that draws a code span its own way — a convention's place as its copy button — does it through
// `renderCode`, the renderer's seam for code; the link seam stays for links.
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The address of an id the text names, or null when the token is not an id of this run. */
export type Resolve = (token: string) => string | null;

export interface RunningTextProps {
  text: string | null | undefined;
  resolve?: Resolve;
  /** Renders a resolved link; a plain anchor by default (the app passes its router's link). */
  renderLink?: (href: string, children: ReactNode, token: string) => ReactNode;
  /** Off where the container already caps the measure. */
  measure?: boolean;
  /** Paints the search's hits in a run of the text: the table's `Highlight`, the one hit painter (table #12). */
  highlight?: Paint;
  /** A code span the caller renders itself — a place as a copy button — given its text and the code element as
   * drawn; null leaves the span to the renderer (a link when the resolver knows it, else plain code). */
  renderCode?: RenderCode;
  className?: string;
}

/** The caller's own node for a code span, or null to leave it as it is. */
export type RenderCode = (body: string, code: ReactNode) => ReactNode | null;

/** Renders a run of plain text, its hits marked. */
export type Paint = (text: string) => ReactNode;

type Inline = string;
type ListItem = { depth: number; lines: Inline[] };
type Block =
  | { kind: "p"; lines: Inline[] }
  | { kind: "h"; level: 3 | 4; text: Inline }
  | { kind: "ul" | "ol"; start: number; items: ListItem[] }
  | { kind: "table"; head: Inline[]; rows: Inline[][] }
  | { kind: "code"; text: string };

const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const FENCE = /^\s*```/;

/** A table row's cells; `\|` stays a bar inside a cell. */
function cells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** Splits text into blocks; exported for the tests. */
export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const last = () => blocks[blocks.length - 1];
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length <= 2 ? 3 : 4, text: heading[2].trim() });
      i++;
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const depth = Math.floor((bullet ?? numbered)![1].replace(/\t/g, "  ").length / 2);
      const content = bullet ? bullet[2] : numbered![3];
      const prev = last();
      if (prev && prev.kind === kind && blocks.length && lines[i - 1]?.trim() !== "") prev.items.push({ depth, lines: [content] });
      else blocks.push({ kind, start: numbered ? Number(numbered[2]) : 1, items: [{ depth, lines: [content] }] });
      i++;
      continue;
    }
    const prev = last();
    // An indented line right under a list item continues it, its line break kept.
    if (prev && (prev.kind === "ul" || prev.kind === "ol") && /^\s{2,}\S/.test(line) && lines[i - 1]?.trim() !== "") {
      prev.items[prev.items.length - 1].lines.push(line.trim());
      i++;
      continue;
    }
    if (prev && prev.kind === "p" && lines[i - 1]?.trim() !== "") prev.lines.push(line.trim());
    else blocks.push({ kind: "p", lines: [line.trim()] });
    i++;
  }
  return blocks;
}

const ID_TOKEN = /[A-Za-z0-9][A-Za-z0-9_./:-]*(?:#[A-Za-z0-9_.-]+)?/g;
const MARKS = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
/** Punctuation that closes on the word before it: right after inline code it keeps to the code, with no gap. */
const CLOSING = /^[.,;:!?)\]»…]+/;

type InlineOpts = { resolve?: Resolve; renderLink: NonNullable<RunningTextProps["renderLink"]>; paint: Paint; renderCode?: RenderCode };

const defaultLink = (href: string, children: ReactNode) => (
  <a href={href} className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground">
    {children}
  </a>
);

function Inline({ text, resolve, renderLink, paint, renderCode }: { text: string } & InlineOpts) {
  const linked = (plain: string, key: string): ReactNode => {
    if (!resolve) return paint(plain);
    const out: ReactNode[] = [];
    let at = 0;
    for (const m of plain.matchAll(ID_TOKEN)) {
      const token = m[0].replace(/[.:]+$/, "");
      const href = resolve(token);
      if (!href) continue;
      out.push(<Fragment key={`${key}-p${at}`}>{paint(plain.slice(at, m.index))}</Fragment>);
      out.push(<Fragment key={`${key}-${m.index}`}>{renderLink(href, paint(token), token)}</Fragment>);
      at = m.index + token.length;
    }
    out.push(<Fragment key={`${key}-p${at}`}>{paint(plain.slice(at))}</Fragment>);
    return out;
  };
  const parts: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(MARKS)) {
    parts.push(<Fragment key={`t${at}`}>{linked(text.slice(at, m.index), `t${at}`)}</Fragment>);
    at = m.index + m[0].length;
    if (m[1]) {
      const body = m[1].slice(1, -1);
      // punctuation that closes on the code keeps to it: no right padding, no line break between them (cand-15)
      const closing = CLOSING.exec(text.slice(at))?.[0] ?? "";
      const code = (
        <code data-slot="inline-code" className={cn("rounded-sm bg-code font-mono text-xs", closing ? "pr-0 pl-1" : "px-1")}>
          {paint(body)}
        </code>
      );
      const own = renderCode?.(body, code) ?? null;
      const href = own === null ? (resolve?.(body) ?? null) : null;
      const linkedCode = own ?? (href ? renderLink(href, code, body) : code);
      parts.push(
        closing ? (
          <span key={`c${m.index}`} className="whitespace-nowrap">
            {linkedCode}
            {paint(closing)}
          </span>
        ) : (
          <Fragment key={`c${m.index}`}>{linkedCode}</Fragment>
        ),
      );
      at += closing.length;
    } else {
      parts.push(<strong key={`b${m.index}`} className="font-semibold">{linked(m[2].slice(2, -2), `b${m.index}`)}</strong>);
    }
  }
  parts.push(<Fragment key={`t${at}`}>{linked(text.slice(at), `t${at}`)}</Fragment>);
  return <>{parts}</>;
}

const plainText: Paint = (text) => text;

function Lines({ lines, ...rest }: { lines: string[] } & InlineOpts) {
  return (
    <>
      {lines.map((line, n) => (
        <Fragment key={n}>
          {n > 0 && <br />}
          <Inline text={line} {...rest} />
        </Fragment>
      ))}
    </>
  );
}

const INDENT = ["", "ml-5", "ml-10", "ml-15"];

export function RunningText({ text, resolve, renderLink = defaultLink, measure = true, highlight = plainText, renderCode, className }: RunningTextProps) {
  const blocks = parseBlocks(text ?? "");
  const inline: InlineOpts = { resolve, renderLink, paint: highlight, renderCode };
  return (
    <div data-slot="running-text" className={cn("flex min-w-0 flex-col gap-2 text-sm break-words", measure && "max-w-measure", className)}>
      {blocks.map((block, n) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={n} className="m-0">
                <Lines lines={block.lines} {...inline} />
              </p>
            );
          case "h":
            return block.level === 3 ? (
              <h3 key={n} className="m-0 mt-2 text-base font-semibold first:mt-0">
                <Inline text={block.text} {...inline} />
              </h3>
            ) : (
              <h4 key={n} className="m-0 mt-1 text-sm font-semibold first:mt-0">
                <Inline text={block.text} {...inline} />
              </h4>
            );
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List key={n} start={block.kind === "ol" && block.start !== 1 ? block.start : undefined} className={cn("m-0 flex flex-col gap-1 pl-5", block.kind === "ul" ? "list-disc" : "list-decimal")}>
                {block.items.map((item, k) => (
                  <li key={k} className={cn("pl-0.5 marker:text-muted-foreground", INDENT[Math.min(item.depth, 3)])}>
                    <Lines lines={item.lines} {...inline} />
                  </li>
                ))}
              </List>
            );
          }
          case "table":
            return (
              <div key={n} role="region" aria-label="Таблица" tabIndex={0} className="max-w-full overflow-x-auto rounded-md border [scrollbar-gutter:stable]">
                <table className="w-max min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {block.head.map((cell, k) => (
                        <th key={k} scope="col" className="border-b px-2 py-1.5 text-left align-bottom text-xs font-normal text-muted-foreground">
                          <Inline text={cell} {...inline} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b last:border-b-0">
                        {row.map((cell, k) => (
                          <td key={k} className="max-w-md px-2 py-1.5 align-top">
                            <Inline text={cell} {...inline} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre key={n} tabIndex={0} className="m-0 max-w-full overflow-x-auto rounded-md bg-code px-3 py-2 font-mono text-xs [scrollbar-gutter:stable]">
                <code>{block.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}

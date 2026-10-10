import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const [basePath, oursPath, theirsPath, label = oursPath] = process.argv.slice(2);

function parse(text) {
  let i = 0;
  const ws = () => {
    while (i < text.length && " \t\r\n".includes(text[i])) i++;
  };
  const fail = (what) => {
    throw new Error(`${label}: ${what} at ${i}`);
  };
  const string = () => {
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (text[i] !== '"') fail("unterminated string");
    i++;
    const raw = text.slice(start, i);
    return { type: "scalar", raw, value: JSON.parse(raw) };
  };
  const container = (open, close, member) => {
    const start = i++;
    const items = [];
    ws();
    if (text[i] === close) {
      i++;
    } else {
      for (;;) {
        items.push(member());
        ws();
        if (text[i] === ",") {
          i++;
          ws();
          continue;
        }
        if (text[i] === close) {
          i++;
          break;
        }
        fail(`expected , or ${close}`);
      }
    }
    return { items, inline: !text.slice(start, i).includes("\n") };
  };
  const value = () => {
    ws();
    const c = text[i];
    if (c === '"') return string();
    if (c === "{") {
      const keys = new Set();
      const { items, inline } = container("{", "}", () => {
        if (text[i] !== '"') fail("expected key");
        const key = string();
        if (keys.has(key.value)) fail(`duplicate key ${key.raw}`);
        keys.add(key.value);
        ws();
        if (text[i++] !== ":") fail("expected :");
        return [key, value()];
      });
      return { type: "object", inline, entries: items };
    }
    if (c === "[") {
      const { items, inline } = container("[", "]", value);
      return { type: "array", inline, items };
    }
    const m = /-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null/y;
    m.lastIndex = i;
    const hit = m.exec(text);
    if (!hit) fail("unexpected token");
    i = m.lastIndex;
    return { type: "scalar", raw: hit[0], value: JSON.parse(hit[0]) };
  };
  if (text.trim() === "") return { type: "object", inline: false, entries: [] };
  const root = value();
  ws();
  if (i !== text.length) fail("trailing content");
  return root;
}

function plain(node) {
  if (node === undefined) return undefined;
  if (node.type === "scalar") return node.value;
  if (node.type === "array") return node.items.map(plain);
  return node.entries.map(([k, v]) => [k.value, plain(v)]);
}

function same(a, b) {
  return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

function style(text) {
  return {
    eol: text.includes("\r\n") ? "\r\n" : "\n",
    indent: /^[ \t]+(?=["{[\]}])/m.exec(text)?.[0] ?? "  ",
    trailing: /\r?\n$/.test(text),
  };
}

function render(node, s, depth = 0, inline = false) {
  if (node.type === "scalar") return node.raw;
  const flat = inline || node.inline;
  const parts =
    node.type === "object"
      ? node.entries.map(([k, v]) => `${k.raw}: ${render(v, s, depth + 1, flat)}`)
      : node.items.map((v) => render(v, s, depth + 1, flat));
  const [open, close] = node.type === "object" ? ["{", "}"] : ["[", "]"];
  if (parts.length === 0) return open + close;
  if (flat) return node.type === "object" ? `${open} ${parts.join(", ")} ${close}` : `${open}${parts.join(", ")}${close}`;
  const pad = s.indent.repeat(depth + 1);
  return `${open}${s.eol}${pad}${parts.join(`,${s.eol}${pad}`)}${s.eol}${s.indent.repeat(depth)}${close}`;
}

function print(node, s) {
  return render(node, s) + (s.trailing ? s.eol : "");
}

const conflicts = [];

function entryMap(node) {
  return new Map(node?.type === "object" ? node.entries.map(([k, v]) => [k.value, [k, v]]) : []);
}

function mergeObjects(base, ours, theirs, path) {
  const b = entryMap(base);
  const o = entryMap(ours);
  const t = entryMap(theirs);
  const order = [...o.keys()];
  const theirKeys = [...t.keys()];
  theirKeys.forEach((key, index) => {
    if (o.has(key)) return;
    const previous = theirKeys.slice(0, index).reverse().find((k) => order.includes(k));
    let at = previous === undefined ? 0 : order.indexOf(previous) + 1;
    while (at < order.length && !b.has(order[at]) && !t.has(order[at])) at++;
    order.splice(at, 0, key);
  });
  const entries = [];
  for (const key of order) {
    const merged = merge(b.get(key)?.[1], o.get(key)?.[1], t.get(key)?.[1], `${path}.${key}`);
    if (merged !== undefined) entries.push([(o.get(key) ?? t.get(key))[0], merged]);
  }
  return { type: "object", inline: ours.inline, entries };
}

function merge(base, ours, theirs, path) {
  if (same(ours, theirs)) return ours;
  if (same(base, ours)) return theirs;
  if (same(base, theirs)) return ours;
  if (ours?.type === "object" && theirs?.type === "object") return mergeObjects(base, ours, theirs, path);
  conflicts.push(path);
  return ours;
}

try {
  const texts = [basePath, oursPath, theirsPath].map((p) => readFileSync(p, "utf8"));
  const trees = texts.map((text) => {
    const tree = parse(text);
    if (text.trim() !== "" && print(tree, style(text)) !== text) {
      throw new Error(`${label}: layout this driver cannot reproduce`);
    }
    return tree;
  });
  const merged = merge(trees[0], trees[1], trees[2], "$");
  writeFileSync(oursPath, print(merged, style(texts[1])));
  if (conflicts.length > 0) {
    process.stderr.write(`${label}: conflicting keys ${conflicts.join(", ")}\n`);
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

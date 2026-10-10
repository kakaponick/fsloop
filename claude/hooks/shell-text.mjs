const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/;
const PREFIX = /^(sudo|exec|command|env|[A-Za-z_][A-Za-z0-9_]*=.*)$/;
const ESCAPABLE = new Set([" ", "\t", "\n", '"', "'", "\\", "|", "&", ";", ">"]);

function withoutHeredocBodies(command) {
  const lines = String(command).split("\n");
  const kept = [];
  let terminator = null;
  for (const line of lines) {
    if (terminator) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    const m = HEREDOC.exec(line);
    kept.push(m ? line.replace(HEREDOC, "") : line);
    if (m) terminator = m[2];
  }
  return kept.join("\n");
}

export function commandSegments(command) {
  const text = withoutHeredocBodies(command);
  const segments = [];
  let tokens = [];
  let current = "";
  let open = false;
  let quote = null;
  const endToken = () => {
    if (open) tokens.push(current);
    current = "";
    open = false;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length) segments.push(tokens);
    tokens = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && (text[i + 1] === '"' || text[i + 1] === "\\")) current += text[++i];
      else current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      open = true;
      continue;
    }
    if (c === "\\" && ESCAPABLE.has(text[i + 1])) {
      if (text[i + 1] !== "\n") {
        current += text[i + 1];
        open = true;
      }
      i++;
      continue;
    }
    if (c === "\n" || c === ";" || c === "|" || c === "&") {
      endSegment();
      while (text[i + 1] === c) i++;
      continue;
    }
    if (c === ">") {
      if (open && /^\d$/.test(current)) {
        current = "";
        open = false;
      } else endToken();
      let redirect = ">";
      if (text[i + 1] === ">") {
        redirect = ">>";
        i++;
      }
      tokens.push(redirect);
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      endToken();
      continue;
    }
    current += c;
    open = true;
  }
  endSegment();
  return segments;
}

export function verbOf(tokens) {
  let i = 0;
  while (i < tokens.length && PREFIX.test(tokens[i])) i++;
  return { verb: tokens[i] ?? "", args: tokens.slice(i + 1) };
}

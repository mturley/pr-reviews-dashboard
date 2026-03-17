// Convert Atlassian Document Format (ADF) to GitHub-Flavored Markdown.
// Covers all ADF node types per the Atlassian document structure spec:
// https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/

type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: AdfNode[];
};

function applyMarks(text: string, marks?: AdfNode["marks"]): string {
  if (!marks) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "strong":
        result = `**${result}**`;
        break;
      case "em":
        result = `*${result}*`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "strike":
        result = `~~${result}~~`;
        break;
      case "underline":
        // Markdown has no underline; use emphasis as fallback
        result = `_${result}_`;
        break;
      case "link":
        result = `[${result}](${mark.attrs?.href ?? ""})`;
        break;
      case "subsup":
        // No markdown equivalent; render as-is
        break;
      case "textColor":
      case "backgroundColor":
      case "alignment":
      case "border":
        // Styling marks — no markdown equivalent, pass through
        break;
    }
  }
  return result;
}

function convertInline(node: AdfNode): string {
  if (node.type === "text") {
    return applyMarks(node.text ?? "", node.marks);
  }
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${node.attrs?.text ?? "user"}`;
  if (node.type === "emoji") return node.attrs?.shortName as string ?? "";
  if (node.type === "inlineCard") return `[${node.attrs?.url ?? ""}](${node.attrs?.url ?? ""})`;
  if (node.type === "date") {
    // ADF date stores timestamp as a string in attrs.timestamp (ms since epoch)
    const ts = node.attrs?.timestamp as string | undefined;
    if (ts) {
      const d = new Date(parseInt(ts, 10));
      return d.toISOString().split("T")[0];
    }
    return "(date)";
  }
  if (node.type === "status") {
    const statusText = (node.attrs?.text as string) ?? "status";
    return `\`${statusText}\``;
  }
  if (node.type === "mediaInline") return "_(media)_";
  // Fallback: recurse into content
  return (node.content ?? []).map(convertInline).join("");
}

function convertChildren(nodes: AdfNode[]): string {
  return nodes.map((n) => convertBlock(n)).join("\n\n");
}

function convertBlock(node: AdfNode): string {
  switch (node.type) {
    case "doc":
      return convertChildren(node.content ?? []);

    case "paragraph":
      return (node.content ?? []).map(convertInline).join("");

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(Math.min(level, 6));
      const text = (node.content ?? []).map(convertInline).join("");
      return `${prefix} ${text}`;
    }

    case "bulletList":
      return (node.content ?? [])
        .map((item) => convertListItem(item, "- "))
        .join("\n");

    case "orderedList": {
      const start = (node.attrs?.order as number) ?? 1;
      return (node.content ?? [])
        .map((item, i) => convertListItem(item, `${start + i}. `))
        .join("\n");
    }

    case "listItem": {
      // Shouldn't be called directly, but handle gracefully
      return convertListItem(node, "- ");
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "blockquote": {
      const inner = convertChildren(node.content ?? []);
      return inner.split("\n").map((line) => `> ${line}`).join("\n");
    }

    case "rule":
      return "---";

    case "table":
      return convertTable(node);

    case "panel": {
      // Render panel content with a prefix for the panel type
      const panelType = (node.attrs?.panelType as string) ?? "info";
      const prefix = panelType === "warning" ? "⚠️ " : panelType === "error" ? "❌ " : panelType === "success" ? "✅ " : "ℹ️ ";
      const inner = convertChildren(node.content ?? []);
      return `> ${prefix}${inner.split("\n").join("\n> ")}`;
    }

    case "expand":
    case "nestedExpand": {
      const title = (node.attrs?.title as string) ?? "";
      const body = convertChildren(node.content ?? []);
      // Render as a bold title + indented content (markdown has no native expand)
      return title ? `**${title}**\n\n${body}` : body;
    }

    case "mediaGroup":
    case "mediaSingle":
    case "media":
      return "_(media)_";

    case "taskList":
      return (node.content ?? [])
        .map((item) => {
          const done = item.attrs?.state === "DONE";
          const text = (item.content ?? []).map(convertInline).join("");
          return `- [${done ? "x" : " "}] ${text}`;
        })
        .join("\n");

    case "decisionList":
      return (node.content ?? [])
        .map((item) => {
          const text = (item.content ?? []).map(convertInline).join("");
          return `- 🔵 ${text}`;
        })
        .join("\n");

    default:
      // Unknown block type: try to extract text content
      if (node.content) return convertChildren(node.content);
      if (node.text) return applyMarks(node.text, node.marks);
      return "";
  }
}

function convertListItem(node: AdfNode, prefix: string): string {
  const children = node.content ?? [];
  const parts: string[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === "paragraph") {
      const text = (child.content ?? []).map(convertInline).join("");
      if (i === 0) {
        parts.push(`${prefix}${text}`);
      } else {
        // Additional paragraphs in the same list item
        parts.push(`${"  ".repeat(prefix.length > 3 ? 1 : 1)}${text}`);
      }
    } else if (child.type === "bulletList" || child.type === "orderedList") {
      // Nested list — indent
      const nested = convertBlock(child);
      parts.push(nested.split("\n").map((line) => `  ${line}`).join("\n"));
    } else {
      const text = convertBlock(child);
      if (i === 0) {
        parts.push(`${prefix}${text}`);
      } else {
        parts.push(`  ${text}`);
      }
    }
  }
  return parts.join("\n");
}

function convertTable(node: AdfNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return "";

  const mdRows: string[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cells: string[] = [];
    for (const cell of row.content ?? []) {
      const cellText = (cell.content ?? [])
        .map((child) => {
          if (child.type === "paragraph") {
            return (child.content ?? []).map(convertInline).join("");
          }
          return convertBlock(child);
        })
        .join(" ");
      cells.push(cellText.replace(/\|/g, "\\|"));
    }
    mdRows.push(cells);
  }

  if (mdRows.length === 0) return "";

  const colCount = Math.max(...mdRows.map((r) => r.length));
  const lines: string[] = [];

  // First row
  const firstRow = mdRows[0];
  lines.push(`| ${firstRow.map((c) => c).join(" | ")} |`);

  // Separator (always add after first row for valid GFM tables)
  lines.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

  // Remaining rows (skip index 0)
  for (let r = 1; r < mdRows.length; r++) {
    // Pad row to colCount if needed
    const paddedRow = [...mdRows[r]];
    while (paddedRow.length < colCount) paddedRow.push("");
    lines.push(`| ${paddedRow.join(" | ")} |`);
  }

  return lines.join("\n");
}

export function adfToMarkdown(adf: unknown): string | null {
  if (!adf || typeof adf !== "object") return null;
  const node = adf as AdfNode;
  if (node.type !== "doc") return null;
  const result = convertBlock(node);
  return result || null;
}

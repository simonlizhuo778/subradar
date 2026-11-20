/**
 * CSV 基础工具:行解析(处理双引号包裹/转义/内嵌逗号)+ 编码探测。
 * 支付宝/微信账单导出的 CSV 都带引号包裹字段,不能用 split(',') 糊弄。
 */

/** 解析一行 CSV:返回去空白的字段数组 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1; // 转义的引号 ""
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

/**
 * 编码探测:先严格 UTF-8,失败则按 GB18030(支付宝导出常见 GBK 系)。
 * 需要 Node 官方构建(内置 full-ICU)。
 */
export function decodeCsvText(buffer: Buffer): string {
  try {
    const utf8Strict = new TextDecoder('utf-8', { fatal: true });
    return utf8Strict.decode(buffer);
  } catch {
    return new TextDecoder('gb18030').decode(buffer);
  }
}

/** 去掉 UTF-8 BOM */
export function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

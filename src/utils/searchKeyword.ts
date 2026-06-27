/**
 * 搜索框关键词：请求前清洗（与产品「输入处理规则」一致）。
 * 输入框内不限制用户输入，仅在发起搜索/请求时调用本工具处理后再传给后端。
 *
 * 顺序：控制字符 → 空格 → 删除指定括号 → 转义 \\ ' " → 英文小写 → trim + 连续空白压缩
 */

const BRACKETS_TO_STRIP = new Set([
  '<',
  '>',
  '{',
  '}',
  '[',
  ']',
  '《',
  '》',
  '「',
  '」',
])

/**
 * 将原始输入清洗为可传给后端的搜索关键词。
 */
export function normalizeSearchKeywordForRequest(raw: string): string {
  if (raw == null || raw === '')
    return ''

  // 1) 换行 / Tab / 回车 → 空格
  let s = raw.replace(/[\n\t\r]/g, ' ')

  // 1.5) 处理字面的反斜杠n/t/r字符串（如用户输入 \n），在转义前先替换为空格
  s = s.replace(/\\n/gi, ' ')
  s = s.replace(/\\t/gi, ' ')
  s = s.replace(/\\r/gi, ' ')

  // 2) 删除指定括号类字符
  s = Array.from(s).filter(ch => !BRACKETS_TO_STRIP.has(ch)).join('')

  // 3) 转义 \、单引号、双引号（先处理反斜杠）
  s = s.replace(/\\/g, '\\\\')
  s = s.replace(/'/g, '\\\'')
  s = s.replace(/"/g, '\\"')

  // 4) 英文小写（匹配侧不区分大小写）
  s = s.toLowerCase()

  // 5) 首尾空白 + 连续空白压缩为单个空格
  s = s.trim().replace(/\s+/g, ' ')

  return s
}

/**
 * 用于接口参数：与 {@link normalizeSearchKeywordForRequest} 相同，始终返回字符串。
 * 空输入或清洗后无有效内容时为 `''`，便于按约定显式传空字符串给后端。
 */
export function getSearchKeywordParam(raw: string): string {
  return normalizeSearchKeywordForRequest(raw)
}

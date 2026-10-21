/**
 * Estimated cost of the skill catalog a mode's sessions carry.
 *
 * DSH's `skill` tool adds one catalog message to a session: a fixed reminder around one line per skill the model may
 * invoke, written as `` - `name`: description `` with the description's whitespace collapsed, cut to 500 characters,
 * and `&`, `<`, `>` escaped. `whenToUse` is not part of it. The estimate applies DeepSeek's published rule of thumb (an
 * English character is about 0.3 tokens, a Chinese character about 0.6) to that text, so it is an approximation of the
 * real tokenizer.
 */

/** The description length DSH's catalog keeps by default (`catalogDescriptionMaxLength`). */
export const CATALOG_DESCRIPTION_MAX = 500

/** The catalog message without its skill lines, as DSH writes it. */
const FRAME = [
  '<system-reminder>',
  'A skill is a reusable set of task-specific instructions. The following skills are available in this session:',
  '',
  '<available_skills>',
  '</available_skills>',
  '',
  "If the user names a skill, or the task clearly matches a skill's description, call the `skill` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.",
  'A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.',
  '</system-reminder>',
].join('\n')

/** Characters the estimate counts as Chinese, Japanese, or Korean, including full-width punctuation. */
const WIDE = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯]/u

/**
 * Estimated tokens of a text.
 * @param {string} text - any text.
 * @returns {number} 0.6 per wide character plus 0.3 per other character, rounded up.
 */
export function estimateTokens(text) {
  let wide = 0
  let other = 0
  for (const char of text) {
    if (WIDE.test(char)) wide++
    else other++
  }
  return Math.ceil(wide * 0.6 + other * 0.3)
}

/**
 * One skill's catalog line, as DSH writes it.
 * @param {string} name - the skill name.
 * @param {string} description - its description.
 * @returns {string} the line.
 */
export function catalogLine(name, description) {
  const normalized = String(description ?? '').replaceAll(/\s+/g, ' ').trim()
  const cut = normalized.length <= CATALOG_DESCRIPTION_MAX ? normalized : `${normalized.slice(0, CATALOG_DESCRIPTION_MAX - 3)}...`
  return `- \`${name}\`: ${cut.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}`
}

/** Estimated tokens one skill adds to a catalog: its line and the line break after it. */
export function skillTokens(name, description) {
  return estimateTokens(`${catalogLine(name, description)}\n`)
}

/**
 * Estimated tokens of a whole catalog.
 * @param {{ name: string, description: string }[]} skills - the skills the model may invoke.
 * @returns {number} 0 without skills (DSH sends no catalog then), else the frame plus every line.
 */
export function catalogTokens(skills) {
  if (skills.length === 0) return 0
  return estimateTokens(FRAME) + skills.reduce((sum, skill) => sum + skillTokens(skill.name, skill.description), 0)
}

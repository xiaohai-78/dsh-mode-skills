/**
 * How often each skill was loaded, per mode, read from the session history.
 *
 * Two durable events say a skill was loaded: the model's `skill` tool call (counted once its result came back without
 * an error) and a `user/message` the host injected for a `/name` invocation (`source.kind` `skill-invocation`). A
 * load belongs to the mode the session ran under at that point: the header's `agentPreset`, replaced by each
 * `agent-preset/selected` event (a blank session may switch mode); a session with neither belongs to the default mode.
 * Only names and times are read; no message text is kept.
 *
 * The history comes from the `sessionQuery` service, which reads live and saved sessions alike. A saved session's
 * uses are kept for {@link CACHE_TTL_MS}; a live session is always read again.
 */

/** How long the uses of a saved session are reused. */
export const CACHE_TTL_MS = 10 * 60 * 1000
/** The most sessions read in one pass, newest first. */
export const MAX_SESSIONS = 400
/** How long one pass may take before it returns what it has. */
export const BUDGET_MS = 25 * 1000
/** Sessions read at the same time. */
const CONCURRENCY = 4

/**
 * The skill loads in one session's event log.
 * @param {{ type: string, time: number, data?: object }[]} events - the raw log events in order.
 * @param {string} mode - the mode the session starts in.
 * @returns {{ name: string, kind: 'model' | 'user', at: number, mode: string }[]} one entry per load, in log order, with
 *   the mode the session ran under then. A `skill` call that failed, or that never got a result, is not counted.
 */
export function scanEvents(events, mode) {
  const calls = new Map()
  const uses = []
  let current = mode
  for (const event of events) {
    if (event.type === 'agent-preset/selected') {
      if (typeof event.data?.agentPreset === 'string') current = event.data.agentPreset
    } else if (event.type === 'tool/call' && event.data?.name === 'skill') {
      let name
      try {
        name = JSON.parse(event.data.arguments)?.name
      } catch {
        // The model sent arguments that are not JSON; the tool would have refused them too.
        continue
      }
      if (typeof name === 'string') calls.set(event.data.callId, { name, at: event.time, mode: current })
    } else if (event.type === 'tool/result') {
      const message = event.data?.message
      const call = calls.get(message?.toolCallId)
      if (call === undefined) continue
      calls.delete(message.toolCallId)
      if (message.isError !== true) uses.push({ name: call.name, kind: 'model', at: call.at, mode: call.mode })
    } else if (event.type === 'user/message') {
      const source = event.data?.source
      if (source?.kind === 'skill-invocation' && typeof source.name === 'string') uses.push({ name: source.name, kind: 'user', at: event.time, mode: current })
    }
  }
  return uses
}

/**
 * Read the skill loads of the newest sessions.
 * @param {{ service: object, defaultMode: string, cache?: Map<string, object>, now?: () => number, maxSessions?: number,
 *   budgetMs?: number, force?: boolean }} input - the `sessionQuery` service, the mode a session without a preset belongs
 *   to, the cache of saved sessions, and the limits.
 * @returns {Promise<{ sessions: { id: string, uses: object[] }[], total: number, scanned: number,
 *   failed: number, truncated: boolean, complete: boolean }>} the sessions read; `total` is how many exist, `truncated`
 *   whether older ones were left out, `complete` whether the time budget held, and `failed` how many could not be read.
 */
export async function collectUsage({ service, defaultMode, cache = new Map(), now = Date.now, maxSessions = MAX_SESSIONS, budgetMs = BUDGET_MS, force = false }) {
  const records = [...await service.listSessions()].sort((a, b) => b.header.createdAt - a.header.createdAt)
  const chosen = records.slice(0, maxSessions)
  const started = now()
  const sessions = []
  let failed = 0
  let complete = true
  let next = 0
  const worker = async () => {
    while (next < chosen.length) {
      if (now() - started > budgetMs) {
        complete = false
        return
      }
      const record = chosen[next++]
      const id = record.header.id
      const mode = typeof record.header.agentPreset === 'string' ? record.header.agentPreset : defaultMode
      const cached = cache.get(id)
      if (!force && !record.live && cached !== undefined && now() - cached.at < CACHE_TTL_MS) {
        sessions.push({ id, uses: cached.uses })
        continue
      }
      try {
        const uses = scanEvents((await service.readSession(id)).events, mode)
        if (!record.live) cache.set(id, { at: now(), uses })
        sessions.push({ id, uses })
      } catch {
        // A damaged or unreadable log leaves that session out of the counts.
        failed += 1
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chosen.length) }, worker))
  return { sessions, total: records.length, scanned: sessions.length, failed, truncated: records.length > chosen.length, complete }
}

/**
 * Count the loads in a time window.
 * @param {{ uses: { name: string, kind: string, at: number, mode: string }[] }[]} sessions - from {@link collectUsage}.
 * @param {number} since - the start of the window, in Unix epoch milliseconds.
 * @returns {Record<string, { model: number, user: number, firstAt: number, lastAt: number, modes: Record<string, { model: number, user: number, lastAt: number }> }>}
 *   per skill name: loads by the model and by the user, the first and last time, and the same per mode.
 */
export function summarizeUsage(sessions, since) {
  // Maps, because a skill name or mode id comes from a log and may be any text, `__proto__` included.
  const skills = new Map()
  for (const session of sessions) {
    for (const use of session.uses) {
      if (use.at < since) continue
      let skill = skills.get(use.name)
      if (skill === undefined) {
        skill = { model: 0, user: 0, firstAt: use.at, lastAt: use.at, modes: new Map() }
        skills.set(use.name, skill)
      }
      let mode = skill.modes.get(use.mode)
      if (mode === undefined) {
        mode = { model: 0, user: 0, lastAt: use.at }
        skill.modes.set(use.mode, mode)
      }
      skill[use.kind] += 1
      mode[use.kind] += 1
      skill.firstAt = Math.min(skill.firstAt, use.at)
      skill.lastAt = Math.max(skill.lastAt, use.at)
      mode.lastAt = Math.max(mode.lastAt, use.at)
    }
  }
  return Object.fromEntries([...skills].map(([name, skill]) => [name, { ...skill, modes: Object.fromEntries(skill.modes) }]))
}

/**
 * The row that applies one mode's skill settings: skills turned off, skills only the user may start, and skills only the
 * model may start.
 *
 * It registers a skill provider in the mode's own scope. For each skill the mode turns off, the provider lists an
 * entry that neither the model nor the user may invoke. For each skill set to manual only, it lists an entry the model
 * does not see but the user can start with `/name`; for each skill set to model only, an entry the model sees but
 * the `/` menu does not offer. Loading either reads the skill's current file. Its entries carry the
 * lowest rank, so they win over every other provider in the same scope, and providers of farther scopes lose to the
 * mode's scope anyway. Skill files are never moved or changed.
 *
 * `config.preset` names the mode; the settings are read through the `dshModeSkills` service. While dsh-modes is
 * installed (its `dshModes` service exists), this row lists nothing: dsh-modes applies the skill settings then, and
 * the Skill Manager page writes through it. The service invalidates the provider after every change, so a session
 * already running in this mode receives a replacement skill catalog on its next model step.
 */
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseSkillFile } from './skill-store.js'

export const PROVIDER = 'dsh-mode-skills'
/** Lower ranks win duplicate names within a scope; the filesystem provider uses 100–600. */
const RANK = -1000
const OFF_DESCRIPTION = 'Turned off in this mode by Skill Manager.'

export const name = 'dsh-mode-skills-policy'
export const inject = ['skills']

/** What each kind of file-backed entry lets the model and the user do. */
const INVOCATION = {
  manual: { modelInvocable: false, userInvocable: true },
  model: { modelInvocable: true, userInvocable: false },
}

/** The skill's current file as the registry serves it, with the invocation of its setting. */
async function fileSkill(skill, path, mode) {
  const { fields, body } = parseSkillFile(await readFile(path, 'utf8'))
  return {
    name: skill,
    description: typeof fields.description === 'string' && fields.description.trim() !== '' ? fields.description : skill,
    ...typeof fields.whenToUse === 'string' && fields.whenToUse.trim() !== '' ? { whenToUse: fields.whenToUse } : {},
    invocation: { ...INVOCATION[mode] },
    source: PROVIDER,
    provider: PROVIDER,
    path,
    resourceBase: { kind: 'directory', path: dirname(path) },
    content: body.trim(),
  }
}

export function apply(ctx, config) {
  let warned = false
  const warn = (error) => {
    if (!warned) ctx.logger.warn(`skill settings of ${String(config.preset)} are not applied: ${error instanceof Error ? error.message : String(error)}`)
    warned = true
  }
  ctx.effect(() => ctx.skills.registerProvider((control) => {
    let stop
    const watch = () => {
      if (stop === undefined) stop = ctx.get('dshModeSkills')?.watch(() => control.invalidate())
    }
    control.signal.addEventListener('abort', () => stop?.())
    watch()
    return {
      name: PROVIDER,
      async list() {
        watch()
        const service = ctx.get('dshModeSkills')
        if (service === undefined || ctx.get('dshModes') !== undefined) return []
        try {
          const policy = await service.policyFor(config.preset)
          const off = policy.off.map(skill => ({
            name: skill,
            description: OFF_DESCRIPTION,
            invocation: { modelInvocable: false, userInvocable: false },
            source: PROVIDER,
            provider: PROVIDER,
            rank: RANK,
            locator: { kind: 'off' },
          }))
          const files = Object.keys(INVOCATION).flatMap(mode => (policy[mode] ?? []).map(skill => ({
            name: skill.name,
            description: skill.description,
            ...skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse },
            invocation: { ...INVOCATION[mode] },
            source: PROVIDER,
            provider: PROVIDER,
            rank: RANK,
            path: skill.path,
            resourceBase: { kind: 'directory', path: dirname(skill.path) },
            locator: { kind: 'file', mode, path: skill.path },
          })))
          return [...off, ...files]
        } catch (error) {
          warn(error)
          return []
        }
      },
      async get(candidate) {
        if (candidate.locator?.kind !== 'file') return undefined
        try {
          return await fileSkill(candidate.name, candidate.locator.path, candidate.locator.mode)
        } catch (error) {
          warn(error)
          return undefined
        }
      },
    }
  }), 'dsh-mode-skills: skill policy')
}

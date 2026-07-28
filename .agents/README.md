# FF RESTaurent agent system

`.agents/` is the permanent, canonical, version-controlled location for every
project-owned agent skill, instruction, prompt, workflow, configuration,
template, manifest, metadata file, and supporting asset.

## Policy

- Create all new agent-system assets in `.agents/` only.
- Keep each skill and everything it references together under
  `.agents/skills/<skill-name>/`.
- Keep project-wide agent configuration and handoff instructions in `.agents/`.
- Run `npm run agents:verify` after changing agent-system assets.
- Do not add new project content to `.codex/`. That legacy location is
  deprecated and is not a source of truth.

## Worktrees and branches

The directory is tracked by Git. A worktree or branch uses the agent system in
its checked-out commit, so it needs no per-worktree copy, bootstrap step, or
machine-local path. Keep migration changes on the branch that needs them, then
merge or cherry-pick that commit into any existing long-lived worktree branch.
Future worktrees created from a commit containing this directory receive it
automatically.

## Layout

- `config.toml` — project agent configuration migrated from the legacy system.
- `skills/` — project skills and their manifests, references, and supporting
  files.
- `skills-lock.json` — source metadata for the installed third-party skills.
- `PHASE_*_HANDOFF.md` — project-stage instructions and historical handoffs.

The verification command checks that the canonical directory exists, every
skill has valid front matter, referenced local assets resolve, and no active
repository file retains a legacy-path reference.

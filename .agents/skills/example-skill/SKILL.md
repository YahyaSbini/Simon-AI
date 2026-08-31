---
name: example-skill
description: Template showing how a repository skill is structured. Use when adding a new skill to this repo or when you need the conventions for writing SKILL.md files.
---

# Example skill

A skill is a checklist Devin follows verbatim. Keep it short, ordered, and concrete.

## When to use

Describe the trigger conditions here. The `description` in the frontmatter is what Devin
matches against, so it must state *when* the skill applies, not just what it is.

## Steps

1. State the first concrete action, with the exact command:
   ```bash
   echo "run me"
   ```
2. State the next action, including how to verify it succeeded.
3. Finish with the verification step (tests, lint, build) and what a passing result looks like.

## Notes

- One folder per skill under `.agents/skills/`, named in kebab-case matching `name`.
- Helper scripts and templates can live alongside this file and be referenced by relative
  path, e.g. `.agents/skills/example-skill/setup.sh`.
- Prefer pointing at real files and commands in this repo over prose explanations.

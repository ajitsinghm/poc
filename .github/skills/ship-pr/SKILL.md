---
name: ship-pr
description: 'Ship code as a pull request. Use when: creating a PR, shipping changes, committing and opening a pull request, grouping changes into commits, staging changes, writing commit messages, preparing a PR for review. Walks through: grouping unstaged/staged diffs into logical commits → user approves each commit message → commits in sequence → confirms PR title/body → opens PR on GitHub.'
argument-hint: 'Optional PR title or branch description'
---

# ship-pr — Ship a Pull Request

Interactive workflow that turns your working tree into a clean, well-described pull request.

---

## When to Use

Invoke this skill whenever the user says any of:
- "ship this as a PR", "create a PR", "open a pull request"
- "commit and push", "stage my changes"
- "help me write commit messages"

---

## Procedure

### Step 1 — Snapshot the Working Tree

Run these commands in order and collect the output:

```bash
git status --short
git diff HEAD
git log origin/$(git rev-parse --abbrev-ref HEAD)..HEAD --oneline 2>/dev/null || git log --oneline -10
```

Also read the current branch name:

```bash
git rev-parse --abbrev-ref HEAD
```

If `git diff HEAD` is empty **and** there are no unpushed commits, tell the user there is nothing to ship and stop.

---

### Step 2 — Group Changes into Logical Commits

Analyse the full diff. Split the changes into **logical groups** based on:

| Signal | Group type |
|--------|-----------|
| New files / feature code | `feat:` |
| Bug fixes | `fix:` |
| Tests added or updated | `test:` |
| CI / workflow files | `ci:` |
| Config, build, deps | `chore:` |
| Refactor without behaviour change | `refactor:` |
| Docs, comments, README | `docs:` |

Rules:
- A single changed file can belong to only **one** group.
- Keep groups small — prefer more commits over one giant commit.
- If all changes are clearly one concern, a single commit is fine.

For each group, prepare:
```
Group N — <short title>
  Files : <list of files>
  Commit: <conventional-commit subject line, max 72 chars>
  Body  : <optional 1-2 sentence explanation of WHY>
```

---

### Step 3 — Present Groups and Get Approval

Show all groups in a numbered list. Ask the user:

> "Here's how I'd split your changes into commits. Reply with:
> - **ok** to accept all as-is
> - **edit N** to change the message for group N
> - **merge N M** to combine groups N and M
> - **split N** to re-discuss splitting group N further"

**Wait for the user's reply before proceeding.**

If the user requests edits, update the plan and re-present the affected groups. Repeat until the user says **ok** or equivalent confirmation.

---

### Step 4 — Commit Each Group (with Per-Commit Confirmation)

For each approved group, in order:

1. Show the exact `git add` and `git commit` commands you are about to run.
2. Ask: *"Commit group N? (yes / skip / abort)"*
3. **Wait for confirmation.**
   - **yes** → run the commands.
   - **skip** → leave those files unstaged, move to next group.
   - **abort** → stop everything, do not run any more git commands.

Stage only the files in the current group (use `git add <file>...`), never `git add .`.

---

### Step 5 — Push the Branch

After all commits:

```bash
git push origin <branch-name>
```

If the push fails due to diverged history, report the exact error and ask the user how to proceed — do **not** force-push automatically.

---

### Step 6 — Compose the Pull Request

Generate a PR title and body from the commits made in Step 4.

**PR Title:** Derive from the most significant commit subject. Remove the conventional-commit prefix for the title (e.g. `feat: add user auth` → `Add user auth`).

**PR Body template:**

```markdown
## Summary
<2-4 sentences describing the overall change and motivation>

## Changes
<bullet list — one entry per commit, reusing commit subjects>

## Notes for Reviewer
<anything that needs special attention: breaking changes, known gaps, follow-up tickets>
```

Present the draft title and body to the user and ask:

> "Ready to open the PR? You can:
> - **ok** to create with this title and body
> - **edit title: <new title>** to change the title
> - **edit body** to rewrite the description
> - **draft** to open as a draft PR"

**Wait for the user's reply.**

---

### Step 7 — Create the Pull Request

Once the user confirms, use the `github-pull-request_create_pull_request` tool with:
- `head`: current branch name
- `base`: default branch (usually `main`)
- `title`: approved title
- `body`: approved body
- `draft`: `true` only if user said "draft"

After the PR is created, print the PR URL.

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Merge conflicts detected | Stop, report conflicting files, ask user to resolve manually |
| Push rejected (non-fast-forward) | Stop, show error, do NOT force-push |
| PR already exists for branch | Report the existing PR URL, ask if user wants to update the description instead |
| Nothing staged after grouping | Warn and ask if user wants to commit all remaining changes as one group |

---

## Key Rules

- **Never run `git add .`** — always add specific files per group.
- **Never force-push** without explicit user instruction.
- **Always wait for confirmation** before each commit and before creating the PR.
- **Never expose secrets** present in diffs (tokens, passwords) — warn the user instead.
- Keep commit messages in **Conventional Commits** format (`type(scope): subject`).

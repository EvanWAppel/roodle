@AGENTS.md

<!-- factotum:blocked-protocol -->
**Blockers → Jira (fleet repo, system standard).** Anything only Evan can resolve — a credential, a deploy, external access, or a decision — becomes a ticket in the Jira `EA` space on *Needs Evan*, component `roodle`, **with the specific steps a human takes to unblock it** (the action, where, any URL / path / env-var). From a session on Evan's Mac, file it with `uv run --project ~/Documents/_system sys file-blocker --component roodle --title "…" --body-file steps.md` (add `--nice-to-have` for 🟡; default 🔴); fleet daemon runs on the box park their own ticket on *Needs Evan* instead. Two kinds stay in the root `BLOCKED.md`, in the standard format: **`[sec]` blockers** (`- [ ] 🔴 [sec] …`, because the security dashboard counts them only there, D-052) and anything Jira must not hold — roster/user data, secret values, unpublished writing (D-039). `BLOCKED.md` keeps its heading and a pointer to Jira. _system's blocked-router mirrors both into Evan's todo dashboard. Full rule: Evan's global `~/.claude/CLAUDE.md` and _system D-051/D-052.
<!-- /factotum:blocked-protocol -->

<!-- factotum:recl-standing-rules -->
**ROCRLL** — this project follows Requirements → Orchestrate → Check → Review → Loop → Ledger.

- **Requirements.** Draft/keep a `PRD.md` via interview — walk every branch, don't guess.
  The interview also produces the `TASKS.md` grouping and seeds the Ledger.
- **Orchestrate.** Default is linear. Fan out to subagents **only when a task group has ≥3
  genuinely independent tasks**; give each its **own git worktree**, merge back one at a
  time, and remove each worktree and its branch once merged or abandoned.
  **Precondition:** the project must be its own standalone git repo. Worktrees are for
  overlapping-file work — disjoint-file fan-out may use lighter same-tree partitioning.
  **Agents are hands, you're the head:** subagents write code in their worktrees; they never
  inspect raw data or make design/verdict calls — those escalate to the orchestrator.
- **Check.** TDD, test-first. **The human inspects the data; the agent never sees raw data.**
  Run Check **centrally at the orchestrator** at each merge join, not inside each worktree:
  **affected tests + lint + typecheck at each join; the full suite once, before the group's
  final merge to main.**
- **Review.** Independent adversarial review on **every merge to the main line**. Default
  reviewer: a fresh-context same-model subagent; escalate cross-model for high-stakes/security.
  **High-severity findings block, but the human adjudicates them against the primary source** —
  reviewers over-call; never auto-action a finding. Everything below high is advisory.
- **Loop.** Iterate.
- **Ledger.** Record every **decision with a real trade-off** (chose X, rejected Y, why) in a
  `DECISIONS.md` append log. The agent drafts the entry; the human confirms it.

**Guardrails (always on):** TDD-first · nothing external sent/merged/published/deployed
without explicit human approval · the agent never sees raw data · **no autonomous
(Ralph-style) self-feeding loops** · **prime directive — if anything is unclear, stop and ask.**

**Standard artifacts:** `PRD.md` · `TASKS.md` (parallel groups marked) ·
`AGENTS.md`/`CLAUDE.md` · `DECISIONS.md` · `BLOCKED.md`.

<!-- /factotum:recl-standing-rules -->

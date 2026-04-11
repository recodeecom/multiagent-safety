# Reddit post drafts for GuardeX

GitHub: https://github.com/recodeecom/multiagent-safety

## Draft 1 (general)

**Title:**  
I made an npm tool to keep multi-agent coding safe in Git repos (GuardeX)

**Body:**  
Hey everyone 👋

I built **GuardeX**, a small npm CLI to make multi-agent coding workflows safer and less chaotic in any Git repo.

If you run multiple agents (or teammates) in parallel, this helps prevent:

- direct commits to protected branches (`dev`/`main`/`master` and configurable extras)
- file ownership collisions between agents
- unsafe deletes of claimed files
- stale lock/worktree mess

Quick start:

```bash
npm i -g gx
gx setup
```

Useful commands:

```bash
gx protect list
gx protect add release staging
```

Links:

- GitHub: https://github.com/recodeecom/multiagent-safety
- npm: https://www.npmjs.com/package/guardex

If you try it, I’d love feedback on team workflows and edge cases.

## Draft 2 (short)

**Title:**  
GuardeX: open-source npm CLI for safer multi-agent Git workflows

**Body:**  
I open-sourced **GuardeX** to add guardrails for parallel coding agents in Git repos.

It blocks risky protected-branch commits, enforces per-file ownership locks for agent branches, and includes workflow scripts for branch start/finish.

Install:

```bash
npm i -g gx
gx setup
```

GitHub: https://github.com/recodeecom/multiagent-safety  
npm: https://www.npmjs.com/package/guardex

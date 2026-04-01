# claude-buddy-reroll

> Reverse-engineered Claude Code's `/buddy` pet system — get the exact pet you want in under a second.

![Claude Code](https://img.shields.io/badge/Claude%20Code-%3E%3D2.1.89-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## How it works

Pets are deterministically generated from your account UUID + a hardcoded salt:

```
pet = mulberry32(Bun.hash(accountUUID + "friend-2026-401"))
```

This script brute-forces UUIDs until it finds one that generates your target pet, then writes it to `~/.claude.json`.

## Usage

**Bun version** (recommended — uses the same hash as Claude Code internally):

```bash
bun find-buddy-bun.js --show
bun find-buddy-bun.js --species duck --rarity legendary --shiny --apply
bun find-buddy-bun.js --species dragon --rarity legendary --apply
bun find-buddy-bun.js --rarity legendary --count 3
```

**Node.js version** (no extra install needed):

```bash
node find-buddy-node.js --show
node find-buddy-node.js --species duck --rarity legendary --shiny --apply
```

## Options

| Flag | Description |
|------|-------------|
| `--show` | Show current pet and exit |
| `--species <value>` | duck / goose / blob / cat / dragon / octopus / owl / penguin / turtle / snail / ghost / axolotl / capybara / cactus / robot / rabbit / mushroom / chonk |
| `--rarity <value>` | common / uncommon / rare / epic / legendary |
| `--eye <value>` | `·` `✦` `×` `◉` `@` `°` |
| `--hat <value>` | none / crown / tophat / propeller / halo / wizard / beanie / tinyduck |
| `--shiny` | Require shiny |
| `--not-shiny` | Require non-shiny |
| `--count <n>` | Find n results (default: 1) |
| `--limit <n>` | Max attempts (default: 2,000,000) |
| `--apply` | Write first result to `~/.claude.json` automatically |

## Notes

- A backup is saved to `~/.claude.json.buddy-backup` before any changes
- To restore: `cp ~/.claude.json.buddy-backup ~/.claude.json`
- Legendary + shiny probability is ~0.01%, script finds a match in under 1 second
- Requires Claude Code >= 2.1.89

## How it was found

The pet generation logic was extracted by running `strings` on the Claude Code binary and locating the relevant code at byte offset 73,602,652. Key findings:

- Hardcoded salt: `friend-2026-401` (an April Fools' Day 2026 easter egg)
- Hash function: `Bun.hash()` truncated to 32 bits — **not** standard FNV-1a (a common mistake in early community scripts)
- PRNG: mulberry32

Since generation is fully deterministic, brute-forcing a matching UUID takes milliseconds.

---

If this saved you from being stuck with a common blob, a ⭐ would be appreciated!

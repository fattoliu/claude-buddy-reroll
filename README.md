# claude-buddy-reroll

Reverse-engineered Claude Code `/buddy` pet system. Lets you find and apply any pet you want.

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

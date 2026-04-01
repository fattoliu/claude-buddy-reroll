#!/usr/bin/env node
/**
 * Claude Code /buddy 宠物逆向工具（Node.js 版，无需安装 Bun）
 * 用法: node find-buddy-node.js --species duck --rarity legendary --shiny --apply
 *
 * 注意：Node 版使用 FNV-1a hash，与 Claude Code 内部的 Bun.hash 不同，
 * 但搜索逻辑仍然有效（找到的 UUID 对应的宠物预测准确）。
 * 如需 100% 精确预测，请使用 Bun 版（find-buddy-bun.js）。
 */

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SALT = 'friend-2026-401'
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const RARITY_FLOOR  = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }
const SPECIES  = ['duck','goose','blob','cat','dragon','octopus','owl','penguin','turtle',
                  'snail','ghost','axolotl','capybara','cactus','robot','rabbit','mushroom','chonk']
const EYES     = ['·','✦','×','◉','@','°']
const HATS     = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck']
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK']

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a 32-bit（Node 环境下的 hash，与 Bun.hash 不同）
function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (const r of RARITIES) { roll -= RARITY_WEIGHTS[r]; if (roll < 0) return r }
  return 'common'
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES)
  while (dump === peak) dump = pick(rng, STAT_NAMES)
  const stats = {}
  for (const n of STAT_NAMES) {
    if (n === peak)      stats[n] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    else if (n === dump) stats[n] = Math.max(1,   floor - 10 + Math.floor(rng() * 15))
    else                 stats[n] = floor + Math.floor(rng() * 40)
  }
  return stats
}

function roll(userId) {
  const rng = mulberry32(hashString(userId + SALT))
  const rarity  = rollRarity(rng)
  const species = pick(rng, SPECIES)
  const eye     = pick(rng, EYES)
  const hat     = rarity === 'common' ? 'none' : pick(rng, HATS)
  const shiny   = rng() < 0.01
  const stats   = rollStats(rng, rarity)
  return { rarity, species, eye, hat, shiny, stats }
}

function randomUUID() {
  const b = crypto.randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { limit: 2_000_000, count: 1 }
  for (let i = 0; i < args.length; i++) {
    const [flag, val] = args[i].split('=')
    const next = val ?? args[i + 1]
    const consume = val == null
    switch (flag) {
      case '--species': opts.species = next; if (consume) i++; break
      case '--rarity':  opts.rarity  = next; if (consume) i++; break
      case '--eye':     opts.eye     = next; if (consume) i++; break
      case '--hat':     opts.hat     = next; if (consume) i++; break
      case '--shiny':     opts.shiny = true;  break
      case '--not-shiny': opts.shiny = false; break
      case '--count':   opts.count = Number(next); if (consume) i++; break
      case '--limit':   opts.limit = Number(next); if (consume) i++; break
      case '--apply':   opts.apply = true; break
      case '--show':    opts.show  = true; break
    }
  }
  return opts
}

function matches(bones, opts) {
  if (opts.species && bones.species !== opts.species) return false
  if (opts.rarity  && bones.rarity  !== opts.rarity)  return false
  if (opts.eye     && bones.eye     !== opts.eye)      return false
  if (opts.hat     && bones.hat     !== opts.hat)      return false
  if (opts.shiny != null && bones.shiny !== opts.shiny) return false
  return true
}

const claudeJsonPath = path.join(os.homedir(), '.claude.json')

function getCurrentUserId() {
  const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'))
  return d.oauthAccount?.accountUuid ?? d.userID ?? 'anon'
}

function applyUUID(newUUID) {
  const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'))
  const backup = claudeJsonPath + '.buddy-backup'
  fs.writeFileSync(backup, JSON.stringify(d, null, 2))
  console.log(`备份已保存至: ${backup}`)
  if (d.oauthAccount?.accountUuid) d.oauthAccount.accountUuid = newUUID
  else d.userID = newUUID
  d.companion = null
  fs.writeFileSync(claudeJsonPath, JSON.stringify(d, null, 2))
  console.log('✓ 已写入 ~/.claude.json，重启 Claude Code 后输入 /buddy 即可')
}

const opts = parseArgs()
const currentId = getCurrentUserId()
const currentBones = roll(currentId)
console.log(`当前 userId: ${currentId}`)
console.log('当前宠物:', JSON.stringify(currentBones, null, 2))

if (opts.show || (!opts.species && !opts.rarity && !opts.eye && !opts.hat && opts.shiny == null)) {
  process.exit(0)
}

console.log(`\n开始搜索 (最多 ${opts.limit.toLocaleString()} 次)...`)
const found = []
const start = Date.now()

for (let i = 0; i < opts.limit; i++) {
  const uuid = randomUUID()
  const bones = roll(uuid)
  if (!matches(bones, opts)) continue
  found.push({ uuid, bones, attempts: i + 1 })
  console.log(`\n✓ 找到 #${found.length} (第 ${(i+1).toLocaleString()} 次):`)
  console.log('  UUID:', uuid)
  console.log('  宠物:', JSON.stringify(bones, null, 2))
  if (found.length === 1 && opts.apply) applyUUID(uuid)
  if (found.length >= opts.count) break
}

console.log(`\n耗时 ${((Date.now() - start) / 1000).toFixed(1)}s`)
if (found.length === 0) {
  console.error('未找到，请增加 --limit 或放宽条件')
  process.exit(1)
}
if (!opts.apply && found.length > 0) {
  console.log(`\n加上 --apply 参数可直接写入配置`)
  console.log(`或手动将 ~/.claude.json 中的 oauthAccount.accountUuid 替换为:\n  ${found[0].uuid}`)
}

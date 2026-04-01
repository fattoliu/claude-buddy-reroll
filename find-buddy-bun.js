#!/usr/bin/env bun
/**
 * Claude Code /buddy 宠物逆向工具
 * 用法: bun find-buddy.js [--species dragon] [--rarity legendary] [--shiny] [--count 3]
 *
 * 原理：宠物由 accountUuid + "friend-2026-401" 确定性生成
 * 脚本暴力搜索能生成目标宠物的 UUID，然后替换 ~/.claude.json 中的 accountUuid
 */

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ── 常量（与 Claude Code 二进制完全一致）──────────────────────────────
const SALT = 'friend-2026-401'
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const RARITY_RANK   = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }
const RARITY_FLOOR  = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }
const SPECIES  = ['duck','goose','blob','cat','dragon','octopus','owl','penguin','turtle',
                  'snail','ghost','axolotl','capybara','cactus','robot','rabbit','mushroom','chonk']
const EYES = ['·','✦','×','◉','@','°']
const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck']
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK']

// ── PRNG（mulberry32，与二进制 0x6d2b79f5 一致）──────────────────────
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── hash（与 Claude Code 二进制一致：Bun.hash 取低32位）─────────────
function hashString(s) {
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
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

// ── 生成随机 UUID v4 格式（与 accountUuid 格式一致）──────────────────
function randomUUID() {
  const b = crypto.randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

// ── 参数解析 ──────────────────────────────────────────────────────────
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
      case '--show':    opts.show = true; break
      case '--help':    opts.help = true; break
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

// ── 读取当前 ~/.claude.json ───────────────────────────────────────────
const claudeJsonPath = path.join(os.homedir(), '.claude.json')

function readClaudeJson() {
  return JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'))
}

function getCurrentUserId() {
  const d = readClaudeJson()
  return d.oauthAccount?.accountUuid ?? d.userID ?? 'anon'
}

// ── 应用新 UUID（替换 accountUuid）───────────────────────────────────
function applyUUID(newUUID) {
  const d = readClaudeJson()
  const backup = claudeJsonPath + '.buddy-backup'
  fs.writeFileSync(backup, JSON.stringify(d, null, 2))
  console.log(`备份已保存至: ${backup}`)

  if (d.oauthAccount?.accountUuid) {
    d.oauthAccount.accountUuid = newUUID
  } else {
    d.userID = newUUID
  }
  // 清除 companion 缓存，强制重新生成
  d.companion = null

  fs.writeFileSync(claudeJsonPath, JSON.stringify(d, null, 2))
  console.log(`✓ 已写入 ~/.claude.json`)
  console.log(`重启 Claude Code 后输入 /buddy 即可看到新宠物`)
}

// ── 主逻辑 ────────────────────────────────────────────────────────────
const opts = parseArgs()

if (opts.help) {
  console.log(`
Claude Code /buddy 宠物刷新工具

用法:
  node find-buddy.js --show                          # 查看当前宠物
  node find-buddy.js --species dragon --rarity legendary        # 搜索传说龙
  node find-buddy.js --species ghost --shiny --rarity legendary # 闪光传说幽灵
  node find-buddy.js --rarity legendary --count 3               # 找3个传说级
  node find-buddy.js --species cat --rarity legendary --apply   # 找到后直接应用

可选参数:
  --species  <值>  物种: ${SPECIES.join(', ')}
  --rarity   <值>  稀有度: ${RARITIES.join(', ')}
  --eye      <值>  眼睛: ${EYES.join(' ')}
  --hat      <值>  帽子: ${HATS.join(', ')}
  --shiny         要求闪光
  --not-shiny     要求非闪光
  --count    <n>  找到n个结果后停止 (默认1)
  --limit    <n>  最大尝试次数 (默认2000000)
  --apply         找到第一个结果后直接写入 ~/.claude.json
  --show          仅显示当前宠物，不搜索
`)
  process.exit(0)
}

// --show 模式：显示当前宠物
const currentId = getCurrentUserId()
const currentBones = roll(currentId)
console.log(`\n当前 userId: ${currentId}`)
console.log('当前宠物:', JSON.stringify(currentBones, null, 2))

if (opts.show || (!opts.species && !opts.rarity && !opts.eye && !opts.hat && opts.shiny == null)) {
  process.exit(0)
}

// 搜索模式
console.log(`\n开始搜索 (最多 ${opts.limit.toLocaleString()} 次)...`)
console.log('目标条件:', JSON.stringify({
  species: opts.species, rarity: opts.rarity, eye: opts.eye,
  hat: opts.hat, shiny: opts.shiny
}))

const found = []
const start = Date.now()

for (let i = 0; i < opts.limit; i++) {
  const uuid = randomUUID()
  const bones = roll(uuid)
  if (!matches(bones, opts)) continue

  found.push({ uuid, bones, attempts: i + 1 })
  console.log(`\n✓ 找到 #${found.length} (第 ${(i+1).toLocaleString()} 次尝试):`)
  console.log('  UUID:', uuid)
  console.log('  宠物:', JSON.stringify(bones, null, 2))

  if (found.length === 1 && opts.apply) {
    applyUUID(uuid)
  }

  if (found.length >= opts.count) break
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\n耗时 ${elapsed}s`)

if (found.length === 0) {
  console.error(`未找到匹配宠物，请增加 --limit 或放宽条件`)
  process.exit(1)
}

if (!opts.apply && found.length > 0) {
  console.log(`\n如需应用第一个结果，运行:`)
  console.log(`  node find-buddy.js [同样的参数] --apply`)
  console.log(`\n或手动编辑 ~/.claude.json，将 oauthAccount.accountUuid 替换为:`)
  console.log(`  ${found[0].uuid}`)
}

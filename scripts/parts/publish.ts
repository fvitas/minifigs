// Pushes the WebP parts and the manifest to the repo GitHub Pages serves them from. The PNG
// masters stay behind: they are 85% of public/parts and nothing outside this machine reads them.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { PARTS_CDN } from '../../src/parts/cdn.ts'

const REMOTE = 'git@github.com:fvitas/minifig-assets.git'
const ROOT = path.resolve(import.meta.dirname, '../..')
const CLONE = path.join(ROOT, '.assets')
const SOURCE = path.join(ROOT, 'public/parts/')

function run(command: string, ...args: string[]) {
  execFileSync(command, args, { stdio: 'inherit' })
}

function git(...args: string[]) {
  run('git', '-C', CLONE, ...args)
}

if (existsSync(CLONE)) {
  git('pull', '--ff-only')
} else {
  run('git', 'clone', REMOTE, CLONE)
}

// --delete so a part removed from the build stops being served.
run(
  'rsync',
  '-a',
  '--delete',
  '--include=*/',
  '--include=*.webp',
  '--include=parts.json',
  '--exclude=*',
  SOURCE,
  path.join(CLONE, 'parts/'),
)

git('add', '-A')
const staged = execFileSync('git', ['-C', CLONE, 'status', '--porcelain']).toString().trim()
if (staged) {
  git('commit', '-m', `Publish parts ${new Date().toISOString().slice(0, 10)}`)
  git('push')
  console.log(`\npublished to ${PARTS_CDN}/parts/ — Pages takes a minute to pick it up`)
} else {
  console.log('\nnothing to publish, parts are already live')
}

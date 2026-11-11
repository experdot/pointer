import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  prepareDraft,
  releaseInfo,
  requiredReleaseAssets,
  resolveRelease,
  verifyDraft,
  verifyRelease,
  verifyReleaseAssets
} from './release.mjs'

const script = fileURLToPath(new URL('./release.mjs', import.meta.url))

function repository(t, version = '2.0.0-preview.2', annotated = false) {
  const prefix = join(resolve(tmpdir()), 'pointer-release-')
  const cwd = mkdtempSync(prefix)
  t.after(() => {
    assert.ok(cwd.startsWith(prefix) && cwd.startsWith(resolve(tmpdir()) + sep))
    rmSync(cwd, { recursive: true, force: true })
  })
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release-test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  const commit = (value) => {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'pointer-test', version: value })
    )
    git('add', 'package.json')
    git('commit', '-m', `version ${value}`)
    return git('rev-parse', 'HEAD')
  }
  const sha = commit(version)
  const tag = `v${version}`
  git('tag', ...(annotated ? ['-a', tag, '-m', 'release'] : [tag]))
  return { cwd, git, commit, sha, tag, version }
}

for (const [version, prerelease] of [
  ['2.0.0', false],
  ['2.0.1+build-preview.7', false],
  ['2.0.0-preview.2', true],
  ['2.0.0-rc.1+build.7', true],
  ['2.0.0-0', true]
]) {
  test(`识别版本 ${version} 的发布类型`, () => {
    assert.deepEqual(releaseInfo(`v${version}`, version), {
      tag: `v${version}`,
      version,
      prerelease
    })
  })
}

test('拒绝不一致的 tag、非法版本和含换行的输入', () => {
  assert.throws(() => releaseInfo('v2.0.1', '2.0.0'), /不一致/)
  for (const version of [
    '02.0.0',
    '2.0',
    '2.0.0-01',
    '2.0.0-rc..1',
    '2.0.0\nsha=bad',
    '2.0.0\n',
    null
  ]) {
    assert.throws(() => releaseInfo(`v${version}`, version), /无效/)
  }
})

for (const annotated of [false, true]) {
  test(`推送${annotated ? '附注' : '轻量'} tag 解析为对应的确定提交`, (t) => {
    const repo = repository(t, '2.0.0-preview.2', annotated)
    const release = resolveRelease({
      cwd: repo.cwd,
      env: {
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: `refs/tags/${repo.tag}`,
        GITHUB_SHA: repo.git('rev-parse', `refs/tags/${repo.tag}`)
      }
    })
    assert.deepEqual(release, { ...releaseInfo(repo.tag, repo.version), sha: repo.sha })
  })
}

test('手动发布读取目标 tag 的版本，忽略工作流分支的新版本', (t) => {
  const repo = repository(t)
  repo.commit('3.0.0')
  assert.equal(JSON.parse(readFileSync(join(repo.cwd, 'package.json'), 'utf8')).version, '3.0.0')
  const release = resolveRelease({
    cwd: repo.cwd,
    env: { GITHUB_EVENT_NAME: 'workflow_dispatch', RELEASE_TAG: repo.tag }
  })
  assert.equal(release.sha, repo.sha)
  assert.equal(release.version, '2.0.0-preview.2')
})

test('手动入口拒绝缺失 tag、分支、SHA 和命令注入式输入', (t) => {
  const repo = repository(t)
  repo.git('branch', 'v2.0.1')
  for (const tag of [undefined, 'main', 'v2.0.1', 'v9.0.0', repo.sha, 'v2.0.0;echo bad']) {
    assert.throws(() =>
      resolveRelease({
        cwd: repo.cwd,
        env: { GITHUB_EVENT_NAME: 'workflow_dispatch', RELEASE_TAG: tag }
      })
    )
  }
})

test('tag 中的版本与该提交的 package.json 不一致时终止', (t) => {
  const repo = repository(t)
  repo.git('tag', 'v2.0.1')
  assert.throws(
    () =>
      resolveRelease({
        cwd: repo.cwd,
        env: { GITHUB_EVENT_NAME: 'workflow_dispatch', RELEASE_TAG: 'v2.0.1' }
      }),
    /不一致/
  )
})

test('拒绝普通分支推送以及在事件后被移动的 tag', (t) => {
  const repo = repository(t)
  assert.throws(
    () =>
      resolveRelease({
        cwd: repo.cwd,
        env: { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main' }
      }),
    /发布入口/
  )
  repo.commit('2.0.1')
  repo.git('tag', '-f', repo.tag)
  assert.throws(
    () =>
      resolveRelease({
        cwd: repo.cwd,
        env: {
          GITHUB_EVENT_NAME: 'push',
          GITHUB_REF: `refs/tags/${repo.tag}`,
          GITHUB_SHA: repo.sha
        }
      }),
    /tag 已移动/
  )
})

test('打包前再次检查 tag、校验 SHA 和干净工作区', (t) => {
  const repo = repository(t)
  assert.equal(verifyRelease({ cwd: repo.cwd }).sha, repo.sha)
  assert.throws(() => verifyRelease({ cwd: repo.cwd, sha: 'a'.repeat(40) }), /已校验/)
  writeFileSync(join(repo.cwd, 'untracked.txt'), 'changed')
  assert.throws(() => verifyRelease({ cwd: repo.cwd }), /未提交/)
  rmSync(join(repo.cwd, 'untracked.txt'))
  writeFileSync(
    join(repo.cwd, 'package.json'),
    JSON.stringify({ version: repo.version, changed: true })
  )
  assert.throws(() => verifyRelease({ cwd: repo.cwd }), /未提交/)
  repo.git('checkout', '--', 'package.json')
  repo.commit('2.0.1')
  repo.git('tag', '-d', repo.tag)
  repo.git('tag', 'v2.0.1', repo.sha)
  assert.throws(() => verifyRelease({ cwd: repo.cwd }), /不是版本 tag/)
})

test('CLI 输出固定 SHA，错误输入退出失败且不产生输出参数', (t) => {
  const repo = repository(t)
  const output = join(repo.cwd, '.git', 'release-output')
  const run = (tag) =>
    spawnSync(process.execPath, [script, 'resolve'], {
      cwd: repo.cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        RELEASE_TAG: tag,
        GITHUB_OUTPUT: output
      }
    })
  const success = run(repo.tag)
  assert.equal(success.status, 0, success.stderr)
  assert.equal(JSON.parse(success.stdout).sha, repo.sha)
  const before = readFileSync(output, 'utf8')
  assert.ok(before.includes(`sha=${repo.sha}\n`))
  assert.ok(before.includes('prerelease=true\n'))
  const failure = run('main')
  assert.equal(failure.status, 1)
  assert.equal(readFileSync(output, 'utf8'), before)
})

function githubFixture({ existing, remoteSha = 'a'.repeat(40), annotated = false } = {}) {
  const writes = []
  const object = { type: 'commit', sha: remoteSha }
  const github = {
    rest: {
      git: {
        getRef: async () => ({
          data: { object: annotated ? { type: 'tag', sha: 'b'.repeat(40) } : object }
        }),
        getTag: async () => ({ data: { object } })
      },
      repos: {
        listReleases: () => {},
        createRelease: async (value) => {
          writes.push(['create', value])
          return { data: value }
        },
        updateRelease: async (value) => {
          writes.push(['update', value])
          return { data: { ...existing, ...value } }
        }
      }
    },
    paginate: async () => (existing ? [existing] : [])
  }
  return { github, writes }
}

for (const version of ['2.0.0', '2.0.0-preview.2']) {
  test(`${version} 创建草稿时保留对应的预发布标记`, async () => {
    const { github, writes } = githubFixture({ annotated: true })
    const release = { ...releaseInfo(`v${version}`, version), sha: 'a'.repeat(40) }
    const draft = await prepareDraft({ github, owner: 'owner', repo: 'repo', release })
    assert.equal(draft.draft, true)
    assert.equal(draft.prerelease, version.includes('-'))
    assert.equal(draft.target_commitish, release.sha)
    assert.equal(draft.tag_name, release.tag)
    assert.equal(writes.length, 1)
    assert.equal(writes[0][0], 'create')
  })
}

test('重跑只更新已有草稿的类型，不抹除用户的说明', async () => {
  const release = { ...releaseInfo('v2.0.0-preview.2', '2.0.0-preview.2'), sha: 'a'.repeat(40) }
  const { github, writes } = githubFixture({
    existing: {
      id: 12,
      tag_name: release.tag,
      draft: true,
      prerelease: false,
      body: 'Release notes',
      name: 'Custom title'
    }
  })
  const draft = await prepareDraft({ github, owner: 'owner', repo: 'repo', release })
  assert.equal(draft.body, 'Release notes')
  assert.equal(draft.name, 'Custom title')
  assert.equal(draft.prerelease, true)
  assert.equal(writes[0][0], 'update')
  assert.equal(writes[0][1].release_id, 12)
  assert.equal(writes[0][1].draft, true)
})

test('已公开的版本拒绝覆盖，远端 tag 移动也不会写入 Release', async () => {
  const release = { ...releaseInfo('v2.0.0', '2.0.0'), sha: 'a'.repeat(40) }
  for (const options of [
    { existing: { tag_name: release.tag, draft: false } },
    { remoteSha: 'c'.repeat(40) }
  ]) {
    const { github, writes } = githubFixture(options)
    await assert.rejects(
      prepareDraft({ github, owner: 'owner', repo: 'repo', release }),
      /已公开|不一致/
    )
    assert.deepEqual(writes, [])
  }
})

test('远端 tag 缺失或 API 出错时中止，不创建草稿', async () => {
  const { github, writes } = githubFixture()
  github.rest.git.getRef = async () => {
    throw new Error('404')
  }
  await assert.rejects(
    prepareDraft({
      github,
      owner: 'owner',
      repo: 'repo',
      release: { ...releaseInfo('v2.0.0', '2.0.0'), sha: 'a'.repeat(40) }
    }),
    /404/
  )
  assert.deepEqual(writes, [])
})

function sharedDraftFixture() {
  const release = { ...releaseInfo('v2.0.0-preview.2', '2.0.0-preview.2'), sha: 'a'.repeat(40) }
  const draft = {
    id: 42,
    tag_name: release.tag,
    draft: true,
    prerelease: true,
    html_url: 'draft-url'
  }
  const { github, writes } = githubFixture({ existing: draft })
  const reads = []
  const assets = requiredReleaseAssets(release.version).map((name) => ({
    name,
    state: 'uploaded',
    size: 1024
  }))
  github.rest.repos.getRelease = async (args) => {
    reads.push(args.release_id)
    return { data: draft }
  }
  github.rest.repos.listReleaseAssets = () => {}
  github.paginate = async (method, args) => {
    assert.equal(method, github.rest.repos.listReleaseAssets)
    reads.push(args.release_id)
    return assets
  }
  return {
    draft,
    assets,
    writes,
    reads,
    options: { github, owner: 'owner', repo: 'repo', release, releaseId: 42 }
  }
}

test('三个平台只核对同一个草稿，不并发创建或修改 Release', async () => {
  const { options, draft, writes, reads } = sharedDraftFixture()
  const results = await Promise.all([
    verifyDraft(options),
    verifyDraft(options),
    verifyDraft(options)
  ])
  assert.ok(results.every((result) => result === draft))
  assert.deepEqual(reads, [42, 42, 42])
  assert.deepEqual(writes, [])
})

test('三平台、macOS 双架构及更新元数据齐全才通过验收', async () => {
  const { options, draft, reads, writes, assets } = sharedDraftFixture()
  assert.equal(new Set(assets.map((asset) => asset.name)).size, 11)
  assert.equal(await verifyReleaseAssets(options), draft)
  assert.deepEqual(reads, [42, 42])
  assert.deepEqual(writes, [])
  assert.equal(draft.draft, true)
})

for (const suffix of [
  '-setup.exe',
  '-mac-arm64.zip',
  '-mac-x64.dmg',
  '-linux-amd64.deb',
  'latest-linux.yml'
]) {
  test(`共享草稿缺少 ${suffix} 时发布验收失败`, async () => {
    const { options, assets, writes } = sharedDraftFixture()
    const index = assets.findIndex((asset) => asset.name.endsWith(suffix))
    assert.ok(index >= 0)
    assets.splice(index, 1)
    await assert.rejects(verifyReleaseAssets(options), /缺少完整产物/)
    assert.deepEqual(writes, [])
  })
}

test('不接受尚未上传完成或零字节的附件', async () => {
  for (const patch of [{ state: 'new' }, { size: 0 }]) {
    const { options, assets } = sharedDraftFixture()
    Object.assign(assets[0], patch)
    await assert.rejects(verifyReleaseAssets(options), /缺少完整产物/)
  }
})

test('拒绝错误草稿、错误发布类型或已经被公开的草稿', async () => {
  for (const patch of [{ tag_name: 'v9.0.0' }, { prerelease: false }, { draft: false }]) {
    const { options, draft, writes } = sharedDraftFixture()
    Object.assign(draft, patch)
    await assert.rejects(verifyDraft(options), /已公开|不一致/)
    assert.deepEqual(writes, [])
  }
  const { options, reads } = sharedDraftFixture()
  await assert.rejects(verifyDraft({ ...options, releaseId: NaN }), /草稿 ID/)
  assert.deepEqual(reads, [])
})

test(
  '草稿验收的文件名与当前 electron-builder 的实际架构命名一致',
  { skip: process.env.POINTER_SKIP_RELEASE_ARTIFACT_NAME_TEST === '1' },
  async (t) => {
    const require = createRequire(import.meta.url)
    const { getConfig, validateConfiguration } = require('app-builder-lib/out/util/config/config')
    const { expandMacro } = require('app-builder-lib/out/util/macroExpander')
    const { Arch, getArtifactArchName, log } = require('builder-util')
    // 避免 Node.js 22 的测试运行器将 stdout 中的非 ASCII 日志误读为测试事件。
    t.mock.method(log, 'info', () => {})
    const root = fileURLToPath(new URL('../', import.meta.url))
    const config = await getConfig(root)
    await validateConfiguration(config, { isEnabled: false })
    const { name } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const version = '2.0.0-preview.2'
    const targets = [
      ['win', 'nsis', 'exe', Arch.x64],
      ['mac', 'dmg', 'dmg', Arch.x64],
      ['mac', 'dmg', 'dmg', Arch.arm64],
      ['mac', 'zip', 'zip', Arch.x64],
      ['mac', 'zip', 'zip', Arch.arm64],
      ['linux', 'appImage', 'AppImage', Arch.x64],
      ['linux', 'deb', 'deb', Arch.x64]
    ]
    const names = targets.map(([platform, target, ext, arch]) =>
      expandMacro(
        config[target]?.artifactName ?? config[platform].artifactName,
        getArtifactArchName(arch, ext),
        { name, version },
        { ext }
      )
    )
    assert.equal(new Set(names).size, names.length)
    assert.deepEqual(
      requiredReleaseAssets(version)
        .filter((name) => !name.endsWith('.yml') && !name.endsWith('.blockmap'))
        .sort(),
      names.sort()
    )
    assert.equal(config.mac.identity, null)
    assert.equal(config.mac.notarize, false)
    assert.ok(!config.linux.target.includes('snap'))
  }
)

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { prepareDraft, releaseInfo, resolveRelease, verifyRelease } from './release.mjs'

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

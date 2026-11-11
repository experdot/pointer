import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const number = '(?:0|[1-9]\\d*)'
const identifier = `(?:${number}|\\d*[A-Za-z-][0-9A-Za-z-]*)`
const versionPattern = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`
)

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

export function releaseInfo(tag, version) {
  const match = typeof version === 'string' ? version.match(versionPattern) : null
  if (!match || match[0] !== version) throw new Error(`无效的发布版本号：${version}`)
  if (tag !== `v${version}`) throw new Error(`tag ${tag} 与版本 ${version} 不一致`)
  return { tag, version, prerelease: Boolean(match[1]) }
}

function tagCommit(cwd, tag) {
  releaseInfo(tag, typeof tag === 'string' ? tag.slice(1) : undefined)
  try {
    return git(cwd, 'rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
  } catch {
    throw new Error(`发布必须使用已有的版本 tag：${tag}`)
  }
}

export function resolveRelease({ cwd = process.cwd(), env = process.env } = {}) {
  let tag
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    tag = env.RELEASE_TAG
  } else if (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF?.startsWith('refs/tags/')) {
    tag = env.GITHUB_REF.slice('refs/tags/'.length)
  } else {
    throw new Error('发布入口必须是版本 tag 推送或指定已有 tag 的手动触发')
  }
  const sha = tagCommit(cwd, tag)
  if (env.GITHUB_EVENT_NAME === 'push') {
    if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA ?? '')) throw new Error('推送事件缺少有效提交 SHA')
    const pushedCommit = git(cwd, 'rev-parse', '--verify', `${env.GITHUB_SHA}^{commit}`)
    if (sha !== pushedCommit) throw new Error('tag 已移动，与推送事件对应的提交不一致')
  }
  // 从目标提交读取版本，手动触发时不能使用工作流所在分支的 package.json。
  const { version } = JSON.parse(git(cwd, 'show', `${sha}:package.json`))
  return { ...releaseInfo(tag, version), sha }
}

export function verifyRelease({ cwd = process.cwd(), tag, sha } = {}) {
  const { version } = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  tag ??= `v${version}`
  const info = releaseInfo(tag, version)
  const head = git(cwd, 'rev-parse', 'HEAD')
  if (sha && sha !== head) throw new Error('当前提交与已校验的发布提交不一致')
  if (tagCommit(cwd, tag) !== head) throw new Error('当前提交不是版本 tag 对应的提交')
  if (git(cwd, 'status', '--porcelain', '--untracked-files=all')) {
    throw new Error('发布工作区存在未提交修改，请先提交并重新校验')
  }
  return { ...info, sha: head }
}

async function verifyRemoteTag({ github, owner, repo, release }) {
  const { tag } = releaseInfo(release.tag, release.version)
  // 上传前重新核对远端 tag，避免在校验期间被移动或删除的 tag 上发布。
  const ref = await github.rest.git.getRef({ owner, repo, ref: `tags/${tag}` })
  let object = ref.data.object
  const visited = new Set()
  while (object.type === 'tag') {
    if (visited.has(object.sha) || visited.size >= 16) throw new Error('无法解析嵌套的附注 tag')
    visited.add(object.sha)
    const annotated = await github.rest.git.getTag({ owner, repo, tag_sha: object.sha })
    object = annotated.data.object
  }
  if (object.type !== 'commit' || object.sha !== release.sha) {
    throw new Error('远端 tag 与已校验的发布提交不一致')
  }
}

export async function prepareDraft({ github, owner, repo, release }) {
  const { tag, version, prerelease } = releaseInfo(release.tag, release.version)
  await verifyRemoteTag({ github, owner, repo, release })
  const releases = await github.paginate(github.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100
  })
  const existing = releases.find((item) => item.tag_name === tag)
  if (existing && !existing.draft) throw new Error(`版本 ${tag} 已公开，不能覆盖，请使用新版本`)

  const metadata = { owner, repo, target_commitish: release.sha, draft: true, prerelease }
  const result = existing
    ? await github.rest.repos.updateRelease({ ...metadata, release_id: existing.id })
    : await github.rest.repos.createRelease({
        ...metadata,
        tag_name: tag,
        name: `Pointer ${version}`
      })
  return result.data
}

export async function verifyDraft({ github, owner, repo, release, releaseId }) {
  if (!Number.isSafeInteger(releaseId) || releaseId <= 0) throw new Error('缺少有效的共享草稿 ID')
  const { tag, prerelease } = releaseInfo(release.tag, release.version)
  await verifyRemoteTag({ github, owner, repo, release })
  const { data: draft } = await github.rest.repos.getRelease({ owner, repo, release_id: releaseId })
  if (!draft.draft) throw new Error('Release 已公开，不能继续上传')
  if (draft.tag_name !== tag || draft.prerelease !== prerelease) {
    throw new Error('共享草稿的 tag 或预发布类型不一致')
  }
  return draft
}

export function requiredReleaseAssets(version) {
  releaseInfo(`v${version}`, version)
  const prefix = `pointer-${version}`
  return [
    `${prefix}-setup.exe`,
    `${prefix}-setup.exe.blockmap`,
    'latest.yml',
    ...['x64', 'arm64'].flatMap((arch) => [
      `${prefix}-mac-${arch}.dmg`,
      `${prefix}-mac-${arch}.zip`
    ]),
    'latest-mac.yml',
    `${prefix}-linux-x86_64.AppImage`,
    `${prefix}-linux-amd64.deb`,
    'latest-linux.yml'
  ]
}

export async function verifyReleaseAssets(options) {
  const draft = await verifyDraft(options)
  const { github, owner, repo, release, releaseId } = options
  const assets = await github.paginate(github.rest.repos.listReleaseAssets, {
    owner,
    repo,
    release_id: releaseId,
    per_page: 100
  })
  const missing = requiredReleaseAssets(release.version).filter(
    (name) =>
      !assets.some((asset) => asset.name === name && asset.state === 'uploaded' && asset.size > 0)
  )
  if (missing.length) throw new Error(`共享草稿缺少完整产物：${missing.join(', ')}`)
  return draft
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const mode = process.argv[2]
    if (mode !== 'resolve' && mode !== 'verify') throw new Error('用法：release.mjs resolve|verify')
    const release =
      mode === 'resolve'
        ? resolveRelease()
        : verifyRelease({ tag: process.env.RELEASE_TAG, sha: process.env.RELEASE_SHA })
    console.log(JSON.stringify(release))
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        Object.entries(release)
          .map(([key, value]) => `${key}=${value}\n`)
          .join('')
      )
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

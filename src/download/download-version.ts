import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import {Architecture, OWNER, REPO, extract, validateChecksum} from '../utils'

export function tryGetFromCache(
  arch: Architecture,
  version: string
): string | undefined {
  core.debug(`Trying to get Rye from cache for ${version}...`)
  const cachedVersions = tc.findAllVersions('rye', arch)
  core.debug(`Cached versions: ${cachedVersions}`)
  return tc.find('rye', version, arch)
}

export async function downloadVersion(
  platform: string,
  arch: Architecture,
  version: string,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<string> {
  const binary = `rye-${arch}-${platform}`
  const downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${version}/${binary}.gz`
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  const downloadPath = await tc.downloadTool(
    downloadUrl,
    undefined,
    githubToken
  )
  await validateChecksum(checkSum, downloadPath, arch, platform, version)

  await extract(downloadPath)
  return downloadPath
}

import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import {
  Architecture,
  OWNER,
  Platform,
  REPO,
  extract,
  toolsCacheName,
  validateChecksum
} from '../utils'

export function tryGetFromCache(
  arch: Architecture,
  version: string
): string | undefined {
  core.debug(`Trying to get rye from tool cache for ${version}...`)
  const cachedVersions = tc.findAllVersions(toolsCacheName, arch)
  core.debug(`Cached versions: ${cachedVersions}`)
  return tc.find(toolsCacheName, version, arch)
}

export async function downloadVersion(
  platform: Platform,
  arch: Architecture,
  version: string,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<string> {
  const binary = `rye-${arch}-${platform}`
  let downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${binary}`
  if (platform === 'windows') {
    downloadUrl += '.exe'
  } else {
    downloadUrl += '.gz'
  }
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  const downloadPath = await tc.downloadTool(
    downloadUrl,
    undefined,
    githubToken
  )
  await validateChecksum(checkSum, downloadPath, arch, platform, version)

  if (platform !== 'windows') {
    // On Windows, the downloaded file is an executable, so we don't need to extract it
    await extract(downloadPath)
  }
  return downloadPath
}

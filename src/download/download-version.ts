import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
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
  let downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${version}/${binary}`
  if (platform === 'windows') {
    downloadUrl += '.exe'
  } else {
    downloadUrl += '.gz'
  }
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  let downloadPath = await tc.downloadTool(downloadUrl, undefined, githubToken)
  await validateChecksum(checkSum, downloadPath, arch, platform, version)

  if (platform === 'windows') {
    // On Windows, the downloaded file is an executable, so we don't need to extract it
    // but the file must has a valid extension for an executable file.
    await io.mv(downloadPath, `${downloadPath}.exe`)
    downloadPath = `${downloadPath}.exe`
  } else {
    await extract(downloadPath)
  }
  return downloadPath
}

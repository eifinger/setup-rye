import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as octokit from '@octokit/rest'
import * as path from 'path'
import fetch from 'node-fetch'
import {restoreCache} from './restore-cache'
import {Architecture, OWNER, REPO, validateCheckSum, getArch} from './utils'

async function run(): Promise<void> {
  const platform = 'linux'
  const arch = getArch()
  const versionInput = core.getInput('version')
  const checkSum = core.getInput('checksum')
  const enableCache = core.getInput('enable-cache') === 'true'
  const cachePrefix = core.getInput('cache-prefix') || ''

  try {
    if (arch === undefined) {
      throw new Error(`Unsupported architecture: ${process.arch}`)
    }
    const version = await resolveVersion(versionInput)
    core.setOutput('rye-version', version)

    let cachedPath = tryGetFromCache(arch, version)
    if (cachedPath) {
      core.info(`Found Rye in cache for ${version}`)
    } else {
      cachedPath = await setupRye(platform, arch, version, checkSum)
    }

    addRyeToPath(cachedPath)
    addMatchers()

    if (enableCache) {
      await restoreCache(cachePrefix, version)
    }
  } catch (err) {
    core.setFailed((err as Error).message)
  }
}

async function resolveVersion(versionInput: string): Promise<string> {
  const availableVersion = await getAvailableVersions()
  if (!availableVersion.includes(versionInput)) {
    if (versionInput === 'latest') {
      core.info(`Latest version is ${availableVersion[0]}`)
      return availableVersion[0]
    } else {
      throw new Error(
        `Version ${versionInput} is not available. Available version are: ${availableVersion}`
      )
    }
  }
  return versionInput
}

async function getAvailableVersions(): Promise<string[]> {
  const githubClient = new octokit.Octokit({
    userAgent: 'setup-rye',
    request: {fetch}
  })
  const response = await githubClient.rest.repos.listReleases({
    owner: OWNER,
    repo: REPO
  })
  const releases = response.data.map(release => release.tag_name)
  return releases
}

function tryGetFromCache(
  arch: Architecture,
  version: string
): string | undefined {
  core.debug(`Trying to get Rye from cache for ${version}...`)
  const cachedVersions = tc.findAllVersions('rye', arch)
  core.debug(`Cached versions: ${cachedVersions}`)
  return tc.find('rye', version, arch)
}

async function setupRye(
  platform: string,
  arch: Architecture,
  version: string,
  checkSum: string | undefined
): Promise<string> {
  const downloadPath = await downloadVersion(platform, arch, version, checkSum)
  const cachedPath = await installRye(downloadPath, arch, version)
  return cachedPath
}

async function downloadVersion(
  platform: string,
  arch: Architecture,
  version: string,
  checkSum: string | undefined
): Promise<string> {
  const binary = `rye-${arch}-${platform}`
  const downloadUrl = `https://github.com/mitsuhiko/rye/releases/download/${version}/${binary}.gz`
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  try {
    const downloadPath = await tc.downloadTool(downloadUrl)
    if (checkSum !== undefined && checkSum !== '') {
      const isValid = await validateCheckSum(downloadPath, checkSum)
      if (!isValid) {
        throw new Error(
          `Checksum for ${downloadPath} did not match ${checkSum}.`
        )
      }
    }

    await extract(downloadPath)
    return downloadPath
  } catch (err) {
    if (err instanceof Error) {
      // Rate limit?
      if (
        err instanceof tc.HTTPError &&
        (err.httpStatusCode === 403 || err.httpStatusCode === 429)
      ) {
        core.info(
          `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
        )
      } else {
        core.info(err.message)
      }
      if (err.stack !== undefined) {
        core.debug(err.stack)
      }
    }
    throw err
  }
}

async function extract(downloadPath: string): Promise<void> {
  core.info('Extracting downloaded archive...')
  const pathForGunzip = `${downloadPath}.gz`
  await io.mv(downloadPath, pathForGunzip)
  await exec.exec('gunzip', [pathForGunzip])
  await exec.exec('chmod', ['+x', downloadPath])
}

async function installRye(
  downloadPath: string,
  arch: string,
  version: string
): Promise<string> {
  const tempDir = path.join(process.env['RUNNER_TEMP'] || '', 'rye_temp_home')
  await io.mkdirP(tempDir)
  core.debug(`Created temporary directory ${tempDir}`)
  const options: exec.ExecOptions = {
    cwd: tempDir,
    env: {
      ...process.env,
      RYE_HOME: tempDir
    }
  }
  core.info(`Installing Rye into ${tempDir}`)
  await exec.exec(downloadPath, ['self', 'install', '--yes'], options)

  const cachedPath = await tc.cacheDir(tempDir, 'rye', version, arch)
  core.info(`Moved Rye into ${cachedPath}`)
  return cachedPath
}

function addRyeToPath(cachedPath: string): void {
  core.addPath(`${cachedPath}/shims`)
  core.info(`Added ${cachedPath}/shims to the path`)
}

function addMatchers(): void {
  const matchersPath = path.join(__dirname, '../..', '.github')
  core.info(`##[add-matcher]${path.join(matchersPath, 'python.json')}`)
}

run()

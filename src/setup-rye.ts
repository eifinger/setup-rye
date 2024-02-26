import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as octokit from '@octokit/rest'
import * as github from '@actions/github'
import * as path from 'path'
import {restoreCache} from './restore-cache'
import {
  Architecture,
  OWNER,
  REPO,
  EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT,
  VERSIONS_WHICH_MODIFY_PROFILE,
  validateCheckSum,
  getArch,
  isknownVersion,
  IS_MAC,
  compareVersions
} from './utils'
import {KNOWN_CHECKSUMS} from './checksums'

async function run(): Promise<void> {
  const platform = IS_MAC ? 'macos' : 'linux'
  const arch = getArch()
  const versionInput = core.getInput('version')
  const checkSum = core.getInput('checksum')
  const enableCache = core.getInput('enable-cache') === 'true'
  const cachePrefix = core.getInput('cache-prefix') || ''
  const githubToken = core.getInput('github-token')

  try {
    if (arch === undefined) {
      throw new Error(`Unsupported architecture: ${process.arch}`)
    }
    const version = await resolveVersion(versionInput, githubToken)
    if (VERSIONS_WHICH_MODIFY_PROFILE.includes(version)) {
      core.warning(
        `Rye version ${version} adds a wrong path to the file ~/.profile. Consider using version ${EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT} or later instead.`
      )
    }
    core.setOutput('rye-version', version)

    let cachedPath = tryGetFromCache(arch, version)
    if (cachedPath) {
      core.info(`Found Rye in cache for ${version}`)
    } else {
      cachedPath = await setupRye(
        platform,
        arch,
        version,
        checkSum,
        githubToken
      )
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

async function resolveVersion(
  versionInput: string,
  githubToken: string | undefined
): Promise<string> {
  if (isknownVersion(versionInput)) {
    core.debug(`Version ${versionInput} is known.`)
    return versionInput
  }
  const availableVersion = await getAvailableVersions(githubToken)
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

async function getAvailableVersions(
  githubToken: string | undefined
): Promise<string[]> {
  let response
  if (githubToken !== undefined && githubToken !== '') {
    core.debug(`Using GitHub token to authenticate for GitHub REST API.`)
    const githubClient = github.getOctokit(githubToken, {
      userAgent: 'setup-rye'
    })

    response = await githubClient.paginate(
      githubClient.rest.repos.listReleases,
      {
        owner: OWNER,
        repo: REPO
      }
    )
  } else {
    core.debug(`Using anonymous access for GitHub REST API.`)
    const githubClient = new octokit.Octokit({
      userAgent: 'setup-rye'
    })
    const data = await githubClient.rest.repos.listReleases({
      owner: OWNER,
      repo: REPO
    })
    response = data.data
  }

  const releases = response.map(release => release.tag_name)
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
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<string> {
  const downloadPath = await downloadVersion(
    platform,
    arch,
    version,
    checkSum,
    githubToken
  )
  const cachedPath = await installRye(downloadPath, arch, version)
  return cachedPath
}

async function downloadVersion(
  platform: string,
  arch: Architecture,
  version: string,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<string> {
  const binary = `rye-${arch}-${platform}`
  const downloadUrl = `https://github.com/astral-sh/rye/releases/download/${version}/${binary}.gz`
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  try {
    const downloadPath = await tc.downloadTool(
      downloadUrl,
      undefined,
      githubToken
    )
    let isValid = true
    if (checkSum !== undefined && checkSum !== '') {
      isValid = await validateCheckSum(downloadPath, checkSum)
    } else {
      core.debug(`Checksum not provided. Checking known checksums.`)
      const key = `${arch}-${platform}-${version}`
      if (key in KNOWN_CHECKSUMS) {
        const knownChecksum = KNOWN_CHECKSUMS[`${arch}-${platform}-${version}`]
        isValid = await validateCheckSum(downloadPath, knownChecksum)
      } else {
        core.debug(`No known checksum found for ${key}.`)
      }
    }

    if (!isValid) {
      throw new Error(`Checksum for ${downloadPath} did not match ${checkSum}.`)
    }
    core.debug(`Checksum for ${downloadPath} is valid.`)

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
    silent: !core.isDebug(),
    env: {
      ...process.env,
      RYE_HOME: tempDir
    }
  }
  core.info(`Installing Rye into ${tempDir}`)
  const execArgs = ['self', 'install', '--yes']
  if (
    compareVersions(version, EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT) >= 0
  ) {
    execArgs.push('--no-modify-path')
  }
  await exec.exec(downloadPath, execArgs, options)

  const cachedPath = await tc.cacheDir(tempDir, 'rye', version, arch)
  core.info(`Moved Rye into ${cachedPath}`)
  core.exportVariable('RYE_HOME', cachedPath)
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

import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as path from 'path'
import {downloadVersion, tryGetFromCache} from './download/download-version'
import {restoreCache, ryeHomePath} from './restore-cache'
import {
  Architecture,
  EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT,
  VERSIONS_WHICH_MODIFY_PROFILE,
  getArch,
  IS_MAC,
  compareVersions
} from './utils'
import {downloadLatest} from './download/download-latest'

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

    const setupResult = await setupRye(
      platform,
      arch,
      versionInput,
      checkSum,
      githubToken
    )

    if (VERSIONS_WHICH_MODIFY_PROFILE.includes(setupResult.version)) {
      core.warning(
        `Rye version ${setupResult.version} adds a wrong path to the file ~/.profile. Consider using version ${EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT} or later instead.`
      )
    }
    core.setOutput('rye-version', setupResult.version)

    addRyeToPath(setupResult.cachedPath)
    addMatchers()

    if (enableCache) {
      await restoreCache(cachePrefix, setupResult.version)
    }
    core.exportVariable('RYE_HOME', ryeHomePath)
    core.info(`Set RYE_HOME to ${ryeHomePath}`)
  } catch (err) {
    core.setFailed((err as Error).message)
  }
}

async function setupRye(
  platform: string,
  arch: Architecture,
  versionInput: string,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<{version: string; cachedPath: string}> {
  let cachedPath: string | undefined
  let downloadPath: string
  let version: string
  if (versionInput === 'latest') {
    const result = await downloadLatest(platform, arch, checkSum, githubToken)
    version = result.version
    downloadPath = result.downloadPath
  } else {
    version = versionInput
    cachedPath = tryGetFromCache(arch, versionInput)
    if (cachedPath) {
      core.info(`Found Rye in cache for ${versionInput}`)
      return {version, cachedPath}
    }
    downloadPath = await downloadVersion(
      platform,
      arch,
      versionInput,
      checkSum,
      githubToken
    )
  }

  cachedPath = await installRye(downloadPath, arch, version)
  return {version, cachedPath}
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

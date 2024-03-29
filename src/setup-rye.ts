import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as path from 'path'
import * as fs from 'fs'
import {downloadVersion, tryGetFromCache} from './download/download-version'
import {restoreCache} from './restore-cache'
import {
  Architecture,
  EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT,
  VERSIONS_WHICH_MODIFY_PROFILE,
  getArch,
  IS_MAC,
  compareVersions,
  toolsCacheName
} from './utils'
import {downloadLatest} from './download/download-latest'
import {
  RYE_CONFIG_TOML,
  RYE_CONFIG_TOML_BACKUP,
  STATE_TOOL_CACHED_PATH
} from './utils'

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
    addRyeToPath(setupResult.installedPath)
    addMatchers()
    core.saveState(STATE_TOOL_CACHED_PATH, setupResult.installedPath)
    await io.rmRF(`${setupResult.installedPath}/${RYE_CONFIG_TOML_BACKUP}`)
    if (fs.existsSync(`${setupResult.installedPath}/${RYE_CONFIG_TOML}`)) {
      await io.cp(
        `${setupResult.installedPath}/${RYE_CONFIG_TOML}`,
        `${setupResult.installedPath}/${RYE_CONFIG_TOML_BACKUP}`
      )
      core.info(`Backed up ${setupResult.installedPath}/${RYE_CONFIG_TOML}`)
    }
    if (enableCache) {
      await restoreCache(cachePrefix, setupResult.version)
    }
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
): Promise<{version: string; installedPath: string}> {
  let installedPath: string | undefined
  let downloadPath: string
  let version: string
  if (versionInput === 'latest') {
    const result = await downloadLatest(platform, arch, checkSum, githubToken)
    version = result.version
    downloadPath = result.downloadPath
  } else {
    version = versionInput
    installedPath = tryGetFromCache(arch, versionInput)
    if (installedPath) {
      core.info(`Found Rye in cache for ${versionInput}`)
      return {version, installedPath}
    }
    downloadPath = await downloadVersion(
      platform,
      arch,
      versionInput,
      checkSum,
      githubToken
    )
  }

  installedPath = await installRye(downloadPath, arch, version)
  return {version, installedPath}
}

async function installRye(
  downloadPath: string,
  arch: string,
  version: string
): Promise<string> {
  const tempDir = path.join(process.env['RUNNER_TEMP'] || '', 'rye_temp_home')
  await io.mkdirP(tempDir)
  core.debug(`Created temporary directory ${tempDir}`)
  // Cache first to get the correct path
  let cachedPath = await tc.cacheDir(tempDir, toolsCacheName, version, arch)
  const options: exec.ExecOptions = {
    cwd: cachedPath,
    silent: !core.isDebug(),
    env: {
      ...process.env,
      RYE_HOME: cachedPath
    }
  }
  core.info(`Installing Rye into ${cachedPath}`)
  const execArgs = ['self', 'install', '--yes']
  if (
    compareVersions(version, EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT) >= 0
  ) {
    execArgs.push('--no-modify-path')
  }
  await exec.exec(downloadPath, execArgs, options)
  return cachedPath
}

function addRyeToPath(cachedPath: string): void {
  core.addPath(`${cachedPath}/shims`)
  core.info(`Added ${cachedPath}/shims to the path`)
  core.exportVariable('RYE_HOME', cachedPath)
  core.info(`Set RYE_HOME to ${cachedPath}`)
}

function addMatchers(): void {
  const matchersPath = path.join(__dirname, '../..', '.github')
  core.info(`##[add-matcher]${path.join(matchersPath, 'python.json')}`)
}

run()

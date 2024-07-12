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
  compareVersions,
  toolsCacheName,
  getPlatform,
  Platform
} from './utils'
import {downloadLatest} from './download/download-latest'
import {RYE_CONFIG_TOML, RYE_CONFIG_TOML_BACKUP} from './utils'

async function run(): Promise<void> {
  const platform = getPlatform()
  const arch = getArch()
  const versionInput = core.getInput('version')
  const checkSum = core.getInput('checksum')
  const enableCache = core.getInput('enable-cache') === 'true'
  const cachePrefix = core.getInput('cache-prefix') || ''
  const githubToken = core.getInput('github-token')

  try {
    if (platform === undefined) {
      throw new Error(`Unsupported platform: ${process.platform}`)
    }
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

    setVersion(setupResult.version)
    addRyeToPath(setupResult.installedPath)
    addMatchers()
    await ensureCleanConfig(setupResult.installedPath)

    if (enableCache) {
      await restoreCache(cachePrefix, setupResult.version)
    }
  } catch (err) {
    core.setFailed((err as Error).message)
  }
  process.exit(0)
}

async function setupRye(
  platform: Platform,
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
      core.info(`Found Rye in tools-cache for ${versionInput}`)
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
  await createConfigBackup(installedPath)
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

async function createConfigBackup(installedPath: string): Promise<void> {
  if (fs.existsSync(`${installedPath}/${RYE_CONFIG_TOML}`)) {
    await io.cp(
      `${installedPath}/${RYE_CONFIG_TOML}`,
      `${installedPath}/${RYE_CONFIG_TOML_BACKUP}`
    )
    core.info(`Backed up ${installedPath}/${RYE_CONFIG_TOML}`)
  }
}

async function ensureCleanConfig(installedPath: string): Promise<void> {
  if (fs.existsSync(`${installedPath}/${RYE_CONFIG_TOML_BACKUP}`)) {
    await io.rmRF(`${installedPath}/${RYE_CONFIG_TOML}`)
    await io.cp(
      `${installedPath}/${RYE_CONFIG_TOML_BACKUP}`,
      `${installedPath}/${RYE_CONFIG_TOML}`
    )
    core.info(
      `Restored clean ${RYE_CONFIG_TOML} from ${installedPath}/${RYE_CONFIG_TOML_BACKUP}`
    )
  }
}

function setVersion(version: string): void {
  if (VERSIONS_WHICH_MODIFY_PROFILE.includes(version)) {
    core.warning(
      `Rye version ${version} adds a wrong path to the file ~/.profile. Consider using version ${EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT} or later instead.`
    )
  }
  core.setOutput('rye-version', version)
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

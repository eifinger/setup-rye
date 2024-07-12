import * as fs from 'fs'
import * as crypto from 'crypto'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {KNOWN_CHECKSUMS} from './checksums'

export const WINDOWS_ARCHS = ['x86', 'x64']
export const WINDOWS_PLATFORMS = ['win32', 'win64']

export const REPO = 'rye'
export const OWNER = 'astral-sh'

export const toolsCacheName = 'setup-rye-2024-03-04' // Custom name for cache busting
export const RYE_CONFIG_TOML_BACKUP = 'config.toml.bak'
export const RYE_CONFIG_TOML = 'config.toml'

export const EARLIEST_VERSION_WITH_NO_MODIFY_PATHSUPPORT = '0.25.0'
export const VERSIONS_WHICH_MODIFY_PROFILE = [
  '0.21.0',
  '0.22.0',
  '0.23.0',
  '0.24.0'
]

export type Platform = 'linux' | 'macos' | 'windows'
export type Architecture = 'x86' | 'x86_64' | 'aarch64'

export enum ComparisonResult {
  Greater = 1,
  Equal = 0,
  Less = -1
}

export async function validateChecksum(
  checkSum: string | undefined,
  downloadPath: string,
  arch: Architecture,
  platform: string,
  version: string
): Promise<void> {
  let isValid = true
  if (checkSum !== undefined && checkSum !== '') {
    isValid = await validateFileCheckSum(downloadPath, checkSum)
  } else {
    core.debug(`Checksum not provided. Checking known checksums.`)
    const key = `${arch}-${platform}-${version}`
    if (key in KNOWN_CHECKSUMS) {
      const knownChecksum = KNOWN_CHECKSUMS[`${arch}-${platform}-${version}`]
      core.debug(`Checking checksum for ${arch}-${platform}-${version}.`)
      isValid = await validateFileCheckSum(downloadPath, knownChecksum)
    } else {
      core.debug(`No known checksum found for ${key}.`)
    }
  }

  if (!isValid) {
    throw new Error(`Checksum for ${downloadPath} did not match ${checkSum}.`)
  }
  core.debug(`Checksum for ${downloadPath} is valid.`)
}

export async function extract(downloadPath: string): Promise<void> {
  core.info('Extracting downloaded archive...')
  const pathForGunzip = `${downloadPath}.gz`
  await io.mv(downloadPath, pathForGunzip)
  await exec.exec('gunzip', [pathForGunzip])
  await exec.exec('chmod', ['+x', downloadPath])
}

export function compareVersions(
  versionA: string,
  versionB: string
): ComparisonResult {
  const versionPartsA = versionA.split('.').map(Number)
  const versionPartsB = versionB.split('.').map(Number)

  for (let i = 0; i < versionPartsA.length; i++) {
    if (versionPartsA[i] > versionPartsB[i]) {
      return ComparisonResult.Greater
    } else if (versionPartsA[i] < versionPartsB[i]) {
      return ComparisonResult.Less
    }
  }
  return ComparisonResult.Equal
}

export async function validateFileCheckSum(
  filePath: string,
  expected: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', err => reject(err))
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => {
      const actual = hash.digest('hex')
      resolve(actual === expected)
    })
  })
}

export function isknownVersion(version: string): boolean {
  const pattern = new RegExp(`^.*-.*-${version}$`)
  return Object.keys(KNOWN_CHECKSUMS).some(key => pattern.test(key))
}

export function getArch(): Architecture | undefined {
  const arch = process.arch
  core.debug(`Arch: ${arch}`)
  const archMapping: {[key: string]: Architecture} = {
    ia32: 'x86',
    x64: 'x86_64',
    arm64: 'aarch64'
  }

  if (arch in archMapping) {
    return archMapping[arch]
  }
}

export function getPlatform(): Platform | undefined {
  const platform = process.platform
  core.debug(`Platform: ${platform}`)
  if (platform === 'linux') {
    return 'linux'
  } else if (platform === 'darwin') {
    return 'macos'
  } else if (platform === 'win32') {
    return 'windows'
  }
}

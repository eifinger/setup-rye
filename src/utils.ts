import * as fs from 'fs'
import * as crypto from 'crypto'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {KNOWN_CHECKSUMS} from './checksums'

export const IS_WINDOWS = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'
export const IS_MAC = process.platform === 'darwin'
export const WINDOWS_ARCHS = ['x86', 'x64']
export const WINDOWS_PLATFORMS = ['win32', 'win64']

export const REPO = 'rye'
export const OWNER = 'mitsuhiko'

export type Architecture = 'x86' | 'x86_64' | 'aarch64'

export async function validateCheckSum(
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
  const archMapping: {[key: string]: Architecture} = {
    ia32: 'x86',
    x64: 'x86_64',
    arm64: 'aarch64'
  }

  if (arch in archMapping) {
    return archMapping[arch]
  }
}

export async function getLinuxInfo(): Promise<{
  osName: string
  osVersion: string
}> {
  const {stdout} = await exec.getExecOutput('lsb_release', ['-i', '-r', '-s'], {
    silent: true
  })

  const [osName, osVersion] = stdout.trim().split('\n')

  core.debug(`OS Name: ${osName}, Version: ${osVersion}`)

  return {osName, osVersion}
}

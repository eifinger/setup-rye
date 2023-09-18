import * as fs from 'fs'
import * as crypto from 'crypto'
import * as exec from '@actions/exec'
import * as core from '@actions/core'

export const IS_WINDOWS = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'
export const IS_MAC = process.platform === 'darwin'
export const WINDOWS_ARCHS = ['x86', 'x64']
export const WINDOWS_PLATFORMS = ['win32', 'win64']

export const REPO = 'rye'
export const OWNER = 'mitsuhiko'

export const KNOWN_CHECKSUMS: {[key: string]: string} = {
  'aarch64-linux-0.13.0':
    'f09e4f0cc9114a1bc8b5f39f45fe7f20bb2c1b1a416afe4fdba02c5295f0d7df',
  'aarch64-macos-0.13.0':
    'e082822e44dceee8a535690cca76643c1428c41bc492cbe7160a873a66c4a3e5',
  'x86-windows-0.13.0':
    'f89ade3e9362741b02c245436e49908518c1f92677e33f366b47cdb000942a4e',
  'x86_64-linux-0.13.0':
    '07daa41c993594c3aeed4eff59974d01d10949f6a51bcdd1f8ada2866d87f795',
  'x86_64-macos-0.13.0':
    '921335016f8e74cad9918d67ec4f721c360bfff9ccb76c77959e1b295f4c9c8b',
  'x86_64-windows-0.13.0':
    '749a8caa46e834527af4527825e0d829dfe758486963e038f27b3c00c5a75641',

  'aarch64-linux-0.12.0':
    'dfc209bb35213b82b7dbe0784a60184fe3263e204a90da9f1bf672aacbbbdce1',
  'aarch64-macos-0.12.0':
    '01cd35aed836c4dc10841c3a622b3398354a0b124df1a59eefe60bd0296533cd',
  'x86-windows-0.12.0':
    'be48999d3c073405765f19064dd273e54ae529e81f31f81b3faa689a70974149',
  'x86_64-linux-0.12.0':
    'c48d850e90649d868d512f60af67c74aa844d80f951fdb38589220662e709da7',
  'x86_64-macos-0.12.0':
    '2b36b6d17218983a4c6f53c09ae45f1088525d289c8b5b6703b9081f771ad653',
  'x86_64-windows-0.12.0':
    '3dfae62b3f42ff89cbbe3c61582a871db034fb8a8c504b107a4e3613f9d18be4',

  'x86_64-linux-0.11.0':
    '00e795573477a2fe2b3c0ac748240364c3369218d314d1df47d2653764e9bfb1',
  'aarch64-linux-0.11.0':
    '7e0b1f6e3490a79c1d2600e8c04dd9ed4ea04d29d6c80f1f5a84a79736e9a21d'
}

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

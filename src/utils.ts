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
  'aarch64-linux-0.15.1':
    'bfde03a365a34a706e12a6183f0736fa3ff987e430be8356129b990c0458cbed',
  'aarch64-macos-0.15.1':
    'ae46af38c4416f15d521062e89259d748909e8221453c1c0c2528e2c78450ffb',
  'x86-windows-0.15.1':
    '7d25c0e0422adac9bde8fa875a01b01a399096d667f193244ca07251d9bf33b5',
  'x86_64-linux-0.15.1':
    '4bcf59f54e1aeaf50d129f9fe80f3ab598eda3d33c24d0bdec51192eaeac61b9',
  'x86_64-macos-0.15.1':
    'd21958e45ca024a84281c9f3c415c1f9fd4150f6a2e0ee22a26c6da4967eba60',
  'x86_64-windows-0.15.1':
    'fb199d7dc21adba15f799e11e91513dc30a84ea3f2f6c6327c53d8561a3ebc08',

  'aarch64-linux-0.15.0':
    '7975c69cddad29324d5123d541d587669e61a365bf310bfcc69404ce7038de1e',
  'aarch64-macos-0.15.0':
    '0598a95f91e155d37d905afb55d0f23625f0cf3efcbb4d3dd5c312224be98919',
  'x86-windows-0.15.0':
    'b9bd27b7190eee1968be608f714a2f9d24737eb34da02cf48a10c4687be1c5e3',
  'x86_64-linux-0.15.0':
    '8a0f202b3cf8706af331ec439e960503da30d74475ad23631526b9486563a0a2',
  'x86_64-macos-0.15.0':
    'd6ba7e02dbeb9501ca51d877041ee99c09f2726c483dbb400fe7041347743e9a',
  'x86_64-windows-0.15.0':
    '69eaf27ce69bba897b5f9f1a84cce1249e1a9ac2d80ec7dc3a791fe9302d95a1',

  'aarch64-linux-0.14.0':
    'eff31fe41152dcb0c43079f33e7c35fd4320c30928fa26ba44deef6583f27522',
  'aarch64-macos-0.14.0':
    'b19ff68bb63208e776f9002e23b548fcc605b215ca90a3847632ee9d28309e1c',
  'x86-windows-0.14.0':
    '6e2925f9c434458009d7dcccc36bf0a06ae009f51baf741713446bde80f985c4',
  'x86_64-linux-0.14.0':
    '007c01b1efa70f7d7d8d99f1705173dfbbf2427eef65e22c2fbe69c89ea3ca98',
  'x86_64-macos-0.14.0':
    '69949dd5c5e7acf951e5582548ba2d19321538667ec2c256cbbb69d14734d0f2',
  'x86_64-windows-0.14.0':
    'e3cb44ba8ce62de81ed90e35219cb96261523c55ab146a31ae1929e6463e8447',

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

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
  'aarch64-linux-0.19.0':
    '1b071990b2d709c954be8dac4e9ad4f1bcefad4187e3df34a16dff5ed885d925',
  'aarch64-macos-0.19.0':
    '994a345136b2ce19affc3ffd75e35e90c08cc8d4fc76eebdb704b0d4fb644eba',
  'x86-windows-0.19.0':
    'eea52596235d5538527355570e74d2fff074c406322b28be88f7809dc223eeee',
  'x86_64-linux-0.19.0':
    'b1cdb5489556e7ddc9d76206a03e85eda81c1c291a53ea4ac596646f0b35e0da',
  'x86_64-macos-0.19.0':
    '02b6a1b0dac8bfc9eb63b2b0667a2856eb99d7fecead599d63db1276fd51fe7b',
  'x86_64-windows-0.19.0':
    '81f48f4b9e6dfc5952af368c32bdb92d0dc46c08e11babb2e9ca99fd5b01a33a',

  'aarch64-linux-0.18.0':
    '7c74bfaf9befb4d8fda6966238b22c5d613693880094e33d176dd3e85827962f',
  'aarch64-macos-0.18.0':
    'df431f9318f2c2a5af4b470dd98502d79c6b39eab096198c9a30022d59d641f7',
  'x86-windows-0.18.0':
    '08fae09ecdee51e092ccd6ce3e0e4ef56b337525b2ccdf796e5dc02eb8cc06b3',
  'x86_64-linux-0.18.0':
    '42e7952444697fd36fcaca5af50b3731cda2bfb116ebacf69587f46833fdd246',
  'x86_64-macos-0.18.0':
    '69c55e68cd60b5ff7fbcedb57c555fd2fb506201a97e77a97aeadc6409e21bee',
  'x86_64-windows-0.18.0':
    '4e38b24abdad9ca4cce93a79ab1dbc5821451cc3e7cc00a4d756e3e61a25fad5',

  'aarch64-linux-0.17.0':
    '61d3f2b281d3e5f8a43eb24dd03fb32a8692ba3b2c22802e8d4052a53408b21c',
  'aarch64-macos-0.17.0':
    '8b5b7bfb2653d9ae2e397938c4c7ec45426154d5dfccf650a5cfe78073c979c6',
  'x86-windows-0.17.0':
    'f509b153bd92b92f1979bc452f9a174dee9ee0681ef73f71b918dd28f424e0cd',
  'x86_64-linux-0.17.0':
    '92a3f3727ea71c524a8a193fdc3bce6cc0588baf4510170423188ec8c4df23b1',
  'x86_64-macos-0.17.0':
    'f25c47662d3c6dd606a35fee631a3755e71939048755782ea584e2fe1eda59b9',
  'x86_64-windows-0.17.0':
    '8980175c67413f8a458a5b9c84afde8bbbdfbadb035894a28a0005c66464e7ae',

  'aarch64-linux-0.16.0':
    'b22de221a74179aafa4826d1f6b94fc2c67e886382e08e676c1cadd7a81656ef',
  'aarch64-macos-0.16.0':
    'eadf43cea2c56dfd7206ccdef3316d7716d1d154c60a524425bc2a3f4eb1c2ac',
  'x86-windows-0.16.0':
    '128f8dc1465d0f454efae14ca0b9554c2902242669d4ec66b2525fbb4401cca0',
  'x86_64-linux-0.16.0':
    'c1b1f0cf41801b10348074e7da1215ba95eadf1a45cad5a1345a5c70e2f183dd',
  'x86_64-macos-0.16.0':
    '60785f384d33135f6193b3255bf69ee2fbf2a25f7a65760e5ab74c77047745bb',
  'x86_64-windows-0.16.0':
    '0b8df5fda71ad88bdf69a3d0241156a0d7fa9b29a01e7eab68e16b1a760c5c35',

  'aarch64-linux-0.15.2':
    '42130f8ed85668cf42be71880c21c7b44068360acc2a4fc20833821c389ba806',
  'aarch64-macos-0.15.2':
    'f40373e757abf2ac2bcd5ad3e6b05bd9e8da0a47f30e10e4503f4908a32f5063',
  'x86-windows-0.15.2':
    'a494db45bc5e4d02b39be81d9c093cb0bb97cdced24fa041f37641db7a344e52',
  'x86_64-linux-0.15.2':
    'e649a4c95f459669023b78aba934fde6d98f2be646108070a23b7a5f651d7a01',
  'x86_64-macos-0.15.2':
    'f3284498077c10c367c35ab2ea0c19f6e9f75d97a51eff633b9479203f0791be',
  'x86_64-windows-0.15.2':
    '4e57a8b9856550d30c7fcba5b7a43abea68996e59f4cfb568e5f617cf9aad657',

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

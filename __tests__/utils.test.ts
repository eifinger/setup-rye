import {expect, test, it} from '@jest/globals'

import * as utils from '../src/utils'

test('checksum should match', async () => {
  const validChecksum =
    'f3da96ec7e995debee7f5d52ecd034dfb7074309a1da42f76429ecb814d813a3'
  const filePath = '__tests__/fixtures/checksumfile'
  const isValid = await utils.validateFileCheckSum(filePath, validChecksum)
  expect(isValid).toBeTruthy()
})

type KnownVersionFixture = {version: string; known: boolean}

it.each<KnownVersionFixture>([
  {
    version: '0.12.0',
    known: true
  },
  {
    version: '0.4.0',
    known: true
  },
  {
    version: '0.3.0',
    known: false
  }
])(
  'isknownVersion should return $known for version $version',
  ({version, known}) => {
    expect(utils.isknownVersion(version)).toBe(known)
  }
)

type VersionComparisonFixture = {
  versionA: string
  is: utils.ComparisonResult
  versionB: string
}

it.each<VersionComparisonFixture>([
  {
    versionA: '0.12.0',
    is: utils.ComparisonResult.Equal,
    versionB: '0.12.0'
  },
  {
    versionA: '0.12.0',
    is: utils.ComparisonResult.Less,
    versionB: '0.12.1'
  },
  {
    versionA: '0.12.0',
    is: utils.ComparisonResult.Less,
    versionB: '0.13.0'
  },
  {
    versionA: '0.12.1',
    is: utils.ComparisonResult.Greater,
    versionB: '0.12.0'
  },
  {
    versionA: '0.13.0',
    is: utils.ComparisonResult.Greater,
    versionB: '0.12.0'
  },
  {
    versionA: '1.0.0',
    is: utils.ComparisonResult.Greater,
    versionB: '0.12.0'
  }
])('$versionA should be $is to $versionB', ({versionA, is, versionB}) => {
  expect(utils.compareVersions(versionA, versionB)).toBe(is)
})

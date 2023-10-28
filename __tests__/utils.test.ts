import {expect, test} from '@jest/globals'

import * as utils from '../src/utils'

test('checksum should match', async () => {
  const validChecksum =
    'f3da96ec7e995debee7f5d52ecd034dfb7074309a1da42f76429ecb814d813a3'
  const filePath = '__tests__/fixtures/checksumfile'
  const isValid = await utils.validateCheckSum(filePath, validChecksum)
  expect(isValid).toBeTruthy()
})

test('known checksum should be true', () => {
  const isKnown = utils.isknownVersion('0.12.0')
  expect(isKnown).toBeTruthy()
})

test('unknown checksum should be false', () => {
  const isKnown = utils.isknownVersion('0.09.0')
  expect(isKnown).toBeFalsy()
})

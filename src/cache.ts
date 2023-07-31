import * as cache from '@actions/cache'
import * as glob from '@actions/glob'
import * as core from '@actions/core'

import {getLinuxInfo} from './utils'

const STATE_CACHE_PRIMARY_KEY = 'cache-primary-key'
const CACHE_MATCHED_KEY = 'cache-matched-key'
const CACHE_DEPENDENCY_PATH = '**/requirements**.lock'
const cachePath = `${process.env['GITHUB_WORKSPACE']}/.venv`

export async function run(): Promise<void> {
  try {
    const enableCache = core.getInput('enable-cache') === 'true'
    if (enableCache) {
      await saveCache()
    }
  } catch (error) {
    const err = error as Error
    core.setFailed(err.message)
  }
}

export async function restoreCache(
  cachePrefix: string,
  version: string
): Promise<void> {
  const {primaryKey, restoreKey} = await computeKeys(cachePrefix, version)
  if (primaryKey.endsWith('-')) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${CACHE_DEPENDENCY_PATH}], make sure you have checked out the target repository`
    )
  }

  let matchedKey: string | undefined
  try {
    matchedKey = await cache.restoreCache([cachePath], primaryKey, [restoreKey])
  } catch (err) {
    const message = (err as Error).message
    core.info(`[warning]${message}`)
    core.setOutput('cache-hit', false)
    return
  }

  core.saveState(STATE_CACHE_PRIMARY_KEY, primaryKey)

  handleMatchResult(matchedKey, primaryKey)
}

async function computeKeys(
  cachePrefix: string,
  version: string
): Promise<{primaryKey: string; restoreKey: string}> {
  const hash = await glob.hashFiles(CACHE_DEPENDENCY_PATH)
  let primaryKey = ''
  let restoreKey = ''
  const osInfo = await getLinuxInfo()
  primaryKey = `${cachePrefix}-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}-venv-${hash}`
  restoreKey = `${cachePrefix}-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}-venv`
  return {primaryKey, restoreKey}
}

function handleMatchResult(
  matchedKey: string | undefined,
  primaryKey: string
): void {
  if (matchedKey) {
    core.saveState(CACHE_MATCHED_KEY, matchedKey)
    core.info(`Cache restored from key: ${matchedKey}`)
  } else {
    core.info(`cache is not found`)
  }
  core.setOutput('cache-hit', matchedKey === primaryKey)
}

async function saveCache(): Promise<void> {
  const primaryKey = core.getState(STATE_CACHE_PRIMARY_KEY)
  const matchedKey = core.getState(CACHE_MATCHED_KEY)

  if (!primaryKey) {
    core.warning('Error retrieving key from state.')
    return
  } else if (matchedKey === primaryKey) {
    // no change in target directories
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    )
    return
  }

  let cacheId = 0

  try {
    cacheId = await cache.saveCache([cachePath], primaryKey)
  } catch (err) {
    const message = (err as Error).message
    core.info(`[warning]${message}`)
    return
  }

  if (cacheId === -1) {
    return
  }
  core.info(`Cache saved with the key: ${primaryKey}`)
}

run()

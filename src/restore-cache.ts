import * as cache from '@actions/cache'
import * as glob from '@actions/glob'
import * as core from '@actions/core'

import {getLinuxInfo} from './utils'

export const STATE_CACHE_PRIMARY_KEY = 'cache-primary-key'
export const CACHE_MATCHED_KEY = 'cache-matched-key'
const CACHE_DEPENDENCY_PATH = 'requirements**.lock'
const workingDir = `/${core.getInput('working-directory')}` || ''
const cachePath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.venv`
const cacheDependencyPath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/${CACHE_DEPENDENCY_PATH}`

export async function restoreCache(
  cachePrefix: string,
  version: string
): Promise<void> {
  const {primaryKey, restoreKey} = await computeKeys(cachePrefix, version)
  if (primaryKey.endsWith('-')) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${cacheDependencyPath}], make sure you have checked out the target repository`
    )
  }

  let matchedKey: string | undefined
  try {
    matchedKey = await cache.restoreCache([cachePath], primaryKey, [restoreKey])
  } catch (err) {
    const message = (err as Error).message
    core.warning(message)
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
  core.debug(`Computing cache key for ${cacheDependencyPath}`)
  const hash = await glob.hashFiles(cacheDependencyPath)
  let primaryKey = ''
  let restoreKey = ''
  const osInfo = await getLinuxInfo()
  primaryKey = `${cachePrefix}-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}-${workingDir}-${hash}`
  restoreKey = `${cachePrefix}-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}-${workingDir}`
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

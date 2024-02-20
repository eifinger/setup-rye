import * as crypto from 'crypto'
import * as cache from '@actions/cache'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import {cp} from '@actions/io/'
import {exists} from '@actions/io/lib/io-util'

import {IS_MAC, getLinuxInfo, getMacOSInfo} from './utils'

export const STATE_CACHE_PRIMARY_KEY = 'cache-primary-key'
export const STATE_CACHE_MATCHED_KEY = 'cache-matched-key'
const CACHE_DEPENDENCY_PATH = 'requirements**.lock'
const workingDirInput = core.getInput('working-directory')
const workingDir = workingDirInput ? `/${workingDirInput}` : ''
const cachePath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.venv`
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''
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
    matchedKey = cacheLocalStoragePath
      ? await restoreCacheLocal(primaryKey)
      : await cache.restoreCache([cachePath], primaryKey, [restoreKey])
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
  const dependencyPathHash = await glob.hashFiles(cacheDependencyPath)
  const workingDirHash = workingDir
    ? `-${crypto.createHash('sha256').update(workingDir).digest('hex')}`
    : ''
  const osInfo = IS_MAC ? await getMacOSInfo() : await getLinuxInfo()
  const prefix = cachePrefix ? `${cachePrefix}-` : ''
  const primaryKey = `${prefix}setup-rye-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}${workingDirHash}-${dependencyPathHash}`
  const restoreKey = `${prefix}setup-rye-${process.env['RUNNER_OS']}-${osInfo.osVersion}-${osInfo.osName}-rye-${version}${workingDirHash}`
  return {primaryKey, restoreKey}
}

function handleMatchResult(
  matchedKey: string | undefined,
  primaryKey: string
): void {
  if (matchedKey) {
    core.saveState(STATE_CACHE_MATCHED_KEY, matchedKey)
    core.info(`Cache restored from key: ${matchedKey}`)
  } else {
    core.info(`No cache found for key: ${primaryKey}`)
  }
  core.setOutput('cache-hit', matchedKey === primaryKey)
}

async function restoreCacheLocal(
  primaryKey: string
): Promise<string | undefined> {
  const storedCache = `${cacheLocalStoragePath}/${primaryKey}`
  if (!(await exists(storedCache))) {
    core.info(`Local cache is not found: ${storedCache}`)
    return
  }
  await cp(storedCache, cachePath, {
    copySourceDirectory: false,
    recursive: true
  })
  return primaryKey
}

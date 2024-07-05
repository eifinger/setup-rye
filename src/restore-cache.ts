import * as crypto from 'crypto'
import * as cache from '@actions/cache'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import * as fs from 'fs'
import {cp} from '@actions/io/'
import {exists} from '@actions/io/lib/io-util'
import {getArch} from './utils'

export const STATE_CACHE_KEY = 'cache-key'
export const STATE_CACHE_MATCHED_KEY = 'cache-matched-key'
export const workingDirInput = core.getInput('working-directory')
export const workingDir = workingDirInput ? `/${workingDirInput}` : ''
export const venvPath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.venv`
const CACHE_VERSION = '5'
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''
const cacheDependencyPath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/requirements**.lock`

export async function restoreCache(
  cachePrefix: string,
  version: string
): Promise<void> {
  const cacheKey = await computeKeys(cachePrefix, version)
  if (cacheKey.endsWith('-')) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${cacheDependencyPath}], make sure you have checked out the target repository`
    )
  }

  let matchedKey: string | undefined
  core.info(`Trying to restore .venv from cache with key: ${cacheKey}`)
  try {
    matchedKey = cacheLocalStoragePath
      ? await restoreCacheLocal(cacheKey)
      : await cache.restoreCache([venvPath], cacheKey)
  } catch (err) {
    const message = (err as Error).message
    core.warning(message)
    core.setOutput('cache-hit', false)
    return
  }

  core.saveState(STATE_CACHE_KEY, cacheKey)

  handleMatchResult(matchedKey, cacheKey)
}

async function computeKeys(
  cachePrefix: string,
  version: string
): Promise<string> {
  const cacheDependencyPathHash = await glob.hashFiles(cacheDependencyPath)
  const workingDirHash = workingDir
    ? `-${crypto.createHash('sha256').update(workingDir).digest('hex')}`
    : ''
  const prefix = cachePrefix ? `${cachePrefix}-` : ''
  return `${prefix}setup-rye-${CACHE_VERSION}-${process.env['RUNNER_OS']}-${getArch()}-rye-${version}${workingDirHash}-${cacheDependencyPathHash}`
}

function handleMatchResult(
  matchedKey: string | undefined,
  primaryKey: string
): void {
  if (!matchedKey) {
    core.info(
      `No${cacheLocalStoragePath ? ' local' : ''} cache found for key: ${primaryKey}`
    )
    core.setOutput('cache-hit', false)
    return
  }

  const venvPathMatch = doesCachedVenvPathMatchCurrentVenvPath()
  if (!venvPathMatch) {
    fs.rmSync(venvPath, {recursive: true})
    core.setOutput('cache-hit', false)
    return
  }

  core.saveState(STATE_CACHE_MATCHED_KEY, matchedKey)
  core.info(
    `.venv restored from${cacheLocalStoragePath ? ' local' : ''} cache with key: ${matchedKey}`
  )
  core.setOutput('cache-hit', true)
}

function doesCachedVenvPathMatchCurrentVenvPath(): boolean {
  const ryeVenvPath = `${venvPath}/rye-venv.json`
  const ryeVenv = JSON.parse(fs.readFileSync(ryeVenvPath, 'utf8'))
  core.info(
    `Checking if the cached .venv matches the current path: ${venvPath}`
  )
  if (ryeVenv.venv_path != venvPath) {
    core.warning(
      `The .venv in the cache cannot be used because it is from another location: ${ryeVenv.venv_path}`
    )
    return false
  }
  return true
}

async function restoreCacheLocal(
  primaryKey: string
): Promise<string | undefined> {
  const storedCache = `${cacheLocalStoragePath}/${primaryKey}`
  if (await exists(storedCache)) {
    await cp(`${storedCache}/.venv`, venvPath, {
      recursive: true
    })
    return primaryKey
  }
}

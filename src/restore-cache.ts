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
  if (matchedKey) {
    core.saveState(STATE_CACHE_MATCHED_KEY, matchedKey)
    core.info(
      `.venv restored from${cacheLocalStoragePath ? ' local' : ''} cache with key: ${matchedKey}`
    )
    overwriteCachedVenvPath()
    core.setOutput('cache-hit', true)
  } else {
    core.info(
      `No${cacheLocalStoragePath ? ' local' : ''} cache found for key: ${primaryKey}`
    )
    core.setOutput('cache-hit', false)
  }
}

/**
 * Overwrite the cached venv path in rye-venv.json
 *
 * Rye prevents unwanted behavior if people copy around .venv between projects.
 * But we can be sure, that we are always working with the same project but the base path of previous runners might be different.
 */
function overwriteCachedVenvPath(): void {
  const ryeVenvPath = `${venvPath}/rye-venv.json`
  let ryeVenv = JSON.parse(fs.readFileSync(ryeVenvPath, 'utf8'))
  core.debug(`venv_path in cache: ${ryeVenv.venv_path}`)
  core.debug(`Overwriting cached venv_path with ${venvPath}`)
  ryeVenv.venv_path = venvPath
  fs.writeFileSync(ryeVenvPath, JSON.stringify(ryeVenv))
}

async function restoreCacheLocal(
  primaryKey: string
): Promise<string | undefined> {
  const storedCache = `${cacheLocalStoragePath}/${primaryKey}`
  if (!(await exists(storedCache))) {
    core.info(`Local cache is not found: ${storedCache}`)
    return
  }
  await cp(`${storedCache}/.venv`, venvPath, {
    recursive: true
  })
  return primaryKey
}

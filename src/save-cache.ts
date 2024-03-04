import * as cache from '@actions/cache'
import * as core from '@actions/core'
import {mkdirP, cp, rmRF} from '@actions/io/'
import {
  STATE_CACHE_MATCHED_KEY,
  STATE_CACHE_KEY,
  venvPath,
  ryeHomePath
} from './restore-cache'

const enableCache = core.getInput('enable-cache') === 'true'
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''

export async function run(): Promise<void> {
  try {
    if (enableCache) {
      await saveCache()
    }
  } catch (error) {
    const err = error as Error
    core.setFailed(err.message)
  }
  rmRF(ryeHomePath)
  core.info(`Cleaned up RYE_HOME: ${ryeHomePath}`)
}

async function saveCache(): Promise<void> {
  const cacheKey = core.getState(STATE_CACHE_KEY)
  const matchedKey = core.getState(STATE_CACHE_MATCHED_KEY)

  if (!cacheKey) {
    core.warning('Error retrieving key from state.')
    return
  } else if (matchedKey === cacheKey) {
    // no change in target directories
    core.info(`Cache hit occurred on key ${cacheKey}, not saving cache.`)
    return
  }
  core.info(`Saving .venv path: ${venvPath}`)
  cacheLocalStoragePath
    ? await saveCacheLocal(cacheKey)
    : await cache.saveCache([venvPath], cacheKey)

  core.info(`Cache saved with the key: ${cacheKey}`)
}

async function saveCacheLocal(cacheKey: string): Promise<void> {
  const targetPath = `${cacheLocalStoragePath}/${cacheKey}`
  await mkdirP(targetPath)
  await cp(venvPath, `${targetPath}/.venv`, {
    recursive: true
  })
}

run()

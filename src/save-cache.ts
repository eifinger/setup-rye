import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as io from '@actions/io/'
import path from 'path'
import {
  STATE_CACHE_MATCHED_KEY,
  STATE_CACHE_KEY,
  VENV_PATH
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
  process.exit(0)
}

async function saveCache(): Promise<void> {
  const cacheKey = core.getState(STATE_CACHE_KEY)
  const matchedKey = core.getState(STATE_CACHE_MATCHED_KEY)

  if (!cacheKey) {
    core.warning('Error retrieving cache key from state.')
    return
  } else if (matchedKey === cacheKey) {
    // no change in target directories
    core.info(`Cache hit occurred on key ${cacheKey}, not saving .venv.`)
    return
  }
  core.info(`Saving .venv path: ${VENV_PATH}`)
  cacheLocalStoragePath
    ? await saveCacheLocal(cacheKey)
    : await cache.saveCache([VENV_PATH], cacheKey)

  core.info(`.venv saved with the key: ${cacheKey}`)
}

async function saveCacheLocal(cacheKey: string): Promise<void> {
  const targetPath = `${cacheLocalStoragePath}${path.sep}${cacheKey}`
  await io.mkdirP(targetPath)
  await io.cp(VENV_PATH, `${targetPath}${path.sep}.venv`, {
    recursive: true
  })
}

run()

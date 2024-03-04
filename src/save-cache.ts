import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as io from '@actions/io/'
import * as fs from 'fs'
import {
  STATE_CACHE_MATCHED_KEY,
  STATE_CACHE_KEY,
  venvPath
} from './restore-cache'
import {
  RYE_CONFIG_TOML,
  RYE_CONFIG_TOML_BACKUP,
  STATE_TOOL_CACHED_PATH
} from './utils'

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
  const cachedPath = core.getState(STATE_TOOL_CACHED_PATH)
  await io.rmRF(`${cachedPath}/${RYE_CONFIG_TOML}`)
  if (fs.existsSync(`${cachedPath}/${RYE_CONFIG_TOML}`)) {
    await io.mv(
      `${cachedPath}/${RYE_CONFIG_TOML_BACKUP}`,
      `${cachedPath}/${RYE_CONFIG_TOML}`
    )
    core.info(`Restored ${cachedPath}/${RYE_CONFIG_TOML}`)
  }
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
  await io.mkdirP(targetPath)
  await io.cp(venvPath, `${targetPath}/.venv`, {
    recursive: true
  })
}

run()

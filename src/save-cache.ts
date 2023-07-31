import * as cache from '@actions/cache'
import * as core from '@actions/core'
import {CACHE_MATCHED_KEY, STATE_CACHE_PRIMARY_KEY} from './restore-cache'

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

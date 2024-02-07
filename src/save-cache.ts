import * as cache from '@actions/cache'
import * as core from '@actions/core'
import {mkdirP, cp} from '@actions/io/'
import {CACHE_MATCHED_KEY, STATE_CACHE_PRIMARY_KEY} from './restore-cache'

const enableCache = core.getInput('enable-cache') === 'true'
const workingDir = `/${core.getInput('working-directory')}` || ''
const cacheLocalStoragePath =
  `${core.getInput('cache-local-storage-path')}` || ''
const cachePath = `${process.env['GITHUB_WORKSPACE']}${workingDir}/.venv`

export async function run(): Promise<void> {
  try {
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
  core.info(`Saving cache path: ${cachePath}`)
  cacheLocalStoragePath
    ? await saveCacheLocal(primaryKey)
    : await cache.saveCache([cachePath], primaryKey)

  core.info(`Cache saved with the key: ${primaryKey}`)
}

async function saveCacheLocal(primaryKey: string): Promise<void> {
  const targetPath = `${cacheLocalStoragePath}/${primaryKey}`
  await mkdirP(targetPath)
  await cp(cachePath, targetPath, {
    copySourceDirectory: false,
    recursive: true
  })
}

run()

import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as path from 'path'

async function run(): Promise<void> {
  const manifest = await tc.getManifestFromRepo('mitsuhiko', 'rye')
  core.info(`Manifest: ${JSON.stringify(manifest)}`)
  const platform = 'linux'
  const arch = 'x64'
  const version = core.getInput('version')
  try {
    const wasAdded = addRyeToPath(arch, version)
    if (!wasAdded) {
      await setupRye(platform, arch, version)
    }
  } catch (err) {
    core.setFailed((err as Error).message)
  }
}

function addRyeToPath(arch: string, version: string): boolean {
  core.info(`Trying to get Rye from cache for ${version}...`)
  const cachedVersions = tc.findAllVersions('rye', arch)
  core.info(`Cached versions: ${cachedVersions}`)
  const ryePath = tc.find('rye', version, arch)
  if (ryePath) {
    core.addPath(ryePath)
    core.info(`Added ${ryePath} to the path`)
    return true
  }
  return false
}

export async function setupRye(
  platform: string,
  arch: string,
  version: string
): Promise<void> {
  const binary = `rye-x86_64-${platform}`
  let downloadUrl = `https://github.com/mitsuhiko/rye/releases/download/${version}/${binary}.gz`
  if (version === 'latest') {
    downloadUrl = `https://github.com/mitsuhiko/rye/releases/latest/download/${binary}.gz`
  }
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  try {
    const downloadPath = await tc.downloadTool(downloadUrl)

    await extract(downloadPath)
    await installRye(downloadPath, arch, version)
  } catch (err) {
    if (err instanceof Error) {
      // Rate limit?
      if (
        err instanceof tc.HTTPError &&
        (err.httpStatusCode === 403 || err.httpStatusCode === 429)
      ) {
        core.info(
          `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
        )
      } else {
        core.info(err.message)
      }
      if (err.stack !== undefined) {
        core.debug(err.stack)
      }
    }
    throw err
  }
}

async function extract(downloadPath: string): Promise<void> {
  core.info('Extracting downloaded archive...')
  const pathForGunzip = `${downloadPath}.gz`
  await io.mv(downloadPath, pathForGunzip)
  await exec.exec('gunzip', [pathForGunzip])
  await exec.exec('chmod', ['+x', downloadPath])
}

async function installRye(
  downloadPath: string,
  arch: string,
  version: string
): Promise<string> {
  const tempDir = path.join(process.env['RUNNER_TEMP'] || '', 'rye_home')
  await io.mkdirP(tempDir)
  core.info(
    `Created temporary directory ${tempDir} to install rye into before moving to tools cache`
  )
  const options: exec.ExecOptions = {
    cwd: tempDir,
    env: {
      ...process.env,
      RYE_HOME: tempDir
    }
  }
  core.info(`Installing Rye into ${tempDir}`)
  await exec.exec(downloadPath, ['self', 'install', '--yes'], options)

  core.info('Moving installed Rye to cache')
  const cachedPath = await tc.cacheDir(tempDir, 'rye', version, arch)
  core.addPath(cachedPath)
  core.info(`Added ${cachedPath} to the path`)
  return cachedPath
}

run()

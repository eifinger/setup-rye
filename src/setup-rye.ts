import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as os from 'os'
import * as path from 'path'

async function run(): Promise<void> {
  try {
    await setupRye()
  } catch (err) {
    core.setFailed((err as Error).message)
  }
}

export async function setupRye(): Promise<void> {
  const binary = 'rye-x86_64-linux'
  const downloadUrl = `https://github.com/mitsuhiko/rye/releases/latest/download/${binary}.gz`
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  try {
    const downloadPath = await tc.downloadTool(downloadUrl)
    const arch: string = core.getInput('architecture') || os.arch()

    core.info('Extracting downloaded archive...')
    const pathForGunzip = `${downloadPath}.gz`
    await io.mv(downloadPath, pathForGunzip)
    await exec.exec('gunzip', [pathForGunzip])
    await exec.exec('chmod', ['+x', downloadPath])

    const cachedPath = await installRye(downloadPath, arch)
    core.addPath(cachedPath)
    core.info(`Added ${cachedPath} to the path`)
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

async function installRye(installPath: string, arch: string): Promise<string> {
  const tempDir = path.join(process.env['RUNNER_TEMP'] || '', 'rye_home')
  await io.mkdirP(tempDir)
  await io.cp(installPath, `${tempDir}/rye`)
  core.info(`Created temporary directory ${tempDir}`)
  const options: exec.ExecOptions = {
    cwd: tempDir,
    env: {
      ...process.env,
      RYE_HOME: tempDir
    }
  }
  await exec.exec(installPath, ['self', 'install', '--yes'], options)

  const cachedPath = await tc.cacheDir(tempDir, 'rye', '0.10.0', arch)

  return cachedPath
}

run()

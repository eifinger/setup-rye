import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import {Architecture, OWNER, REPO, extract, validateChecksum} from '../utils'

export async function downloadLatest(
  platform: string,
  arch: Architecture,
  checkSum: string | undefined,
  githubToken: string | undefined
): Promise<{downloadPath: string; version: string}> {
  const binary = `rye-${arch}-${platform}`
  const downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${binary}.gz`
  core.info(`Downloading Rye from "${downloadUrl}" ...`)

  const downloadPath = await tc.downloadTool(
    downloadUrl,
    undefined,
    githubToken
  )
  const pathForValidation = `${downloadPath}_for_validation.gz`
  await io.cp(downloadPath, pathForValidation)
  await extract(downloadPath)
  const version = await getVersion(downloadPath)
  await validateChecksum(checkSum, pathForValidation, arch, platform, version)

  return {downloadPath, version}
}

async function getVersion(downloadPath: string): Promise<string> {
  // Parse the output of `rye --version` to get the version
  // The output looks like
  // rye 0.27.0
  // commit: 0.27.0 (43ee4fce0 2024-02-26)
  // platform: macos (aarch64)
  // self-python: cpython@3.12
  // symlink support: true
  // uv enabled: true

  const options: exec.ExecOptions = {
    silent: !core.isDebug()
  }
  const execArgs = ['--version']

  let version = ''
  options.listeners = {
    stdout: (data: Buffer) => {
      version += data.toString()
    }
  }
  await exec.exec(downloadPath, execArgs, options)
  const lines = version.split('\n')
  const versionLine = lines[0]
  const parts = versionLine.split(' ')
  return parts[1]
}

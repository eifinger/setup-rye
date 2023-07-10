import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as os from 'os';
import * as fs from "fs"
import {
  IS_MAC,
  IS_WINDOWS,
} from './utils';

async function run() {
    if (IS_MAC) {
      process.env['AGENT_TOOLSDIRECTORY'] = '/Users/runner/hostedtoolcache';
    }
  
    if (process.env.AGENT_TOOLSDIRECTORY?.trim()) {
      process.env['RUNNER_TOOL_CACHE'] = process.env['AGENT_TOOLSDIRECTORY'];
    }
  
    core.debug(
      `Rye is expected to be installed into ${process.env['RUNNER_TOOL_CACHE']}`
    );
    try {
      await setupRye();
    } catch (err) {
      core.setFailed((err as Error).message);
    }
  }

  export async function setupRye() {
    const binary = "rye-x86_64-linux"
    const downloadUrl = `https://github.com/mitsuhiko/rye/releases/latest/download/${binary}.gz`
    core.info(`Downloading Rye from "${downloadUrl}" ...`);

  try {
    const downloadPath = await tc.downloadTool(downloadUrl);
    const arch: string = core.getInput('architecture') || os.arch();

    core.info('Extracting downloaded archive...');
    const pathForGunzip = `${downloadPath}.gz`
    await io.mv(downloadPath, pathForGunzip);
    await exec.exec("gunzip", [pathForGunzip])
    fs.chmodSync(downloadPath, 755)

    const cachedPath = await installRye(downloadPath, arch);
    core.addPath(cachedPath);
    core.info(`Added ${cachedPath} to the path`);
  } catch (err) {
    if (err instanceof Error) {
      // Rate limit?
      if (
        err instanceof tc.HTTPError &&
        (err.httpStatusCode === 403 || err.httpStatusCode === 429)
      ) {
        core.info(
          `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
        );
      } else {
        core.info(err.message);
      }
      if (err.stack !== undefined) {
        core.debug(err.stack);
      }
    }
    throw err;
  }
  }

async function installRye(installPath: string, arch: string) {
  const tempDir = `${installPath}-rye-home`
  await io.mkdirP(tempDir);
  const options: exec.ExecOptions = {"env": {"RYE_HOME": tempDir}}
  await exec.exec(installPath,["self", "install", "--yes"], options)

  const cachedPath = await tc.cacheDir(
    tempDir,
    "rye",
    "0.10.0",
    arch
  );

  return cachedPath;
}
  
run();
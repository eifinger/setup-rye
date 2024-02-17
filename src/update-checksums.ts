import * as github from '@actions/github'
import * as tc from '@actions/tool-cache'
import {OWNER, REPO} from './utils'
import {promises as fs} from 'fs'

async function run(): Promise<void> {
  const filePath = process.argv.slice(2)[0]
  const github_token = process.argv.slice(2)[1]

  const octokit = github.getOctokit(github_token)

  const response = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: OWNER,
    repo: REPO
  })
  const downloadUrls: string[] = response.flatMap(release =>
    release.assets
      .filter(asset => asset.name.endsWith('.sha256'))
      .map(asset => asset.browser_download_url)
  )
  await updateChecksums(filePath, downloadUrls)
}

async function updateChecksums(
  filePath: string,
  downloadUrls: string[]
): Promise<void> {
  await fs.rm(filePath)
  await fs.appendFile(
    filePath,
    '// AUTOGENERATED_DO_NOT_EDIT\nexport const KNOWN_CHECKSUMS: {[key: string]: string} = {\n'
  )
  let firstLine = true
  for (const downloadUrl of downloadUrls) {
    const content = await downloadAsset(downloadUrl)
    const key = getKey(downloadUrl)
    if (!firstLine) {
      await fs.appendFile(filePath, ',\n')
    }
    await fs.appendFile(filePath, `  '${key}':\n    '${content.trim()}'`)
    firstLine = false
  }
  await fs.appendFile(filePath, '}\n')
}

function getKey(downloadUrl: string): string {
  // https://github.com/mitsuhiko/rye/releases/download/0.4.0/rye-x86_64-windows.exe.sha256
  const parts = downloadUrl.split('/')
  const fileName = parts[parts.length - 1]
  const name = fileName.split('.')[0].split('rye-')[1]
  const version = parts[parts.length - 2]
  return `${name}-${version}`
}

async function downloadAsset(downloadUrl: string): Promise<string> {
  const downloadPath = await tc.downloadTool(downloadUrl)
  const content = await fs.readFile(downloadPath, 'utf8')
  return content
}

run()
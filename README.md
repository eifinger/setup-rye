# setup-rye

Set up your GitHub Actions workflow with a specific version of [rye](https://rye-up.com/).

* Install a version of rye and add it to the path
* Cache the installed version of rye to speed up consecutive runs on self-hosted runners
* Register problem matchers for error output
* Optional: Cache the virtual environment created by rye
* Optional: Verify the checksum of the downloaded rye executable

> [!TIP]
> Want to switch to [uv](https://docs.astral.sh/uv)? Check out [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv)

## Usage

Example workflow can be found [in this repo](https://github.com/eifinger/pywaze/blob/main/.github/workflows/ci.yml)

```yaml
- name: Install the latest version of rye
  uses: eifinger/setup-rye@v4
```

### Install latest version

By default this action installs the version defined as `default` in `action.yml`.
This gets automatically updated in a new release of this action when a new version of rye is released.
If you don't want to wait for a new release of this action you can use use `version: latest`.

> [!WARNING]  
> Using the `latest` version means that the rye executable gets downloaded every single time instead of loaded from the tools cache.
> This can take up to 20s depending on the download speed.
> This does not affect the cached version of `.venv` when caching is enabled.

```yaml
- name: Install a specific version
  uses: eifinger/setup-rye@v4
  with:
    version: 'latest'
```

### Install specific version

You can also specify a specific version of rye

```yaml
- name: Install a specific version
  uses: eifinger/setup-rye@v4
  with:
    version: '0.12.0'
```

### Validate checksum

You can also specify a checksum to validate the downloaded file.
Checksums of versions 0.12.0 and later are automatically verified by this action.
The sha265 hashes can be found on the [releases page](https://github.com/astral-sh/rye/releases)
of the rye repo.

```yaml
- name: Install a specific version and validate the checksum
  uses: eifinger/setup-rye@v4
  with:
    version: '0.12.0'
    checksum: 'c48d850e90649d868d512f60af67c74aa844d80f951fdb38589220662e709da7'
```

### Enable caching

If you enable caching the virtual environment which gets created by `rye` under `.venv` will
be cached. This can speed up runs which can reuse the cache
by several minutes.

You can optionally define a custom cache key prefix.

```yaml
- name: Enable caching and define a custom cache key prefix
  id: setup-rye
  uses: eifinger/setup-rye@v4
  with:
    enable-cache: true
    cache-prefix: 'optional-prefix'
```

When the cache was successfully restored the output `cache-hit` will be set to `true` and you can use it in subsequent steps.
For the example above you can use it like this:

```yaml
- name: Do something if the cache was restored
  if: steps.setup-rye.outputs.cache-hit == 'true'
  run: echo "Cache was restored"
```

#### Working directory

If your rye project is not at the root of the repository you can specify the working directory
relative to the repository root. This is useful for monorepos.

```yaml
- name: Enable caching and define a working directory
  uses: eifinger/setup-rye@v4
  with:
    enable-cache: true
    working-directory: 'path/to/rye/project'
```

#### Local storage path

If you want to save the cache to a local path you can specify the path with the `cache-local-storage-path` input.
This can be useful if you are on a self hosted runner and want to save time and network traffic.

```yaml
- name: Enable caching and define a custom cache path
  uses: eifinger/setup-rye@v4
  with:
    enable-cache: true
    cache-local-storage-path: '/path/to/cache'
```

It is recommended to cleanup the storage path to avoid running out of disk space.
One option is to use a cron job to delete files older than 7 days like below.

```yaml
0 0 * * * find /home/ubuntu/setup-rye-cache -type d -mtime +7 -exec rm -rf {} \;
```

### API rate limit

To avoid hitting the error `API rate limit exceeded` you can supply a GitHub token with the `github-token` input.

```yaml
- name: Install rye and supply a GitHub token
  uses: eifinger/setup-rye@v4
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

This action downloads rye from the releases of the [rye repo](https://github.com/astral-sh/rye) and uses the [GitHub Actions Toolkit](https://github.com/actions/toolkit) to cache it as a tool to speed up consecutive runs especially on self-hosted runners.

The installed version of rye is then added to the runner path so other steps can just use it by calling `rye`.
To prevent interfering the other rye processes on the same runner `RYE_HOME` gets set to the repository roots parent and is cleaned up after a workflow run.

## FAQ

### Do I still need actions/setup-python when using this action?

No! This action was modelled as a drop-in replacement for `actions/setup-python` when using rye.

A simple example workflow could look like this:

```yaml
- name: Checkout the repository
  uses: actions/checkout@v2
- name: Install the latest version of rye
  uses: eifinger/setup-rye@v4
  with:
    enable-cache: true
- name: Sync dependencies
  run: rye sync
- name: Lint
  run: rye lint
```

---

[<img src="https://raw.githubusercontent.com/eifinger/setup-rye/main/docs/images/bmc-button.svg" width=150 height=40 style="margin: 5px"/>](https://www.buymeacoffee.com/eifinger)
[<img src="https://raw.githubusercontent.com/eifinger/setup-rye/main/docs/images/paypal-button.svg" width=150 height=40 style="margin: 5px"/>](https://paypal.me/kevinstillhammer)

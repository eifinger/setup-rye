# setup-rye

Set up your GitHub Actions workflow with a specific version of [rye](https://rye-up.com/).

* Install a version of rye and add it to the path
* Cache the installed version of rye to speed up consecutive runs on self-hosted runners
* Register problem matchers for error output

## Limitations

1. Currently only linux is supported see [issue #10](https://github.com/eifinger/setup-rye/issues/10)

## Usage

```yaml
- name: Install the latest version of rye
  uses: eifinger/setup-rye@v1
```

### Install specific version

You can also specify a specific version of rye

```yaml
- name: Install a specific version
  uses: eifinger/setup-rye@v1
  with:
    version: '0.11.0'
```

### Validate checksum

You can also specify a checksum to validate the downloaded file.
The sha265 hashes can be found on the [releases page](https://github.com/mitsuhiko/rye/releases)
of the rye repo.

```yaml
- name: Install a specific version and validate the checksum
  uses: eifinger/setup-rye@v1
  with:
    version: '0.11.0'
    checksum: '00e795573477a2fe2b3c0ac748240364c3369218d314d1df47d2653764e9bfb1'
```

### Enable caching

If you enable caching the virtual environment under which gets created by `rye` under `.venv` will
be cached. You can optionally define a custom cache key prefix.

```yaml
- name: Enable caching and define a custom cache key prefix
  uses: eifinger/setup-rye@v1
  with:
    enable-cache: true
    cache-prefix: 'optional-prefix'
```

## How it works

This action downloads rye from the releases of the [rye repo](https://github.com/mitsuhiko/rye) and uses the [GitHub Actions Toolkit](https://github.com/actions/toolkit) to cache it as a tool to speed up consecutive runs especially on self-hosted runners.

The installed version of rye is then added to the runner path so other steps can just use it by calling `rye`.

---

[<img src="https://raw.githubusercontent.com/eifinger/setup-rye/main/docs/images/bmc-button.svg" width=150 height=40 style="margin: 5px"/>](https://www.buymeacoffee.com/eifinger)
[<img src="https://raw.githubusercontent.com/eifinger/setup-rye/main/docs/images/paypal-button.svg" width=150 height=40 style="margin: 5px"/>](https://paypal.me/kevinstillhammer)

# setup-rye

Set up your GitHub Actions workflow with a specific version of [rye](https://rye-up.com/).

* Install a version of rye and add it to the path
* Cache the installed version of rye to speed up consecutive runs on self-hosted runners
* Register problem matchers for error output

## Limitations

1. Currently only linux is supported see [issue #10](https://github.com/eifinger/setup-rye/issues/10)
1. Currently only **x64** is supported see [issue #11](https://github.com/eifinger/setup-rye/issues/11)

## Usage

```yaml
- name: Install the latest version of rye
  uses: eifinger/setup-rye@v1
```

You can also specify a specific version of rye

```yaml
- name: Install a specific version
  uses: eifinger/setup-rye@v1
  with:
    version: '0.11.0'
```

## How it works

This action downloads rye from the releases of the [rye repo](https://github.com/mitsuhiko/rye) and uses the [GitHub Actions Toolkit](https://github.com/actions/toolkit) to cache it as a tool to speed up consecutive runs especially on self-hosted runners.

The installed version of rye is then added to the runner path so other steps can just use it by calling `rye`.

---

<a href="https://www.buymeacoffee.com/eifinger" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/black_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a><br>

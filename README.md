# Feather Phrase Sync

This repository contains a shared Github Action to sync up a repo with Phrase via upload of the 'en' locale file.

## Usage

This action can be run in 2 modes: regular and "reset" mode.

### Regular mode

Regular mode is used to sync up Phrase from a supplied English locale file and is the mode that should be triggered on merge in your repo. It will add new keys, update changed keys and [exclude](https://developers.phrase.com/api/#patch-/projects/-project_id-/keys/exclude) unmentioned keys.

```yaml
name: Sync Phrase from en.json

on:
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  phrase-exreset:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: getPopsure/phrase-sync@v0.0.8
        with:
          phrase_token: ${{ secrets.PHRASE_AUTH_TOKEN }}
          project_id: YOUR_PROJECT_ID_GOES_HERE
          english_locale_file_path: ./src/locales/en.json
```

### "Reset" mode

Reset mode can be used to add a workflow to your repo that allows for "resetting" the aforementioned automatic exclusions in case the exclusion fails and accidentally excludes ALL keys or similar. It is advised to only run such a workflow manually via workflow_dispatch

```yaml
name: Reset exclusions from Phrase

on: workflow_dispatch

jobs:
  phrase-reset-exclusions:
    runs-on: ubuntu-latest
    steps:
      - uses: getPopsure/phrase-sync@v0.0.8
        with:
          phrase_token: ${{ secrets.PHRASE_AUTH_TOKEN }}
          project_id: YOUR_PROJECT_ID_GOES_HERE
          reset: true
```

⚠️ Avoid using the `@main` branch of the `phrase-sync` repo, as this branch can potentially be unstable.

## Releasing a new version

1. Make your changes
2. Run `yarn prepare` to create the **dist** files

   ⚠️ IMPORTANT: THESE NEED TO BE CHECKED IN!

3. Get your PR approved and merged
4. Create a new release via the [Github Releases](https://github.com/getPopsure/phrase-sync/releases) page

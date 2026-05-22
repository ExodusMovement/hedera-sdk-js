# Hedera™ Hashgraph JavaScript SDK

[![](https://img.shields.io/discord/373889138199494658)](https://discord.com/channels/373889138199494658/616725732650909710)
[![Docs](https://img.shields.io/badge/docs-%F0%9F%93%84-blue)](https://docs.hedera.com/guides/getting-started/javascript/environment-set-up)
[![NPM Package](https://img.shields.io/npm/v/@hashgraph/sdk.svg)](https://www.npmjs.org/package/@hashgraph/sdk)

> The JavaScript SDK for interacting with Hedera Hashgraph: the official distributed
> consensus platform built using the hashgraph consensus algorithm for fast,
> fair and secure transactions. Hedera enables and empowers developers to
> build an entirely new class of decentralized applications.

## Install

**NOTE**: v1 of the SDK is deprecated and support will be discontinued after October 2021. Please install the latest version 2.x or migrate from v1 to the latest 2.x version. You can reference the [migration documentation](/MIGRATING_V1.md).

```
# with NPM
$ npm install --save @hashgraph/sdk

# with Yarn
$ yarn add @hashgraph/sdk

# with PNPM
$ pnpm add @hashgraph/sdk
```
## React Native Support

The Hedera JavaScript SDK supports the following:

* React Native with Expo on Android devices and Android emulators

The Hedera JavaScript SDK does not currently support the following:

* React Native Bare



## Usage

See [examples](./examples).

## Releasing (Exodus fork)

The Exodus fork publishes as `@exodus/hashgraph-sdk` to npm. There is no CI release pipeline — it's a manual `npm publish` from the repo root.

The `prepare` script (compile + tsc) currently can't run end-to-end because of pre-existing type errors, so publishing requires `--ignore-scripts` and the `lib/` must be compiled manually first.

1. Bump `version` in `package.json` (e.g. `2.6.0-exodus.17` → `2.6.0-exodus.18`).
2. Compile `lib/`:
   ```
   yarn compile:js
   ```
3. (Optional) Inspect what will ship vs the currently-published artifact:
   ```
   npm pack --ignore-scripts --pack-destination=/tmp
   npm pack @exodus/hashgraph-sdk@<previous-version> --pack-destination=/tmp
   # extract both and diff
   ```
4. Commit using the bare version as the message (matches existing history):
   ```
   git commit -am "2.6.0-exodus.18"
   ```
5. Publish:
   ```
   npm publish --ignore-scripts --tag latest
   ```
   `--tag latest` is required for prerelease versions (the `-exodus.N` suffix). Add `--otp=<code>` if your account has 2FA.
6. Tag and push:
   ```
   git tag 2.6.0-exodus.18
   git push --follow-tags
   ```

You need `read-write` access on the `@exodus/hashgraph-sdk` package: `npm access list collaborators @exodus/hashgraph-sdk`.

## Contributing to this Project

We welcome participation from all developers!
For instructions on how to contribute to this repo, please
review the [Contributing Guide](CONTRIBUTING.md).

## License Information

Licensed under Apache License,
Version 2.0 – see [LICENSE](LICENSE) in this repo
or [apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).

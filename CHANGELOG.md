## [0.3.1](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.3.0...v0.3.1) (2019-02-02)


### Bug Fixes

* **rename:** Fix a missed edge case ([526756a](https://github.com/ShadowZero3000/discord-soundboard/commit/526756a))

# [0.3.0](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.2.2...v0.3.0) (2019-02-02)


### Bug Fixes

* **tests:** Fix those unit tests ([5d75abd](https://github.com/ShadowZero3000/discord-soundboard/commit/5d75abd))


### Features

* **clientside:** Do rendering logic clientside. Add search. ([d0ec451](https://github.com/ShadowZero3000/discord-soundboard/commit/d0ec451))
* **subcategories:** Support subcategories ([2969a02](https://github.com/ShadowZero3000/discord-soundboard/commit/2969a02))

## [0.2.2](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.2.1...v0.2.2) (2018-12-12)


### Bug Fixes

* **layout:** More layout changes ([7fb19ba](https://github.com/ShadowZero3000/discord-soundboard/commit/7fb19ba))

## [0.2.1](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.2.0...v0.2.1) (2018-12-11)


### Bug Fixes

* **layout:** Change to an F-Style layout ([c8df9a4](https://github.com/ShadowZero3000/discord-soundboard/commit/c8df9a4))

# [0.2.0](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.7...v0.2.0) (2018-11-13)


### Bug Fixes

* **help:** Fix the help message ([7dc9717](https://github.com/ShadowZero3000/discord-soundboard/commit/7dc9717))
* **missing_persons:** Try a different code path ([bf8a5b9](https://github.com/ShadowZero3000/discord-soundboard/commit/bf8a5b9))
* **timeout:** Extend timeout to 15m, because it's better ([8b0d527](https://github.com/ShadowZero3000/discord-soundboard/commit/8b0d527))
* **voicechannels:** Attempt to fix missing persons again ([e23ab95](https://github.com/ShadowZero3000/discord-soundboard/commit/e23ab95))


### Features

* **logout:** Add a logout function ([3d44970](https://github.com/ShadowZero3000/discord-soundboard/commit/3d44970))
* **nightmode:** Add night mode ([c47f854](https://github.com/ShadowZero3000/discord-soundboard/commit/c47f854))

## [0.1.7](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.6...v0.1.7) (2018-10-10)


### Bug Fixes

* **missing_channels:** Fix when a user travels to a server I don't know ([5a7db84](https://github.com/ShadowZero3000/discord-soundboard/commit/5a7db84))

## [0.1.6](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.5...v0.1.6) (2018-10-09)


### Bug Fixes

* **random:** Fix the issue with partial matches in randoms ([d601c68](https://github.com/ShadowZero3000/discord-soundboard/commit/d601c68))

## [0.1.5](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.4...v0.1.5) (2018-10-08)


### Bug Fixes

* **Access:** Remove references to the old 'AdminList' ([d516a2f](https://github.com/ShadowZero3000/discord-soundboard/commit/d516a2f))
* **webapi:** Fix bad response from Discord ([04e17bf](https://github.com/ShadowZero3000/discord-soundboard/commit/04e17bf))

## [0.1.4](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.3...v0.1.4) (2018-10-06)


### Bug Fixes

* **testing:** Fix drone file ([62d5d34](https://github.com/ShadowZero3000/discord-soundboard/commit/62d5d34))
* **testing:** Improve tests, eliminate a bunch of junk ([a16e323](https://github.com/ShadowZero3000/discord-soundboard/commit/a16e323))

## [0.1.3](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.2...v0.1.3) (2018-10-03)


### Bug Fixes

* **sorting:** Fix sorting after files added ([d46b3bd](https://github.com/ShadowZero3000/discord-soundboard/commit/d46b3bd))

## [0.1.2](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.1...v0.1.2) (2018-10-03)


### Bug Fixes

* **media:** Move some media around, create favicon ([71330d7](https://github.com/ShadowZero3000/discord-soundboard/commit/71330d7))
* **requests:** Move requests to persistent storage location ([2b1751e](https://github.com/ShadowZero3000/discord-soundboard/commit/2b1751e))

## [0.1.1](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.1.0...v0.1.1) (2018-09-28)


### Bug Fixes

* **cookies:** Announce that, like every website since the stone age, this site has delicious cookies that are "totally not for doing bad things" ([dd948a0](https://github.com/ShadowZero3000/discord-soundboard/commit/dd948a0))

# [0.1.0](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.9...v0.1.0) (2018-09-18)


### Features

* **requests:** Add a requests feature for admins to remind themselves ([d5eb1fd](https://github.com/ShadowZero3000/discord-soundboard/commit/d5eb1fd))
* **requests:** Add a simple data store for the requests to persist ([e30cecc](https://github.com/ShadowZero3000/discord-soundboard/commit/e30cecc))

## [0.0.9](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.8...v0.0.9) (2018-09-17)


### Bug Fixes

* **bug:** Don't allow randoms that end in numbers (so wow10 and wow11 doesn't have wow1 as a random) ([9c85efa](https://github.com/ShadowZero3000/discord-soundboard/commit/9c85efa))

## [0.0.8](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.7...v0.0.8) (2018-09-13)


### Bug Fixes

* **sessions:** Automatically refresh your discord session ([29d3335](https://github.com/ShadowZero3000/discord-soundboard/commit/29d3335))

## [0.0.7](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.6...v0.0.7) (2018-09-13)


### Bug Fixes

* **adminutils:** Don't allow users to be granted bogus access (and potentially features added in the future) ([e4d1ba3](https://github.com/ShadowZero3000/discord-soundboard/commit/e4d1ba3))
* **bugs:** Minor bugs in file management ([dcca158](https://github.com/ShadowZero3000/discord-soundboard/commit/dcca158))
* **categories:** Add admin functionality for categorizing files (even in bulk) ([88b1084](https://github.com/ShadowZero3000/discord-soundboard/commit/88b1084))
* **messaging:** Add 'help' options to commands ([07b3c87](https://github.com/ShadowZero3000/discord-soundboard/commit/07b3c87))
* **messaging:** Add separate messaging for admin access now, based on what permissions a user has ([5bc79c7](https://github.com/ShadowZero3000/discord-soundboard/commit/5bc79c7))

## [0.0.6](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.5...v0.0.6) (2018-09-13)


### Bug Fixes

* **build:** Fix up the build again ([3763169](https://github.com/ShadowZero3000/discord-soundboard/commit/3763169))

## [0.0.5](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.4...v0.0.5) (2018-09-13)


### Bug Fixes

* **build:** Add a base docker image so that rebuilds don't have to re-obtain slow stuff ([3ec6166](https://github.com/ShadowZero3000/discord-soundboard/commit/3ec6166))

## [0.0.4](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.3...v0.0.4) (2018-09-11)


### Bug Fixes

* **pipeline:** Try not using skip ([f5a62f7](https://github.com/ShadowZero3000/discord-soundboard/commit/f5a62f7))

## [0.0.3](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.2...v0.0.3) (2018-09-11)


### Bug Fixes

* **pipeline:** Update pipeline to deploy to build/deploy to production on successful releases ([cc7834b](https://github.com/ShadowZero3000/discord-soundboard/commit/cc7834b))

## [0.0.2](https://github.com/ShadowZero3000/discord-soundboard/compare/v0.0.1...v0.0.2) (2018-09-11)


### Bug Fixes

* **release-pipeline:** Implement Semantic-release tooling as part of the deploy pipeline ([04cdc25](https://github.com/ShadowZero3000/discord-soundboard/commit/04cdc25))

## 0.0.1


### Initial version

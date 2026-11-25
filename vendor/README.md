# Pages build dependencies

Pages builds with the published `@webwriter/widget` 1.6.0 SDK, which includes
obstacle-avoiding routes and rewiring for the branching editor. The SDK is a build
dependency and is bundled together with the Lit adapter so Pages can use these
features in documents with an older shared SDK. The build checks its output for
unexpected shared SDK or adapter imports.

## Build tool snapshot

`webwriter-build-f0a93df1.tgz` packages `@webwriter/build` from
`webwriter-app/webwriter` commit `f0a93df1`. It handles `.icon.svg` exports
as assets. The published 1.15.0 build still treats them as scripts.

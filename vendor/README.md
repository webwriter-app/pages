# Scene SDK snapshot

`webwriter-widget-670d4358.tgz` contains the built `@webwriter/widget` SDK from
`webwriter-app/webwriter` commit `670d4358`.
It adds `route="avoid"` and supports dragging or click-and-move rewiring of selected
connections at either port. Published SDK versions currently lack these changes.
The SDK's MIT license is included in the archive.

Pages installs this archive as a build-time dependency through its lockfile.
The SDK is bundled from that development dependency, and `@webwriter/lit` is
explicitly prebuilt with it. The adapter must be built with the SDK so Scene controllers and elements use the same class definitions.
This prevents the editor's shared import map from substituting an older SDK.
`npm ci` restores the same snapshot without requiring another checkout or links.
The build checks the actual output for leaked SDK/adapter imports.

The file dependency is development-only so installing a published Pages package
does not try to fetch a package-relative SDK archive.

When an SDK release includes these Scene changes, restore it as a runtime
dependency, update the lockfile, and remove this snapshot. Verify the built
package before restoring shared SDK imports.

## Build tool snapshot

`webwriter-build-f0a93df1.tgz` packages `@webwriter/build` from
`webwriter-app/webwriter` commit `f0a93df1`. That commit handles `.icon.svg`
exports as assets. The published 1.15.0 build still treats them as scripts.
Use a published release once it includes the icon export fix.

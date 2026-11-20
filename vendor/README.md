# Scene SDK snapshot

`webwriter-widget-db77f1fb.tgz` contains the built `@webwriter/widget` SDK from
`webwriter-app/webwriter` commit `db77f1fb`.
It adds `route="avoid"`; the published SDK versions currently lack this mode.
The SDK's MIT license is included in the archive.

Pages installs this archive as a build-time dependency through its lockfile.
The SDK is bundled from that development dependency, and `@webwriter/lit` is
explicitly prebuilt with it. The adapter must be built with the SDK so Scene controllers and elements use the same class definitions.
This prevents the editor's shared import map from substituting an older SDK.
`npm ci` restores the same snapshot without requiring another checkout or links.
The build checks the actual output for leaked SDK/adapter imports.

The file dependency is development-only so installing a published Pages package
does not try to fetch a package-relative SDK archive.

When an SDK release includes the routing change, restore it as a runtime
dependency, update the lockfile, and remove this snapshot. Verify the built
package before restoring shared SDK imports.

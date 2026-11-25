// Validate the artifact, rather than substituting a newer SDK in a test build.
// The editor's shared import map may resolve an SDK without route="avoid".
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const entries = Object.entries(manifest.exports)
    .filter(([name]) => name.startsWith("./widgets/") && !name.endsWith(".icon.svg"))
    .map(([, entry]) => fileURLToPath(new URL(`../${entry.default.replace(".*", ".js")}`, import.meta.url)));

await build({
    entryPoints: entries,
    bundle: true,
    write: false,
    outdir: "dist",
    format: "esm",
    logLevel: "silent",
    plugins: [{
        name: "require-bundled-scene-sdk",
        setup(build) {
            build.onResolve({ filter: /^[^./]/ }, ({ path }) => {
                if (/^@webwriter\/(widget|lit)(\/|$)/.test(path)) {
                    return { errors: [{ text: `${path} is still a shared import. Bundle the pinned SDK and its Lit adapter so route="avoid" cannot fall back to straight lines.` }] };
                }
                return { path, external: true };
            });
        },
    }],
});
console.log("Pages artifacts contain the Scene SDK and its Lit adapter.");

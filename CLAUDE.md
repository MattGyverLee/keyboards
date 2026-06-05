# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

This is the **Open Source Keyman Keyboards repository** — a collection of keyboard layout definitions for linguistic input across hundreds of languages and writing systems. Keyman is a platform by SIL International. The compiler (`kmc`) turns `.kmn` source files into distributable `.kmp` packages.

## Build Commands

All builds use Bash. On Windows, run via Git Bash or use `build.cmd` which wraps `build.sh`.

```bash
./build.sh configure                        # Install npm deps (kmc compiler)
./build.sh build                            # Build all keyboards
./build.sh -k release/a/akan               # Build a single keyboard
./build.sh -k release/a                    # Build a whole group
./build.sh clean                            # Remove build artifacts
```

The `-k` flag accepts any path under `release/`, `experimental/`, or `legacy/`.

**Dependency:** Node.js 18.0+ and Bash 5.0+ (Git Bash on Windows). The compiler is `@keymanapp/kmc`, installed by `configure`.

## Repository Layout

```
release/        # Production keyboards (Unicode-only, no PUA)
experimental/   # Keyboards under development (PUA acceptable)
legacy/         # Binary distributions from Tavultesoft (pre-compiled)
release/shared/ # Shared fonts and assets used across keyboards
release/template/ # Template for new keyboards
resources/      # Build framework shell scripts
tools/          # jq, 7z, and other build utilities
docs/           # Docs for custom build scripts and external keyboards
```

Keyboards are organized alphabetically by first letter or by prefix (e.g. `sil/`, `gff/`) within each top-level category.

## Keyboard Source File Types

| Extension | Purpose |
|---|---|
| `.kmn` | Keyboard rules source (text, defines key mappings) |
| `.kpj` | Keyman Developer project file (XML) |
| `.kps` | Package specification (metadata for distribution) |
| `.kvks` | Visual keyboard (on-screen layout) |
| `.keyman-touch-layout` | Mobile touch layout |
| `.keyboard_info` | JSON metadata (auto-generated during build) |
| `.kmp` | Compiled, redistributable package (build output) |

## Each Keyboard's Structure

```
release/a/akan/
  ├── akan.kpj              # Project file (required for build targeting)
  ├── README.md
  ├── HISTORY.md
  ├── LICENSE.md
  └── source/
      ├── akan.kmn
      ├── akan.kps
      ├── akan.kvks          # optional
      ├── akan.keyman-touch-layout  # optional
      └── help/
```

Build output lands in a `build/` subdirectory (git-ignored).

## Build System Architecture

- `build.sh` — top-level entry point; parses `-k` targets, delegates to `resources/`
- `resources/builder.inc.sh` — standard build framework (functions for configure/build/clean/test)
- `resources/build_targets.inc.sh` — collects `.kpj`+`.kps` pairs, separates regular/legacy/external/package targets
- `resources/external.inc.sh` — handles keyboards sourced from GitHub or binary downloads (with SHA256 verification)
- `ci.sh` — used in CI to zip `.keyboard_info` files and upload to downloads.keyman.com

Keyboards with special build needs (e.g. `release/packages/fv_all/`) have their own `build.sh` that sources the shared utilities.

## External Keyboards

Some keyboards live in external repos. An `external_source` file in the keyboard directory specifies either:
- A GitHub repository + commit hash (source is cloned and compiled)
- A binary download URL + SHA256 (pre-built `.kmp` is fetched)

See `docs/externally-hosted-keyboards.md` for details.

## Code Intelligence (Codegraph)

This repo has a [Codegraph](https://codegraph.dev) index (`.codegraph/`) that provides fast, indexed lookups across all source files. **Prefer codegraph tools over Glob/Grep/Read for any file listing, symbol search, or codebase exploration.**

- `codegraph_files` — list or search files by path/glob pattern
- `codegraph_explore` — answer architecture/how-does-X-work questions with verbatim source
- `codegraph_search` — locate a specific symbol by name

Only fall back to raw Glob/Grep/Read for content not indexed by codegraph (e.g. `.md`, `.kps`, image assets, non-source files).

## Contributing Workflow

1. Modify source files under the keyboard's `source/` directory.
2. Build and verify locally: `./build.sh -k release/path/to/keyboard`
3. Fix all compiler warnings (`kmc` is invoked with `-W --for-publishing`).
4. Update `HISTORY.md` with the new version.
5. Before committing: remove any `build/` folders and `.kpj.user` files.
6. Open a pull request.

`.kpj.user` files and `build/` directories are git-ignored and should never be committed.

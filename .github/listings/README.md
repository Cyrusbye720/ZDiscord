# Platform listings

This directory contains the descriptions, metadata, and copy used when publishing
ZDiscord to the various Minecraft plugin marketplaces.

| File | Marketplace | Status |
|---|---|---|
| `modrinth.md` | Modrinth | Draft |
| `curseforge.md` | CurseForge | Draft |
| `spigot.md` | SpigotMC | Draft |
| `hangar.md` | Paper Hangar | Draft |

## Workflow

1. Copy the relevant Markdown file into the marketplace's submission form.
2. Trim any sections that the marketplace's web form doesn't have a field for
   (most have a "long description" textarea only).
3. Upload `images/logo.png` (and optionally `images/banner.png` if the
   marketplace supports a wide hero image).

## Versioning

When releasing a new version, update the version-specific fields in each file:

- `modrinth.md` — game versions, loader versions, version number
- `curseforge.md` — game versions, release type
- `spigot.md` — version number, supported MC versions
- `hangar.md` — platform versions

The "About" / "Long description" / "Short description" blocks below are version-agnostic.

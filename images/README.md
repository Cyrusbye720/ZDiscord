# Custom images

This directory holds visual assets for ZDiscord.

## Files

| File | Used by | Required |
|---|---|---|
| `logo.png` | README header, Modrinth/CurseForge/Spigot/Hangar listings | Yes |
| `banner.png` | Optional — used as a wide hero in listings | No |

The `logo.png` file is a small square/avatar-style logo suitable for plugin listings and avatars.

The optional `banner.png` should be a wide image (recommended 1280×320 or similar 4:1 aspect ratio) used as a hero in marketplace listings.

## Adding your own

To replace either file, simply commit your replacement with the same filename. The README references the file by name, so any aspect ratio or size will be picked up automatically as long as the file is in this directory.

## Image guidelines

- PNG with transparency works best for the logo.
- Keep the file size reasonable (under 500 KB is plenty).
- Avoid AI-generated imagery in the project source — listing sites will sometimes reject it.

<p align="center">
  <img src="icon.png" alt="Navi Subs" width="96">
</p>

<p align="center">
  Arabic subtitles for anime, in Hayase and Navi.
</p>

## Add it

In Hayase, open **Settings → Extensions**, paste this link and press **Import Extensions**:

```
https://raw.githubusercontent.com/0x4l1d/navi-subs/main/index.json
```

Navi has it built in, there is nothing to add.

## What it does

- Finds Arabic subtitles on [Mirai Anime](https://miraianime.net). No key needed.
- Puts the best match first, so the track Hayase turns on is the right one.
- Names each track by who made it and the release it was timed for: `Arabic - Crunchyroll & Almighty (BD · DBD-Raws)`.
- Remembers what it found, so the next start and the next episode are quick.
- Leaves out subtitles from another season or part.

## More sources

SubDL and SubSource join in when you add your own key in the extension's options. Keys stay on your device.

| Source | Where to get a key |
|---|---|
| SubDL | subdl.com → your panel → API |
| SubSource | subsource.net → My Profile → API key |

Searches are saved, so opening an episode again does not use up your daily allowance. On desktop Hayase these two may be blocked by the browser's cross-site rules; in Navi they work.

## Options

| Option | What it does |
|---|---|
| maxFiles | Most subtitle files for one episode (1 to 8) |
| fonts | Put a built-in Arabic font inside the subtitle |
| release | Prefer subtitles timed for BD, WEB or TV |
| hideOtherSeasons | Leave out other seasons and parts |

## Working on it

```bash
npm install
npm run check   # types, lint, tests, build
npm run live    # asks the real sites for a list of shows and prints times
```

`dist/navi-subs.js` is the file Hayase downloads. Build it and commit it with every change to `src/`.

<sub>Unofficial, not made by Mirai Anime, SubDL, SubSource or Hayase. MIT. Based on <a href="https://github.com/scigward/mirai-ext">mirai-ext</a> by scigward.</sub>

# The Archive — an Eleventy starter

A personal archive for poems, lyrics, stories, and box photos. No database,
no backend — every entry is just a text file, and Eleventy turns the whole
folder into a plain HTML website.

## How it's organized

```
src/
  _includes/
    base.njk      the outer page shell (header, nav, footer)
    post.njk      the layout every individual entry uses
  css/
    style.css     all the styling lives here
  images/
    your photos and artwork go here
  poems/          one .md file per poem, plus index.njk (the listing page)
  lyrics/         one .md file per song
  stories/        one .md file per story
  boxes/          one .md file per box, usually with a photo
  index.njk       the homepage — lists everything, newest first
```

## Adding a new entry

Copy an existing file in the matching folder (e.g. `src/poems/example-poem.md`)
and edit the top section (the "front matter") plus the text below it:

```
---
title: Your Title Here
kind: poem
tags: poems
layout: post.njk
date: 2026-07-19
---
Your poem, lyric, story, or box notes go here. Plain text or Markdown —
**bold**, *italic*, and lists all work.
```

For a single photo, add it to `src/images/` and reference it like:

```
![description of the photo](/images/your-photo.jpg)
```

For a post with **multiple photos** (a gallery), add a `gallery` list to the
front matter instead — first image becomes the large hero, the rest appear
as clickable thumbnails below it, and visitors can click any of them to
enlarge and cycle through the whole set:

```
---
title: Your Title Here
kind: story
tags: stories
layout: post.njk
date: 2026-07-19
gallery:
  - photo-one.jpg
  - photo-two.jpg
  - photo-three.jpg
---
```

To embed a **YouTube video**, add a `youtube` field with whatever URL you
copied from YouTube (a `youtu.be` share link, a full `youtube.com/watch`
link, or just the video ID all work) — it'll appear above the post body,
sized to fit the page automatically:

```
---
title: Your Title Here
kind: story
tags: stories
layout: post.njk
date: 2026-07-19
youtube: https://youtu.be/your-video-id
---
```

That's it — no admin panel, no database, no build step to think about beyond
saving the file.

## Sizing photos before adding them

Camera and phone photos are usually much bigger than a website needs — both
in dimensions and file size. Before adding new photos to `src/images/`, run:

```
npm run resize-photos
```

This caps every photo in `src/images/` at 1800px on its longest side and
re-compresses it to a web-friendly quality, usually shrinking files by
70-80% with no visible difference. Photos that are already small enough are
left alone, so it's safe to run any time — even on a folder you've already
processed.

To process photos sitting somewhere else first (before copying them into
`src/images/`), point it at that folder instead:

```
npm run resize-photos -- path/to/folder
```

## Featuring a post

Add `featured: true` to a post's front matter to have it spotlighted (with
its full gallery, if it has one) instead of just listed as a plain link:

```
---
title: Your Title Here
kind: story
tags: stories
layout: post.njk
date: 2026-07-19
featured: true
---
```

- On that entry's own section page (Runes/poems, Invocations/lyrics,
  Lore/stories, Boxes), the **newest** featured post in that section is the
  one that gets spotlighted. To feature an older favorite instead, just
  bump its `date` forward.
- On the **homepage**, the newest featured post across *all* sections is
  spotlighted the same way — by default.

If you want the homepage to spotlight a specific post without changing its
real date, add `spotlight: true` alongside `featured: true`:

```
featured: true
spotlight: true
```

That post will take over the homepage spotlight regardless of date. If more
than one post has `spotlight: true`, the most recently dated one wins — so
in practice, keep it to one at a time.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed once. Then, from this folder:

```
npm install
npm start
```

This opens a local preview at `http://localhost:8080` that updates live as
you edit files.

To generate the final site without previewing it:

```
npm run build
```

The finished HTML lands in a folder called `_site`.

## Publishing to GitHub Pages

1. Create a new GitHub repository and push this folder to it.
2. In the repo's Settings → Pages, set "Source" to **GitHub Actions**.
3. Push to `main` — the included workflow (`.github/workflows/deploy.yml`)
   builds the site and publishes it automatically. Every future push does
   the same, so publishing a new poem is just: save the file, commit, push.

## Making it your own

The whole design lives in `src/css/style.css` and the two templates in
`src/_includes/`. Change colors, fonts, layout, add pages — it's all plain
HTML/CSS/Nunjucks, nothing hidden behind a builder UI.

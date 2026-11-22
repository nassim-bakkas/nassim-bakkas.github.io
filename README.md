# nassim-bakkas.github.io

My portfolio, live at https://nassim-bakkas.github.io

The site at the top of this repository is the built version that GitHub Pages
serves. The source is in `source/` (Vite and plain JavaScript).

Visitors arrive at a terminal: `ls` lists `portfolio/`, `space-game` and
`README.txt`; `cd portfolio` opens the site and `./space-game` runs a web
demo of my game (`source/src/game.js`). A link to a section skips the entrance.

Also deployed on Vercel at https://nassim-bakkas.vercel.app (root directory `source`).

## Update the site

```
cd source
npm install
npm run dev        # preview while editing
npm run build      # writes source/dist
```

Then copy the contents of `source/dist` to the top of the repository
(replacing `index.html`, `assets/` and `shots/`), commit and push.

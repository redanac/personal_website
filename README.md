# Redha Nacef Personal Website

## Summary
This repo is a personal website showing some information about myself. It's built with Vite and uses Threejs for the robotic arm animation and the floppy disc visualisation and selection logic. The JS and HTML is found in the src folder, while images, icons, models etc are in the static folder. The following list summarises the main script files:
 * The `script.js` file contains the logic for the threejs scene, including setting up the scene, loading and animating all the 3D models and handling the interaction logic.
 * The `index.html` file is the entry point and contains the main html for the webpage. The Threjs scene is rendered inside the canvas object
 * The `desktop.js` script handles the logic for the desktop icons and the header window. It also handles the setting window and the credits window.
 * The `screens` folder holds several html files that deal with the content on each section 'stored' on the floppy disks. 

## How to run locally
To run this repo locally simply clone the repo and run `npm install` followed by `npm run dev`

## Mouse, keyboard, and touch controls

- With a mouse, hover over a floppy to preview it and click to load its section.
  Desktop icons still open with a double-click, and windows and icons can be dragged.
- With touch or a pen, tap a floppy once to load it. Swipes over the scene remain
  scrolling gestures rather than selections. Window and icon dragging is mouse-only
  so touch users can scroll normally; browser pinch-to-zoom remains enabled.
- The Settings and Credits toolbar and labelled section buttons appear when a
  coarse pointer, nonzero `navigator.maxTouchPoints`, or an actual touch event is
  detected, including on touchscreen laptops. This avoids relying on one media
  query that privacy-focused browsers may mask. They also support keyboard activation.
  Mouse-only devices keep the
  original desktop layout without extra buttons or visible loading text.
  Section buttons become available once the models have loaded; the current section
  is marked and loading progress is announced to assistive technology on all devices.
- On narrow screens the monitor's content window uses the available screen space.
  Touch devices get larger close buttons and settings controls.
- The system's reduced-motion preference disables the CRT effects and hover motion,
  and uses a near-instant direct disc insertion instead of the robot animation.
  Settings also lets anyone skip the robot or change its speed.
- Settings includes a **Touchscreen controls** checkbox to override detection for
  the current page visit. If Brave initially shows desktop controls, touch the page
  to trigger detection. If the entire page is scaled like a desktop site, also check
  that Brave's **Request Desktop Site** option is off and reload.

### Compatibility checks

Run `npm test` for the pointer gesture regression tests and `npm run build`,
then check the site on desktop and on iOS Safari / Android
Chrome, in portrait and landscape:

- Check widths of 320, 375, 390, and 768 CSS pixels and a short landscape viewport:
  no horizontal page overflow, readable content, and reachable dialog close buttons.
- Open each section with a single tap, section button, and keyboard. Try rapid taps
  during insertion; selections should not overlap or display stale content.
- Swipe over the canvas and inside the content window, and pinch to zoom. A swipe,
  cancelled pointer, or multi-finger gesture must not select a floppy.
- Open and close Settings and Credits; check skip-animation and speed controls.
- Rotate the device with a dialog open, and verify it stays within the viewport.
- Enable reduced motion, including while a CRT transition is running: content should
  still load and the monitor must not remain stuck between states.
- Recheck mouse hover, double-click launchers, dragging, and section switching with
  the robot animation both enabled and skipped.
- On mouse-only devices, confirm the extra toolbar and section buttons are hidden,
  even at narrow widths. On touchscreen devices, confirm they remain visible,
  including when a mouse is also connected.
- In Brave, check both initial detection and the first touch when capability
  reporting is masked. Verify the Touchscreen controls setting can override detection.

## GitHub Pages deployment

The site is deployed to https://redanac.github.io/personal_website/ by
[the deployment workflow](.github/workflows/deploy.yml) on every push to `main`.
The workflow can also be started manually from the repository's Actions tab.

1. In the GitHub repository, open **Settings > Pages** and set the source to
   **GitHub Actions**.
2. Commit and push the website changes to `main`.
3. Check the **Deploy Vite website** workflow in the Actions tab. Once it
   succeeds, open the site URL above.

To check the production build locally, run `npm run build`, then
`npx vite preview --host 127.0.0.1`. Open the printed URL with the
`/personal_website/` path. The generated `dist/` directory is ignored by Git;
GitHub Actions builds and uploads it automatically.

The Vite `base` setting matches the repository name. JavaScript model URLs use
`import.meta.env.BASE_URL`, and the profile portrait uses a page-relative URL
because the screen HTML is loaded as raw text.

Everything in `static/` is published, including the CV PDF and TeX source.
Review those files before deploying if they contain anything you do not want
to make public.

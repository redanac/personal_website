# personal_website

## Responsive layout

The canvas and monitor adapt to the viewport height, with smaller padding on
narrow screens. A `ResizeObserver` keeps the Three.js drawing buffer matched to
the canvas's CSS content size, and the camera preserves the floppy row's
horizontal framing on narrow windows. Dragged windows return to their original
positions when the viewport is resized so they remain accessible.
The central column has an 852px maximum outer width and reserves 104px on each
side for desktop icons at viewport widths of 600px and above. Icons reflow on
resize to avoid the content column. Below 600px, icons are hidden and the content
uses the full width.

Run `npm run dev` for local development or `npm run build` for a production build.

## Profile portrait

The personal profile screen uses `static/portrait.png`. The browser downsamples
it to 72 pixels wide, then CSS scales it up with `image-rendering: pixelated`
for a retro portrait. The original image is left unchanged, and the portrait
stacks above the introduction when the screen window is narrow.

## Credits

Click the `credits.txt` desktop icon to open a draggable Notepad-style window
above the page. Close it with its X button or Escape. Edit `src/credits.txt` to
add asset names, creators, source links, licenses, and any modifications.
The icon follows the desktop's visibility rules (600px and wider).

## Animation settings

Double-click the Settings desktop icon (or activate it with the keyboard) to
open a draggable settings window. Close the window with its X button or Escape.
Like the other desktop icons, Settings is visible at widths of 600px and above.

- **Skip robot animation:** on the next disc selection, the disc tweens from
  its clicked hover position to above the drive slot, then slides vertically
  into it. It holds its hover position while the previous disc returns.
  The screen opens after insertion.
- **Robot animation speed:** adjusts robot playback immediately from 0.5x to 2x.
  The slider is disabled while skipping is enabled; its value is retained.

Robot animation is enabled at 1x by default. Settings last until the page reloads.

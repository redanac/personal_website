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

## Credits

Click the `credits.txt` desktop icon to open a draggable Notepad-style window
above the page. Close it with its X button or Escape. Edit `src/credits.txt` to
add asset names, creators, source links, licenses, and any modifications.
The icon follows the desktop's visibility rules (600px and wider).

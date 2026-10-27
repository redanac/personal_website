# Redha Nacef Personal Website

## Summary
This repo is a personal website showing some information about myself. It's built with Vite and uses Threejs for the robotic arm animation and the floppy disc visualisation and selection logic. The JS and HTML is found in the src folder, while images, icons, models etc are in the static folder. The following list summarises the main script files:
 * The `script.js` file contains the logic for the threejs scene, including setting up the scene, loading and animating all the 3D models and handling the interaction logic.
 * The `index.html` file is the entry point and contains the main html for the webpage. The Threjs scene is rendered inside the canvas object
 * The `desktop.js` script handles the logic for the desktop icons and the header window. It also handles the setting window and the credits window.
 * The `screens` folder holds several html files that deal with the content on each section 'stored' on the floppy disks. 

## How to run locally
To run this repo locally simply clone the repo and run `npm install` followed by `npm run dev`


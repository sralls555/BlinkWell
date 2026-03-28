/**
 * Generates all BlinkWell app icon assets from an SVG source.
 *
 * Icon concept: a stylised eye (iris + pupil) nestled inside a leaf shape,
 * suggesting both eye protection and nature/environmental care.
 * Palette: deep midnight bg (#0A0F1E), calm blue iris (#4F8EF7),
 *          healthy green leaf (#34D399), white highlights.
 *
 * Outputs:
 *   assets/icon.png                     1024×1024  (iOS / general)
 *   assets/splash-icon.png               512×512   (Expo splash)
 *   assets/favicon.png                    64×64    (web)
 *   assets/android-icon-foreground.png   768×768   (adaptive fg, on transparent)
 *   assets/android-icon-background.png  1024×1024  (adaptive bg, solid color)
 *   assets/android-icon-monochrome.png  1024×1024  (adaptive monochrome)
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');

// ─── SVG definition ───────────────────────────────────────────────────────────
// Viewbox 100×100. The leaf and eye are drawn at this scale then rasterised.

const BG      = '#0A0F1E';
const GREEN   = '#34D399';
const BLUE    = '#4F8EF7';
const WHITE   = '#F1F5FF';

/**
 * Full icon SVG (opaque midnight bg, green leaf, blue eye).
 * size: viewBox dimension (always 100 internally, output size set by sharp).
 */
function fullIconSVG(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <!-- Background -->
  <rect width="100" height="100" fill="${BG}" rx="22"/>

  <!-- Leaf shape: two cubic beziers forming a pointed-oval leaf, slightly tilted -->
  <!-- Leaf goes from (50,18) tip → curves out to (80,50) → back to (50,82) → curves to (20,50) → back -->
  <path
    d="M50 18
       C70 18, 85 34, 85 50
       C85 66, 70 82, 50 82
       C30 82, 15 66, 15 50
       C15 34, 30 18, 50 18 Z"
    fill="${GREEN}"
    opacity="0.18"
  />
  <!-- Leaf outline (slightly thicker) -->
  <path
    d="M50 18
       C70 18, 85 34, 85 50
       C85 66, 70 82, 50 82
       C30 82, 15 66, 15 50
       C15 34, 30 18, 50 18 Z"
    fill="none"
    stroke="${GREEN}"
    stroke-width="2.2"
    opacity="0.7"
  />
  <!-- Leaf central vein -->
  <line x1="50" y1="20" x2="50" y2="80" stroke="${GREEN}" stroke-width="1" opacity="0.35" stroke-linecap="round"/>

  <!-- Eye white / sclera (ellipse) -->
  <ellipse cx="50" cy="50" rx="20" ry="13" fill="${WHITE}" opacity="0.92"/>

  <!-- Iris -->
  <circle cx="50" cy="50" r="9.5" fill="${BLUE}"/>

  <!-- Pupil -->
  <circle cx="50" cy="50" r="5" fill="${BG}"/>

  <!-- Iris highlight -->
  <circle cx="53.5" cy="46.5" r="2.2" fill="${WHITE}" opacity="0.55"/>

  <!-- Eye shine (small) -->
  <circle cx="44.5" cy="53" r="1.1" fill="${WHITE}" opacity="0.3"/>

  <!-- Upper eyelid arc -->
  <path
    d="M30 50 Q50 34 70 50"
    fill="none"
    stroke="${WHITE}"
    stroke-width="1.5"
    opacity="0.5"
    stroke-linecap="round"
  />
  <!-- Lower eyelid arc -->
  <path
    d="M30 50 Q50 62 70 50"
    fill="none"
    stroke="${WHITE}"
    stroke-width="1"
    opacity="0.3"
    stroke-linecap="round"
  />

  <!-- Small leaf sprout from bottom of eye (nature accent) -->
  <path
    d="M50 63 C50 63, 44 70, 44 75 C44 79, 56 79, 56 75 C56 70, 50 63, 50 63 Z"
    fill="${GREEN}"
    opacity="0.85"
  />
</svg>`;
}

/**
 * Foreground-only SVG (transparent bg — Android adaptive icon).
 * Centered on a 108dp safe zone within 768px canvas.
 */
function foregroundSVG(size = 768) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <!-- Leaf -->
  <path
    d="M50 18 C70 18, 85 34, 85 50 C85 66, 70 82, 50 82 C30 82, 15 66, 15 50 C15 34, 30 18, 50 18 Z"
    fill="${GREEN}" opacity="0.25"
  />
  <path
    d="M50 18 C70 18, 85 34, 85 50 C85 66, 70 82, 50 82 C30 82, 15 66, 15 50 C15 34, 30 18, 50 18 Z"
    fill="none" stroke="${GREEN}" stroke-width="2.2" opacity="0.85"
  />
  <line x1="50" y1="20" x2="50" y2="80" stroke="${GREEN}" stroke-width="1" opacity="0.4" stroke-linecap="round"/>

  <!-- Eye -->
  <ellipse cx="50" cy="50" rx="20" ry="13" fill="${WHITE}" opacity="0.95"/>
  <circle cx="50" cy="50" r="9.5" fill="${BLUE}"/>
  <circle cx="50" cy="50" r="5" fill="${BG}"/>
  <circle cx="53.5" cy="46.5" r="2.2" fill="${WHITE}" opacity="0.6"/>
  <path d="M30 50 Q50 34 70 50" fill="none" stroke="${WHITE}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>
  <path d="M30 50 Q50 62 70 50" fill="none" stroke="${WHITE}" stroke-width="1" opacity="0.35" stroke-linecap="round"/>

  <!-- Sprout -->
  <path d="M50 63 C50 63, 44 70, 44 75 C44 79, 56 79, 56 75 C56 70, 50 63, 50 63 Z" fill="${GREEN}" opacity="0.9"/>
</svg>`;
}

/**
 * Monochrome SVG (white-on-transparent, for Android 13 adaptive monochrome).
 */
function monochromeSVG(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <path
    d="M50 18 C70 18, 85 34, 85 50 C85 66, 70 82, 50 82 C30 82, 15 66, 15 50 C15 34, 30 18, 50 18 Z"
    fill="none" stroke="white" stroke-width="3" opacity="0.9"
  />
  <line x1="50" y1="20" x2="50" y2="80" stroke="white" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>
  <ellipse cx="50" cy="50" rx="20" ry="13" fill="none" stroke="white" stroke-width="2"/>
  <circle cx="50" cy="50" r="7" fill="white" opacity="0.9"/>
  <circle cx="50" cy="50" r="3.5" fill="black" opacity="0.7"/>
  <path d="M50 63 C50 63, 44 70, 44 75 C44 79, 56 79, 56 75 C56 70, 50 63, 50 63 Z" fill="white" opacity="0.9"/>
</svg>`;
}

// ─── Render tasks ─────────────────────────────────────────────────────────────

const tasks = [
  {
    file: 'icon.png',
    size: 1024,
    svg:  () => fullIconSVG(1024),
    bg:   null,
  },
  {
    file: 'splash-icon.png',
    size: 512,
    svg:  () => fullIconSVG(512),
    bg:   null,
  },
  {
    file: 'favicon.png',
    size: 64,
    svg:  () => fullIconSVG(64),
    bg:   null,
  },
  {
    file: 'android-icon-foreground.png',
    size: 768,
    svg:  () => foregroundSVG(768),
    bg:   null,   // transparent
  },
  {
    file: 'android-icon-background.png',
    size: 1024,
    // Solid deep midnight blue — adaptive bg is just flat color
    svg:  () => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`,
    bg:   null,
  },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    svg:  () => monochromeSVG(1024),
    bg:   null,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  for (const task of tasks) {
    const outPath = path.join(ASSETS, task.file);
    const svgBuf  = Buffer.from(task.svg());

    await sharp(svgBuf)
      .resize(task.size, task.size)
      .png()
      .toFile(outPath);

    console.log(`✓  ${task.file}  (${task.size}×${task.size})`);
  }
  console.log('\nAll icons generated in assets/');
}

run().catch((err) => { console.error(err); process.exit(1); });

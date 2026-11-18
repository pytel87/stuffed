// Generated texture images (public/textures, made by `pnpm textures`). A texture starts as the
// code-drawn one and swaps to its image once that has loaded, so the game never waits on it and
// still looks right if an image is missing. Fabrics are turned into soft grey detail (multiplied
// into each part's color), and any texture can have its tile edges blended so it repeats cleanly.
import * as THREE from 'three';

export interface ImageOptions {
  /** Grey detail around white, to tint with a material color (fabrics). */
  fabric?: boolean;
  /** Blend the tile's edges so it repeats without visible seams (organic textures only: on a
   *  regular pattern like tiles or bricks it ghosts the rows). */
  seamless?: boolean;
  /** 0..1: take this much color out and lift it toward white, for a softer, toy-like look. */
  soften?: number;
  /** Make a normal map instead (the image's brightness as height), this steep. */
  normal?: number;
  /** A regular pattern (tiles, bricks): trim it to a whole number of its repeats, so it tiles. */
  periodic?: boolean;
  /** With `fabric`: how strong the grey detail is (0.075 by default). */
  contrast?: number;
}

/** Every texture sharing one image (the base and its tiled clones), to refresh them together. */
const families = new Map<THREE.Texture, Set<THREE.Texture>>();
const pending = new Map<string, Promise<HTMLCanvasElement | null>>();

/** `?lowtex` keeps the code-drawn textures (to compare, or on a very weak device). */
const enabled = typeof location === 'undefined' || !new URLSearchParams(location.search).has('lowtex');

/** Remembers `clone` as sharing `base`'s image, so an image swap reaches it too. */
export function noteClone(base: THREE.Texture, clone: THREE.Texture): void {
  families.get(base)?.add(clone);
}

/** Swaps `tex` (and its clones, now or later) to public/textures/<name>.jpg once it loads. */
export function upgradeTexture<T extends THREE.Texture>(tex: T, name: string, opts: ImageOptions = {}): T {
  if (!enabled || families.has(tex)) return tex;
  const family = new Set<THREE.Texture>([tex]);
  families.set(tex, family);
  const key = `${name}|${opts.fabric ? 'f' : ''}${opts.seamless ? 's' : ''}${opts.soften ?? ''}|${opts.normal ?? ''}${opts.periodic ? 'p' : ''}${opts.contrast ?? ''}`;
  let load = pending.get(key);
  if (!load) {
    load = loadCanvas(name, opts);
    pending.set(key, load);
  }
  void load.then((canvas) => {
    if (!canvas) return;
    tex.image = canvas;
    // The GPU copy was made at the drawn texture's size and can't grow: drop it to remake it.
    for (const t of family) {
      t.dispose();
      t.needsUpdate = true;
    }
  });
  return tex;
}

function loadCanvas(name: string, opts: ImageOptions): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const g = canvas.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      if (opts.periodic) trimToPeriod(g, canvas.width, canvas.height);
      if (opts.seamless) blendSeams(g, canvas.width, canvas.height);
      if (opts.fabric) toFabricDetail(g, canvas.width, canvas.height, opts.contrast);
      if (opts.soften) soften(g, canvas.width, canvas.height, opts.soften);
      if (opts.normal) toNormalMap(g, canvas.width, canvas.height, opts.normal);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}textures/${name}.jpg`;
  });
}

/** Finds the pattern's repeat along each axis (the shift that best matches the image to itself)
 *  and stretches the largest whole number of repeats back over the canvas. */
function trimToPeriod(g: CanvasRenderingContext2D, w: number, h: number): void {
  const d = g.getImageData(0, 0, w, h).data;
  const lum = (x: number, y: number) => d[(y * w + x) * 4]! + d[(y * w + x) * 4 + 1]! + d[(y * w + x) * 4 + 2]!;
  const period = (n: number, along: 'x' | 'y') => {
    let best = n;
    let bestErr = Infinity;
    for (let p = Math.floor(n / 12); p <= Math.floor(n / 2); p++) {
      let err = 0;
      let count = 0;
      for (let a = 0; a < n - p; a += 2) {
        for (let b = 0; b < (along === 'x' ? h : w); b += 4) {
          err += along === 'x' ? Math.abs(lum(a, b) - lum(a + p, b)) : Math.abs(lum(b, a) - lum(b, a + p));
          count++;
        }
      }
      err /= count;
      // Prefer the shortest repeat that matches about as well as the best so far.
      if (err < bestErr * 0.97) {
        bestErr = err;
        best = p;
      }
    }
    return best;
  };
  const px = period(w, 'x');
  const py = period(h, 'y');
  const cw = Math.floor(w / px) * px;
  const ch = Math.floor(h / py) * py;
  if (cw === w && ch === h) return;
  const copy = document.createElement('canvas');
  copy.width = cw;
  copy.height = ch;
  copy.getContext('2d')!.drawImage(g.canvas, 0, 0, cw, ch, 0, 0, cw, ch);
  g.clearRect(0, 0, w, h);
  g.drawImage(copy, 0, 0, cw, ch, 0, 0, w, h);
}

/** Blends each axis with a half-shifted copy near the edges (where the copy is continuous). */
function blendSeams(g: CanvasRenderingContext2D, w: number, h: number): void {
  for (const axis of ['x', 'y'] as const) {
    const src = g.getImageData(0, 0, w, h);
    const out = g.createImageData(w, h);
    const a = src.data;
    const o = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 0 at the edges, 1 in the middle, along this axis.
        const d = axis === 'x' ? Math.min(x, w - x) / (w / 2) : Math.min(y, h - y) / (h / 2);
        const t = Math.min(1, Math.max(0, (d - 0.08) / 0.6));
        const keep = t * t * (3 - 2 * t);
        const sx = axis === 'x' ? (x + w / 2) % w : x;
        const sy = axis === 'y' ? (y + h / 2) % h : y;
        const i = (y * w + x) * 4;
        const j = (sy * w + sx) * 4;
        for (let c = 0; c < 3; c++) o[i + c] = a[i + c]! * keep + a[j + c]! * (1 - keep);
        o[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  }
}

/** Turns the image into a normal map: brightness is height, wrapping round the edges. */
function toNormalMap(g: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const height = (x: number, y: number) => d[(((y + h) % h) * w + ((x + w) % w)) * 4]! / 255;
  const out = g.createImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      o[i] = Math.round((-dx / len) * 127.5 + 127.5);
      o[i + 1] = Math.round((dy / len) * 127.5 + 127.5);
      o[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
      o[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
}

/** Takes some color out (toward each pixel's grey) and lifts it a little toward white. */
function soften(g: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    for (let c = 0; c < 3; c++) {
      const grey = d[i + c]! + (l - d[i + c]!) * amount * 0.6;
      d[i + c] = grey + (255 - grey) * amount * 0.25;
    }
  }
  g.putImageData(img, 0, 0);
}

/** Grey detail centered just under white with a gentle contrast, so it only adds texture. */
function toFabricDetail(g: CanvasRenderingContext2D, w: number, h: number, contrast = 0.075): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const lum = new Float32Array(n);
  let sum = 0;
  for (let p = 0; p < n; p++) {
    const v = (0.299 * d[p * 4]! + 0.587 * d[p * 4 + 1]! + 0.114 * d[p * 4 + 2]!) / 255;
    lum[p] = v;
    sum += v;
  }
  const mean = sum / n;
  let sq = 0;
  for (let p = 0; p < n; p++) sq += (lum[p]! - mean) ** 2;
  const k = contrast / Math.max(0.01, Math.sqrt(sq / n));
  for (let p = 0; p < n; p++) {
    const v = Math.round(255 * Math.min(1, Math.max(0.6, 0.9 + (lum[p]! - mean) * k)));
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v;
  }
  g.putImageData(img, 0, 0);
}

const details = new Map<string, { map: THREE.Texture; normal: THREE.Texture }>();

/**
 * A generated detail image (fabric, felt leaves...) as grey detail to tint with a material color,
 * plus its normal map so the detail catches the light. Both start plain (felt, flat) and swap in
 * once the image loads. `fallback` is the plain texture's canvas. Shared per name; clone (with
 * noteClone) to repeat differently.
 */
export function detailMaps(name: string, fallback: HTMLCanvasElement, contrast?: number): { map: THREE.Texture; normal: THREE.Texture } {
  let d = details.get(name);
  if (!d) {
    const map = new THREE.CanvasTexture(fallback);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    upgradeTexture(map, name, { fabric: true, seamless: true, contrast });
    const flat = document.createElement('canvas');
    flat.width = flat.height = 4;
    const g = flat.getContext('2d')!;
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 4, 4);
    const normal = new THREE.CanvasTexture(flat);
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    upgradeTexture(normal, name, { fabric: true, seamless: true, normal: 6 });
    d = { map, normal };
    details.set(name, d);
  }
  return d;
}

/** `tex` repeated rx x ry (a clone that follows the base's image swap). */
export function repeated(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  noteClone(tex, t);
  return t;
}

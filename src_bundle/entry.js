import { GifReader, GifWriter } from 'omggif';
import { GIFEncoder, quantize, applyPalette, nearestColor, snapColorsToPalette } from 'gifenc';
import parseAPNG from 'apng-js';

const GifEngine = {
  GifReader,
  GifWriter,
  GIFEncoder,
  quantize,
  applyPalette,
  nearestColor,
  snapColorsToPalette,
  parseAPNG
};

if (typeof window !== 'undefined') {
  window.GifEngine = GifEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GifEngine = GifEngine;
}

export default GifEngine;

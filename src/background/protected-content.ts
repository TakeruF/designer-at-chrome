export interface ProtectedFrameAnalysis {
  suspected: boolean;
  darkOrTransparentRatio: number;
  meanBrightness: number;
}

export function analyzeProtectedFramePixels(data: Uint8ClampedArray): ProtectedFrameAnalysis {
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount === 0) {
    return { suspected: false, darkOrTransparentRatio: 0, meanBrightness: 0 };
  }
  let darkOrTransparent = 0;
  let brightnessTotal = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    brightnessTotal += brightness;
    if (alpha < 20 || brightness < 18) darkOrTransparent += 1;
  }
  const darkOrTransparentRatio = darkOrTransparent / pixelCount;
  const meanBrightness = brightnessTotal / pixelCount;
  return {
    suspected:
      darkOrTransparentRatio >= 0.88 || (darkOrTransparentRatio >= 0.78 && meanBrightness < 24),
    darkOrTransparentRatio,
    meanBrightness,
  };
}

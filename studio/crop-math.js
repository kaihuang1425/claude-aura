(() => {
  "use strict";

  const roundContract = (value) => {
    const rounded = Math.round((Math.abs(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
    return Object.is(value, -0) || value < 0 ? -rounded : rounded;
  };

  const finitePositive = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new TypeError(`${label} must be a positive finite number`);
    }
    return number;
  };

  const clamp = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(maximum, Math.max(minimum, number))
      : fallback;
  };

  const coverLayout = ({
    sourceWidth,
    sourceHeight,
    outputWidth,
    outputHeight,
    x = 50,
    y = 50,
    zoom = 1,
  }) => {
    const sourceW = finitePositive(sourceWidth, "sourceWidth");
    const sourceH = finitePositive(sourceHeight, "sourceHeight");
    const outputW = finitePositive(outputWidth, "outputWidth");
    const outputH = finitePositive(outputHeight, "outputHeight");
    const cropX = clamp(x, 0, 100, 50);
    const cropY = clamp(y, 0, 100, 50);
    const cropZoom = clamp(zoom, 1, 2, 1);
    const scale = Math.max(outputW / sourceW, outputH / sourceH) * cropZoom;
    const renderedWidth = sourceW * scale;
    const renderedHeight = sourceH * scale;
    const overflowX = Math.max(0, renderedWidth - outputW);
    const overflowY = Math.max(0, renderedHeight - outputH);
    const sourceCropWidth = outputW / scale;
    const sourceCropHeight = outputH / scale;
    return Object.freeze({
      scale,
      width: renderedWidth,
      height: renderedHeight,
      left: -overflowX * cropX / 100,
      top: -overflowY * cropY / 100,
      overflowX,
      overflowY,
      source: Object.freeze({
        left: roundContract(Math.max(0, sourceW - sourceCropWidth) * cropX / 100),
        top: roundContract(Math.max(0, sourceH - sourceCropHeight) * cropY / 100),
        width: roundContract(sourceCropWidth),
        height: roundContract(sourceCropHeight),
      }),
    });
  };

  const contractVectors = Object.freeze([
    Object.freeze({
      name: "landscape-centered",
      input: Object.freeze({
        sourceWidth: 1000, sourceHeight: 500, outputWidth: 344, outputHeight: 124,
        x: 50, y: 50, zoom: 1,
      }),
      expected: Object.freeze({
        left: 0, top: 69.767442, width: 1000, height: 360.465116,
      }),
    }),
    Object.freeze({
      name: "portrait-edge-zoom",
      input: Object.freeze({
        sourceWidth: 500, sourceHeight: 1000, outputWidth: 344, outputHeight: 124,
        x: 0, y: 100, zoom: 1.37,
      }),
      expected: Object.freeze({
        left: 0, top: 868.443388, width: 364.963504, height: 131.556612,
      }),
    }),
    Object.freeze({
      name: "square-opposite-edge-maximum-zoom",
      input: Object.freeze({
        sourceWidth: 800, sourceHeight: 800, outputWidth: 344, outputHeight: 124,
        x: 100, y: 0, zoom: 2,
      }),
      expected: Object.freeze({
        left: 400, top: 0, width: 400, height: 144.186047,
      }),
    }),
    Object.freeze({
      name: "exact-ratio",
      input: Object.freeze({
        sourceWidth: 688, sourceHeight: 248, outputWidth: 344, outputHeight: 124,
        x: 50, y: 50, zoom: 1,
      }),
      expected: Object.freeze({
        left: 0, top: 0, width: 688, height: 248,
      }),
    }),
    Object.freeze({
      name: "one-pixel-overflow",
      input: Object.freeze({
        sourceWidth: 345, sourceHeight: 124, outputWidth: 344, outputHeight: 124,
        x: 100, y: 50, zoom: 1,
      }),
      expected: Object.freeze({
        left: 1, top: 0, width: 344, height: 124,
      }),
    }),
    Object.freeze({
      name: "alpha-edge-fractional-zoom",
      input: Object.freeze({
        sourceWidth: 777, sourceHeight: 333, outputWidth: 344, outputHeight: 124,
        x: 13, y: 87, zoom: 1.37,
      }),
      expected: Object.freeze({
        left: 27.280073, top: 111.848092, width: 567.153285, height: 204.438975,
      }),
    }),
  ]);

  globalThis.CLAUDE_AURA_CROP_MATH = Object.freeze({
    coverLayout,
    contractVectors,
  });
})();

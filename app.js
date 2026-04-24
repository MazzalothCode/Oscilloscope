const CROP_SIZE = 600;
const SAMPLE_SIZE = 360;
const PREVIEW_SIZE = 1200;
const EXPORT_SIZE = 2048;
const LCD_PREVIEW_SIZE = 96;
const DOWNLOAD_COUNTER_KEY = "oscilloscope-download-count";
const COUNTER_ENDPOINT = "/api/counter";

const EFFECT_DEFAULTS = Object.freeze({
  unknownPleasures: {
    lineCount: 82,
    amplitude: 25,
    smoothness: 0.62,
    recognition: 0.74,
    contrast: 1.35,
    detailThreshold: 0.18,
    contourDetail: 0.58,
    strokeWidth: 1.55,
    margin: 42,
    invert: false,
  },
  knownPleasures: {
    lineCount: 55,
    amplitude: 120,
    smoothness: 0,
    recognition: 0.35,
    contrast: 2.5,
    detailThreshold: 0,
    contourDetail: 0.5,
    strokeWidth: 1.5,
    margin: 42,
    invert: false,
  },
  oscilloscope: {
    lineCount: 118,
    amplitude: 9,
    smoothness: 0.64,
    recognition: 0.78,
    contrast: 0,
    detailThreshold: 0.18,
    contourDetail: 0.56,
    strokeWidth: 0.9,
    margin: 28,
    invert: false,
  },
  ribbon: {
    lineCount: 60,
    amplitude: 10,
    smoothness: 0.6,
    recognition: 0.78,
    contrast: 0.95,
    detailThreshold: 0.06,
    contourDetail: 0.5,
    strokeWidth: 0.82,
    margin: 28,
    invert: false,
  },
  lichtenstein: {
    lineCount: 150,
    amplitude: 26,
    smoothness: 0.28,
    recognition: 0.72,
    contrast: 1.15,
    detailThreshold: 0.8,
    contourDetail: 0.42,
    strokeWidth: 1.35,
    margin: 34,
    invert: false,
  },
  chaos: {
    lineCount: 142,
    amplitude: 72,
    smoothness: 0.42,
    recognition: 0.68,
    contrast: 1.45,
    detailThreshold: 0,
    contourDetail: 0.74,
    strokeWidth: 0.64,
    margin: 56,
    invert: false,
  },
});

const DEFAULT_SETTINGS = Object.freeze({
  effectMode: "unknownPleasures",
  ...EFFECT_DEFAULTS.unknownPleasures,
});

const elements = {
  deviceFrame: document.querySelector("#deviceFrame"),
  imageInput: document.querySelector("#imageInput"),
  zoomControl: document.querySelector("#zoomControl"),
  zoomValue: document.querySelector("#zoomValue"),
  uploadButton: document.querySelector("#uploadButton"),
  cropCanvas: document.querySelector("#cropCanvas"),
  cropScreen: document.querySelector("#cropScreen"),
  inputPlaceholder: document.querySelector("#inputPlaceholder"),
  sampleCanvas: document.querySelector("#sampleCanvas"),
  exportCanvas: document.querySelector("#exportCanvas"),
  previewStage: document.querySelector("#previewStage"),
  status: document.querySelector("#status"),
  toggleButtons: [...document.querySelectorAll("[data-toggle-for]")],
  formatToggle: document.querySelector("#formatToggle"),
  printButton: document.querySelector("#printButton"),
  downloadCounter: document.querySelector("#downloadCounter"),
  randomButton: document.querySelector("#randomButton"),
  resetButton: document.querySelector("#resetButton"),
  patchLayer: document.querySelector("#patchLayer"),
  effectCable: document.querySelector("#effectCable"),
  effectSourceJack: document.querySelector("#effectSourceJack"),
  effectButtons: [...document.querySelectorAll("[data-effect-option]")],
  knobs: [...document.querySelectorAll("[data-knob-for]")],
  settingInputs: [...document.querySelectorAll("[data-setting]")],
};

const cropContext = elements.cropCanvas.getContext("2d");
const sampleContext = elements.sampleCanvas.getContext("2d", { willReadFrequently: true });
const exportContext = elements.exportCanvas.getContext("2d");
const lcdPreviewCanvas = document.createElement("canvas");
lcdPreviewCanvas.width = LCD_PREVIEW_SIZE;
lcdPreviewCanvas.height = LCD_PREVIEW_SIZE;
const lcdPreviewContext = lcdPreviewCanvas.getContext("2d");

const state = {
  image: null,
  imageUrl: null,
  crop: {
    scale: 1,
    minScale: 1,
    maxScale: 1,
    offsetX: 0,
    offsetY: 0,
    sourceWidth: 0,
    sourceHeight: 0,
  },
  settings: { ...DEFAULT_SETTINGS },
  linePaths: [],
  svgMarkup: "",
  frameRequested: false,
  renderTimerId: null,
  pointers: new Map(),
  gesture: {
    active: false,
    dragPointerId: null,
    lastX: 0,
    lastY: 0,
    pinchStartDistance: 0,
    pinchStartScale: 1,
  },
  downloadCount: 0,
};

function setup() {
  loadDownloadCounter();
  updateSettingsUi();
  updateZoomUi();
  renderEmptyPreview();
  bindEvents();
  drawCropCanvas();
  requestAnimationFrame(() => {
    syncGridAlignment();
    updatePatchCable();
  });
}

function bindEvents() {
  elements.imageInput.addEventListener("change", onImageSelected);
  elements.zoomControl.addEventListener("input", onZoomInput);
  elements.uploadButton.addEventListener("click", () => elements.imageInput.click());
  for (const button of elements.toggleButtons) {
    button.addEventListener("click", onToggleButtonClicked);
  }

  for (const input of elements.settingInputs) {
    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, onSettingChanged);
  }

  for (const button of elements.effectButtons) {
    button.addEventListener("click", onEffectButtonClicked);
  }

  for (const knob of elements.knobs) {
    knob.addEventListener("pointerdown", onKnobPointerDown);
    knob.addEventListener("keydown", onKnobKeyDown);
  }

  elements.randomButton.addEventListener("click", randomizeSettings);
  elements.resetButton.addEventListener("click", resetAll);
  elements.printButton.addEventListener("click", onPrintRequested);

  elements.cropCanvas.addEventListener("click", onCropCanvasClick);
  elements.cropCanvas.addEventListener("pointerdown", onPointerDown);
  elements.cropCanvas.addEventListener("pointermove", onPointerMove);
  elements.cropCanvas.addEventListener("pointerup", onPointerUp);
  elements.cropCanvas.addEventListener("pointercancel", onPointerUp);
  elements.cropCanvas.addEventListener("wheel", onCropWheel, { passive: false });
  window.addEventListener("resize", () => {
    syncGridAlignment();
    updatePatchCable();
  });
}

function onCropCanvasClick() {
  if (!state.image) {
    elements.imageInput.click();
  }
}

function onEffectButtonClicked(event) {
  const effectMode = event.currentTarget.dataset.effectOption;
  const select = document.querySelector("#effectMode");

  if (!effectMode || !select || select.value === effectMode) {
    return;
  }

  select.value = effectMode;
  onSettingChanged({ target: select });
}

function onKnobPointerDown(event) {
  const knob = event.currentTarget;
  const input = getInputForKnob(knob);

  if (!input || input.disabled) {
    return;
  }

  event.preventDefault();
  knob.setPointerCapture(event.pointerId);

  const startX = event.clientX;
  const startValue = Number(input.value);
  const pointerId = event.pointerId;

  const onPointerMove = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    const min = Number(input.min);
    const max = Number(input.max);
    const delta = moveEvent.clientX - startX;
    const nextValue = startValue + delta * ((max - min) / 180);
    commitRangeValue(input, nextValue);
  };

  const onPointerUp = (upEvent) => {
    if (upEvent.pointerId !== pointerId) {
      return;
    }

    knob.releasePointerCapture(pointerId);
    knob.removeEventListener("pointermove", onPointerMove);
    knob.removeEventListener("pointerup", onPointerUp);
    knob.removeEventListener("pointercancel", onPointerUp);
  };

  knob.addEventListener("pointermove", onPointerMove);
  knob.addEventListener("pointerup", onPointerUp);
  knob.addEventListener("pointercancel", onPointerUp);
}

function onKnobKeyDown(event) {
  const input = getInputForKnob(event.currentTarget);

  if (!input || input.disabled) {
    return;
  }

  const step = Number(input.step) || 1;
  const largeStep = step * 10;
  let nextValue = Number(input.value);

  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    nextValue += step;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    nextValue -= step;
  } else if (event.key === "PageUp") {
    nextValue += largeStep;
  } else if (event.key === "PageDown") {
    nextValue -= largeStep;
  } else if (event.key === "Home") {
    nextValue = Number(input.min);
  } else if (event.key === "End") {
    nextValue = Number(input.max);
  } else {
    return;
  }

  event.preventDefault();
  commitRangeValue(input, nextValue);
}

function getInputForKnob(knob) {
  const inputId = knob.dataset.knobFor;
  return inputId ? document.getElementById(inputId) : null;
}

function commitRangeValue(input, value) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const steppedValue = min + Math.round((clamp(value, min, max) - min) / step) * step;
  const normalizedValue = normalizeRandomValue(clamp(steppedValue, min, max), step);

  input.value = String(normalizedValue);
  syncRangeVisual(input);

  if (input === elements.zoomControl) {
    onZoomInput({ target: input });
  } else {
    onSettingChanged({ target: input });
  }
}

async function onImageSelected(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    setStatus("Loading image...");
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);

    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }

    state.image = image;
    state.imageUrl = url;
    state.settings.invert = getEffectSettings(state.settings.effectMode).invert;
    initializeCropFromImage(image);
    requestRender("Image loaded. Adjust the crop and settings to refine the artwork.");
  } catch (error) {
    console.error(error);
    setStatus("Unable to load that file. Please try a different image.");
  } finally {
    event.target.value = "";
  }
}

function onToggleButtonClicked(event) {
  const inputId = event.currentTarget.dataset.toggleFor;
  const input = document.getElementById(inputId);

  if (!input || input.disabled) {
    return;
  }

  input.checked = !input.checked;

  if (input.dataset.setting) {
    onSettingChanged({ target: input });
    return;
  }

  syncToggleVisual(input);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function initializeCropFromImage(image) {
  const minScale = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight);
  state.crop = {
    scale: minScale,
    minScale,
    maxScale: minScale * 5,
    offsetX: (CROP_SIZE - image.naturalWidth * minScale) / 2,
    offsetY: (CROP_SIZE - image.naturalHeight * minScale) / 2,
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
  };

  updateSettingsUi();
  updateZoomUi();
  setButtonsEnabled(true);
}

function onZoomInput(event) {
  if (!state.image) {
    return;
  }

  const nextScale = sliderValueToScale(Number(event.target.value));
  scaleCrop(nextScale, CROP_SIZE / 2, CROP_SIZE / 2);
  requestRender();
}

function onSettingChanged(event) {
  const { setting } = event.target.dataset;
  const value = readInputValue(event.target);

  if (setting === "effectMode") {
    state.settings = getEffectSettings(value);
    updateSettingsUi();
    requestRender();
    return;
  }

  state.settings[setting] = value;
  updateSettingsUi();
  requestRender();
}

function onPointerDown(event) {
  if (!state.image) {
    return;
  }

  const point = getCanvasPoint(event);
  elements.cropCanvas.setPointerCapture(event.pointerId);
  state.pointers.set(event.pointerId, point);

  if (state.pointers.size === 1) {
    state.gesture.dragPointerId = event.pointerId;
    state.gesture.lastX = point.x;
    state.gesture.lastY = point.y;
  } else if (state.pointers.size === 2) {
    const [a, b] = [...state.pointers.values()];
    state.gesture.pinchStartDistance = distanceBetween(a, b);
    state.gesture.pinchStartScale = state.crop.scale;
  }
}

function onPointerMove(event) {
  if (!state.image || !state.pointers.has(event.pointerId)) {
    return;
  }

  const point = getCanvasPoint(event);
  state.pointers.set(event.pointerId, point);

  if (state.pointers.size === 1 && state.gesture.dragPointerId === event.pointerId) {
    const deltaX = point.x - state.gesture.lastX;
    const deltaY = point.y - state.gesture.lastY;
    state.gesture.lastX = point.x;
    state.gesture.lastY = point.y;
    state.crop.offsetX += deltaX;
    state.crop.offsetY += deltaY;
    clampCropOffsets();
    updateZoomUi();
    requestRender();
    return;
  }

  if (state.pointers.size === 2) {
    const [a, b] = [...state.pointers.values()];
    const currentDistance = distanceBetween(a, b);

    if (state.gesture.pinchStartDistance > 0) {
      const midpoint = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
      const nextScale = state.gesture.pinchStartScale * (currentDistance / state.gesture.pinchStartDistance);
      scaleCrop(nextScale, midpoint.x, midpoint.y);
      requestRender();
    }
  }
}

function onPointerUp(event) {
  state.pointers.delete(event.pointerId);

  if (state.pointers.size === 1) {
    const [[pointerId, point]] = [...state.pointers.entries()];
    state.gesture.dragPointerId = pointerId;
    state.gesture.lastX = point.x;
    state.gesture.lastY = point.y;
  } else if (state.pointers.size === 0) {
    state.gesture.dragPointerId = null;
    state.gesture.pinchStartDistance = 0;
  } else if (state.pointers.size === 2) {
    const [a, b] = [...state.pointers.values()];
    state.gesture.pinchStartDistance = distanceBetween(a, b);
    state.gesture.pinchStartScale = state.crop.scale;
  }
}

function onCropWheel(event) {
  if (!state.image) {
    return;
  }

  event.preventDefault();
  const point = getCanvasPoint(event);
  const factor = event.deltaY < 0 ? 1.05 : 0.95;
  scaleCrop(state.crop.scale * factor, point.x, point.y);
  requestRender();
}

function scaleCrop(nextScale, anchorX, anchorY) {
  const clampedScale = clamp(nextScale, state.crop.minScale, state.crop.maxScale);
  const scaleRatio = clampedScale / state.crop.scale;

  state.crop.offsetX = anchorX - (anchorX - state.crop.offsetX) * scaleRatio;
  state.crop.offsetY = anchorY - (anchorY - state.crop.offsetY) * scaleRatio;
  state.crop.scale = clampedScale;
  clampCropOffsets();
  updateZoomUi();
}

function clampCropOffsets() {
  if (!state.image) {
    return;
  }

  const drawnWidth = state.crop.sourceWidth * state.crop.scale;
  const drawnHeight = state.crop.sourceHeight * state.crop.scale;

  state.crop.offsetX = clamp(state.crop.offsetX, CROP_SIZE - drawnWidth, 0);
  state.crop.offsetY = clamp(state.crop.offsetY, CROP_SIZE - drawnHeight, 0);
}

function drawCropCanvas() {
  cropContext.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
  cropContext.fillStyle = "#0d0d0d";
  cropContext.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
  updateInputPlaceholder();

  if (!state.image) {
    return;
  }

  lcdPreviewContext.clearRect(0, 0, LCD_PREVIEW_SIZE, LCD_PREVIEW_SIZE);
  lcdPreviewContext.fillStyle = "#101010";
  lcdPreviewContext.fillRect(0, 0, LCD_PREVIEW_SIZE, LCD_PREVIEW_SIZE);
  lcdPreviewContext.drawImage(
    state.image,
    -state.crop.offsetX / state.crop.scale,
    -state.crop.offsetY / state.crop.scale,
    CROP_SIZE / state.crop.scale,
    CROP_SIZE / state.crop.scale,
    0,
    0,
    LCD_PREVIEW_SIZE,
    LCD_PREVIEW_SIZE
  );
  drawLcdDotField(lcdPreviewContext.getImageData(0, 0, LCD_PREVIEW_SIZE, LCD_PREVIEW_SIZE).data);
}

function drawLcdDotField(pixelData) {
  const step = CROP_SIZE / LCD_PREVIEW_SIZE;
  const radius = step * 0.48;

  cropContext.save();
  cropContext.fillStyle = "#090909";
  cropContext.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

  for (let y = 0; y < LCD_PREVIEW_SIZE; y += 1) {
    for (let x = 0; x < LCD_PREVIEW_SIZE; x += 1) {
      const centerX = step * x + step * 0.5;
      const centerY = step * y + step * 0.5;
      let fill = "rgba(42,42,42,0.8)";

      if (pixelData) {
        const pixelIndex = (y * LCD_PREVIEW_SIZE + x) * 4;
        const r = pixelData[pixelIndex];
        const g = pixelData[pixelIndex + 1];
        const b = pixelData[pixelIndex + 2];
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const mapped = Math.pow(luminance, 0.86);
        const red = Math.round(clamp(r * 0.92 + mapped * 24, 0, 255));
        const green = Math.round(clamp(g * 0.95 + mapped * 18, 0, 255));
        const blue = Math.round(clamp(b * 0.98 + mapped * 26, 0, 255));
        fill = `rgb(${red}, ${green}, ${blue})`;
      }

      cropContext.beginPath();
      cropContext.fillStyle = fill;
      cropContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
      cropContext.fill();
    }
  }

  cropContext.restore();
}

function requestRender(nextStatus) {
  if (nextStatus) {
    setStatus(nextStatus);
  }

  drawCropCanvas();

  if (state.settings.effectMode === "chaos") {
    if (state.renderTimerId) {
      window.clearTimeout(state.renderTimerId);
    }

    state.renderTimerId = window.setTimeout(() => {
      state.renderTimerId = null;
      scheduleRegenerationFrame();
    }, 90);
    return;
  }

  if (state.renderTimerId) {
    window.clearTimeout(state.renderTimerId);
    state.renderTimerId = null;
  }

  scheduleRegenerationFrame();
}

function scheduleRegenerationFrame() {
  if (state.frameRequested) {
    return;
  }

  state.frameRequested = true;
  requestAnimationFrame(() => {
    state.frameRequested = false;
    regenerateArtwork();
  });
}

function regenerateArtwork() {
  if (!state.image) {
    renderEmptyPreview();
    return;
  }

  drawCroppedImageToSample();
  const grayscale = buildGrayscaleMap();
  const fine = blurArray(grayscale, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(1 + state.settings.smoothness * 2));
  const structure = blurArray(grayscale, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(8 + state.settings.smoothness * 12));
  const edges = buildEdgeMap(fine, SAMPLE_SIZE, SAMPLE_SIZE);

  if (state.settings.effectMode === "chaos") {
    state.linePaths = generateChaosPaths(fine, structure, edges, state.settings);
  } else if (state.settings.effectMode === "lichtenstein") {
    state.linePaths = generateLichtensteinDots(fine, structure, edges, state.settings);
  } else if (state.settings.effectMode === "ribbon") {
    state.linePaths = generateRibbonPaths(fine, structure, edges, state.settings);
  } else if (state.settings.effectMode === "oscilloscope") {
    state.linePaths = generateOscilloscopePaths(fine, structure, edges, state.settings);
  } else if (state.settings.effectMode === "knownPleasures") {
    state.linePaths = generateKnownPleasuresPaths(fine, structure, edges, state.settings);
  } else {
    state.linePaths = generateUnknownPleasuresPaths(fine, structure, edges, state.settings);
  }
  state.svgMarkup = buildSvgMarkup(state.linePaths, state.settings, PREVIEW_SIZE);
  const previewSvgMarkup = buildSvgMarkup(state.linePaths, state.settings, PREVIEW_SIZE, {
    previewEffect: state.settings.effectMode,
  });
  elements.previewStage.classList.remove("empty");
  elements.previewStage.dataset.effect = state.settings.effectMode;
  elements.previewStage.innerHTML = previewSvgMarkup;

  if (state.linePaths.length > 0) {
    setStatus("Artwork ready. Download PNG or SVG when you like.");
  } else {
    setStatus("No lines were generated. Try lowering the detail threshold.");
  }
}

function drawCroppedImageToSample() {
  sampleContext.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  sampleContext.fillStyle = "#000";
  sampleContext.fillRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  if (!state.image) {
    return;
  }

  const sx = -state.crop.offsetX / state.crop.scale;
  const sy = -state.crop.offsetY / state.crop.scale;
  const sw = CROP_SIZE / state.crop.scale;
  const sh = CROP_SIZE / state.crop.scale;

  sampleContext.drawImage(state.image, sx, sy, sw, sh, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
}

function buildGrayscaleMap() {
  const { data } = sampleContext.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const grayscale = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE);
  const isChaos = state.settings.effectMode === "chaos";
  const rawLuma = isChaos ? new Float32Array(grayscale.length) : null;
  const histogram = isChaos ? new Uint32Array(256) : null;
  const contrast =
    state.settings.effectMode === "oscilloscope"
      ? 1 + (state.settings.contrast - 1) * 0.72
      : state.settings.effectMode === "ribbon"
      ? 1 + (state.settings.contrast - 1) * 0.36
      : state.settings.contrast;
  let chaosLow = 0;
  let chaosHigh = 1;

  if (isChaos) {
    for (let index = 0; index < grayscale.length; index += 1) {
      const dataIndex = index * 4;
      const r = data[dataIndex] / 255;
      const g = data[dataIndex + 1] / 255;
      const b = data[dataIndex + 2] / 255;
      const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      rawLuma[index] = value;
      histogram[clamp(Math.round(value * 255), 0, 255)] += 1;
    }

    chaosLow = histogramPercentile(histogram, grayscale.length, 0.025) / 255;
    chaosHigh = histogramPercentile(histogram, grayscale.length, 0.975) / 255;
    if (chaosHigh - chaosLow < 0.12) {
      const center = (chaosLow + chaosHigh) * 0.5;
      chaosLow = clamp(center - 0.12, 0, 0.9);
      chaosHigh = clamp(center + 0.12, 0.1, 1);
    }
  }

  for (let index = 0; index < grayscale.length; index += 1) {
    let value;

    if (isChaos) {
      value = clamp((rawLuma[index] - chaosLow) / Math.max(0.001, chaosHigh - chaosLow), 0, 1);
      value = Math.pow(value, 0.86);
    } else {
      const dataIndex = index * 4;
      const r = data[dataIndex] / 255;
      const g = data[dataIndex + 1] / 255;
      const b = data[dataIndex + 2] / 255;
      value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    value = clamp((value - 0.5) * contrast + 0.5, 0, 1);
    if (state.settings.effectMode === "oscilloscope") {
      value = smoothStep(0.18, 0.84, value);
    } else if (isChaos) {
      value = smoothStep(0.06, 0.96, value);
    }
    grayscale[index] = value;
  }

  return grayscale;
}

function histogramPercentile(histogram, total, percentile) {
  const target = Math.max(0, Math.min(total - 1, Math.floor(total * percentile)));
  let count = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    count += histogram[index];
    if (count > target) {
      return index;
    }
  }

  return histogram.length - 1;
}

function blurArray(source, width, height, radius) {
  if (radius <= 0) {
    return source;
  }

  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sampleX = clamp(x + dx, 0, width - 1);
        total += source[y * width + sampleX];
        count += 1;
      }
      horizontal[y * width + x] = total / count;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sampleY = clamp(y + dy, 0, height - 1);
        total += horizontal[sampleY * width + x];
        count += 1;
      }
      output[y * width + x] = total / count;
    }
  }

  return output;
}

function buildEdgeMap(source, width, height) {
  const edges = new Float32Array(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = source[y * width + clamp(x - 1, 0, width - 1)];
      const right = source[y * width + clamp(x + 1, 0, width - 1)];
      const top = source[clamp(y - 1, 0, height - 1) * width + x];
      const bottom = source[clamp(y + 1, 0, height - 1) * width + x];
      const dx = Math.abs(right - left);
      const dy = Math.abs(bottom - top);
      edges[y * width + x] = clamp((dx + dy) * 2.6, 0, 1);
    }
  }

  return edges;
}

function generateUnknownPleasuresPaths(grayscale, structure, edges, settings) {
  const paths = [];
  const { lineCount, amplitude, smoothness, detailThreshold, margin, recognition } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const spacing = usableSize / Math.max(1, lineCount - 1);
  const sampleStep = Math.max(2, Math.round(SAMPLE_SIZE / 240));
  const amplitudePx = amplitude * (3.2 - recognition * 0.9);
  const thresholdBase = detailThreshold;

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const baseY = margin + spacing * lineIndex;
    const sampleY = Math.round((lineIndex / Math.max(1, lineCount - 1)) * (SAMPLE_SIZE - 1));
    const points = [];

    for (let sampleX = 0; sampleX < SAMPLE_SIZE; sampleX += sampleStep) {
      const sampleIndex = sampleY * SAMPLE_SIZE + sampleX;
      const luminance = grayscale[sampleIndex];
      const localAverage = structure[sampleIndex];
      const darkness = settings.invert ? luminance : 1 - luminance;
      const edge = edges[sampleIndex];
      const localContrast = Math.abs(luminance - localAverage);

      const density = Math.pow(darkness, 1.85);
      const activity = localContrast * 1.65 + edge * 1.2;
      const backgroundGate = smoothStep(0.04, 0.24, activity);
      const densitySignal = density * (0.78 - recognition * 0.58) * backgroundGate;
      const detailSignal = localContrast * (0.45 + recognition * 1.55);
      const edgeSignal = edge * (0.45 + recognition * 0.55);
      const signal = densitySignal + detailSignal + edgeSignal;
      const thresholded = Math.max(0, signal - thresholdBase) / Math.max(0.0001, 1 - thresholdBase);
      const envelope = smoothStep(0, 1, thresholded);
      const ridge = -amplitudePx * envelope * (0.35 + density * 0.42 + localContrast * 1.5 + edge * 0.7);
      const ripple = edge * amplitudePx * (0.08 + (1 - smoothness) * 0.1) * Math.sin(sampleX * 0.13 + lineIndex * 0.5);

      const x = margin + (sampleX / (SAMPLE_SIZE - 1)) * usableSize;
      const y = baseY + ridge + ripple;
      points.push({ x, y });
    }

    smoothPoints(points, Math.round(2 + smoothness * 6));
    paths.push({
      kind: "occlusion",
      points,
      fillColor: "#000000",
    });
    paths.push({
      kind: "scanline",
      points,
      strokeWidth: settings.strokeWidth,
      lineCap: "butt",
    });
  }

  return paths;
}

function generateKnownPleasuresPaths(grayscale, structure, edges, settings) {
  const paths = [];
  const { lineCount, amplitude, smoothness, detailThreshold, margin, recognition, contourDetail } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const spacing = usableSize / Math.max(1, lineCount - 1);
  const sampleStep = 1;
  const maxDeviation = spacing * 0.42;
  const amplitudePx = maxDeviation * clamp(amplitude / 120, 0, 1);
  const baseFrequency = 0.012 + (1 - smoothness) * 0.01;
  const waveFrequency = 0.75 + contourDetail * 1.35 + recognition * 1.05;
  const activationStart = Math.min(0.72, detailThreshold * 0.72);
  const activationEnd = Math.min(0.88, detailThreshold + 0.06 + (1 - recognition) * 0.04);

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const baseY = margin + spacing * lineIndex;
    const sampleY = Math.round((lineIndex / Math.max(1, lineCount - 1)) * (SAMPLE_SIZE - 1));
    const points = [];
    let phase = lineIndex * 0.57 + smoothHashNoise(lineIndex, lineCount, 11) * Math.PI * 2;
    let carriedWave = 0;

    for (let sampleX = 0; sampleX < SAMPLE_SIZE; sampleX += sampleStep) {
      const sampleIndex = sampleY * SAMPLE_SIZE + sampleX;
      const luminance = grayscale[sampleIndex];
      const brightness = settings.invert ? 1 - luminance : luminance;
      const liftedBrightness = smoothStep(0.08, 0.92, brightness);
      const frequencyTone = clamp(Math.pow(liftedBrightness, 0.42) * 0.42 + Math.pow(liftedBrightness, 2.25) * 1.18, 0, 1.6);
      const activeGate = smoothStep(activationStart, activationEnd, brightness);
      const fineTexture = smoothHashNoise(sampleX * 0.11, lineIndex * 1.71, 23) - 0.5;
      const localFrequency = clamp(baseFrequency + activeGate * frequencyTone * waveFrequency, baseFrequency, 2.65);
      const localAmplitude = amplitudePx * activeGate;

      phase += localFrequency * sampleStep;
      const wave =
        Math.sin(phase) * localAmplitude +
        Math.sin(phase * 2.1 + lineIndex * 0.23) * localAmplitude * (0.08 + (1 - smoothness) * 0.06) +
        fineTexture * localAmplitude * (0.025 + (1 - smoothness) * 0.045);
      const follow = 0.72 - smoothness * 0.24;
      carriedWave = carriedWave * (1 - follow) + wave * follow;
      carriedWave = clamp(carriedWave, -maxDeviation, maxDeviation);

      const x = margin + (sampleX / (SAMPLE_SIZE - 1)) * usableSize;
      const y = baseY + carriedWave;
      points.push({ x, y });
    }

    smoothPoints(points, Math.round(smoothness * 3));
    paths.push({
      kind: "scanline",
      curve: "linear",
      points,
      strokeWidth: settings.strokeWidth,
    });
  }

  return paths;
}

function generateOscilloscopePaths(grayscale, structure, edges, settings) {
  const { lineCount, amplitude, smoothness, margin, recognition, contourDetail, strokeWidth } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const columns = Math.max(34, Math.round(lineCount * 0.76));
  const sampleStepY = Math.max(2, Math.round(SAMPLE_SIZE / 260));
  const toneMap = buildOscilloscopeDensityMap(grayscale, structure, edges, settings);
  const broadToneMap = blurArray(toneMap, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(16 + smoothness * 16));
  const activityMap = buildOscilloscopeActivityMap(grayscale, structure, edges, settings);
  const displacementMap = buildOscilloscopeDisplacementMap(grayscale, structure, edges, settings);
  const paths = [];
  const waveScale = amplitude * (0.72 + recognition * 0.72);
  const baseWidth = (usableSize / columns) * (0.18 + strokeWidth * 0.14);
  const minWidth = Math.max(0.28, baseWidth * 0.07);

  for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
    const baseSampleX = ((columnIndex + 0.5) / columns) * (SAMPLE_SIZE - 1);
    const columnTone = averageColumnSignal(broadToneMap, baseSampleX, 8);
    const columnActivity = averageColumnSignal(activityMap, baseSampleX, 8);
    const columnPresence = smoothStep(0.02, 0.34, columnTone + columnActivity * 0.9);

    const centerPoints = [];
    const widthSamples = [];
    let previousX = baseSampleX;

    for (let sampleY = 0; sampleY < SAMPLE_SIZE; sampleY += sampleStepY) {
      const sampleX = clamp(Math.round(previousX), 0, SAMPLE_SIZE - 1);
      const index = sampleY * SAMPLE_SIZE + sampleX;
      const tone = toneMap[index];
      const broadTone = broadToneMap[index];
      const activity = activityMap[index];
      const sourceTone = grayscale[index];
      const flatDark = clamp(1 - Math.max(tone, sourceTone) * 1.75 - activity * 2.25, 0, 1);
      const rowIndex = Math.floor(sampleY / sampleStepY);
      const texturedDark = clamp((1 - tone) * activity * 2.2, 0, 1);
      const waveStrength = clamp(activity * (0.85 + contourDetail * 0.75) + texturedDark * 1.05 + edges[index] * 0.42, 0, 1);
      const localPull = findLocalEdgePull(edges, activityMap, previousX, sampleY, settings);
      const displacement = displacementMap[index] * waveScale * (0.18 + waveStrength * 1.28);
      const jitter = (smoothHashNoise(columnIndex, rowIndex, 3) - 0.5) * amplitude * (0.08 + waveStrength * 0.3);
      const targetSampleX = baseSampleX + localPull * (0.45 + waveStrength * 0.65) + displacement + jitter;
      const follow = 0.24 + (1 - smoothness) * 0.24;
      previousX = previousX * (1 - follow) + targetSampleX * follow;
      const width =
        baseWidth *
        columnPresence *
        (0.04 + Math.max(tone, sourceTone * 0.92) * 1.34 + activity * 0.38) *
        (1 - waveStrength * 0.68) *
        (1 - flatDark * 0.82);

      centerPoints.push({
        x: clamp(margin + (previousX / (SAMPLE_SIZE - 1)) * usableSize, margin, PREVIEW_SIZE - margin),
        y: margin + (sampleY / (SAMPLE_SIZE - 1)) * usableSize,
      });
      widthSamples.push(clamp(width, minWidth, baseWidth * 1.35));
    }

    smoothRibbonCenters(centerPoints, Math.round(2 + smoothness * 5));
    paths.push({
      kind: "oscilloscope",
      fill: true,
      points: buildRibbonPolygon(centerPoints, widthSamples),
    });
  }

  return paths;
}

function averageColumnSignal(map, sampleX, stepY) {
  const x = clamp(Math.round(sampleX), 0, SAMPLE_SIZE - 1);
  let total = 0;
  let count = 0;

  for (let y = 0; y < SAMPLE_SIZE; y += stepY) {
    total += map[y * SAMPLE_SIZE + x];
    count += 1;
  }

  return count > 0 ? total / count : 0;
}

function findLocalEdgePull(edges, activityMap, centerX, sampleY, settings) {
  const y = clamp(Math.round(sampleY), 0, SAMPLE_SIZE - 1);
  const radius = Math.round(12 + settings.recognition * 18);
  const center = clamp(Math.round(centerX), 0, SAMPLE_SIZE - 1);
  let weightedOffset = 0;
  let totalWeight = 0;

  for (let dx = -radius; dx <= radius; dx += 1) {
    const x = clamp(center + dx, 0, SAMPLE_SIZE - 1);
    const index = y * SAMPLE_SIZE + x;
    const distanceFalloff = 1 - Math.abs(dx) / (radius + 1);
    const weight = Math.pow(edges[index] * 1.35 + activityMap[index] * 0.75, 1.4) * distanceFalloff;
    weightedOffset += dx * weight;
    totalWeight += weight;
  }

  if (totalWeight < 0.0001) {
    return 0;
  }

  return clamp(weightedOffset / totalWeight, -radius * 0.82, radius * 0.82);
}

function generateRibbonPaths(grayscale, structure, edges, settings) {
  const { lineCount, amplitude, smoothness, detailThreshold, margin, recognition, contourDetail, strokeWidth } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const columns = Math.max(30, Math.round(lineCount * 0.72));
  const sampleStepY = Math.max(2, Math.round(SAMPLE_SIZE / 260));
  const densityMap = buildOscilloscopeDensityMap(grayscale, structure, edges, settings);
  const spacingMap = buildOscilloscopeSpacingMap(densityMap, settings);
  const displacementMap = buildOscilloscopeDisplacementMap(grayscale, structure, edges, settings);
  const paths = [];
  const waveScale = amplitude * (0.52 + recognition * 0.5);
  const baseWidth = (usableSize / columns) * (0.2 + strokeWidth * 0.13);
  const minWidth = Math.max(0.7, baseWidth * 0.22);

  for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
    const baseSampleX = ((columnIndex + 0.5) / columns) * (SAMPLE_SIZE - 1);
    const centerPoints = [];
    const widthSamples = [];
    let previousX = baseSampleX;

    for (let sampleY = 0; sampleY < SAMPLE_SIZE; sampleY += sampleStepY) {
      const sampleX = clamp(Math.round(previousX), 0, SAMPLE_SIZE - 1);
      const index = sampleY * SAMPLE_SIZE + sampleX;
      const density = densityMap[index];
      const spacingGate = spacingMap[index];
      const localDarkness = 1 - density;
      const waveStrength = clamp(localDarkness * (0.45 + contourDetail * 0.35) + edges[index] * 0.55, 0, 1);
      const displacement = displacementMap[index] * waveScale * (0.35 + waveStrength * 0.85);
      const localWobble = (smoothHashNoise(columnIndex, Math.floor(sampleY / sampleStepY), 0) - 0.5) * amplitude * 0.16 * waveStrength;
      const targetSampleX = baseSampleX + displacement + localWobble;
      const follow = 0.3 + (1 - smoothness) * 0.22;
      previousX = previousX * (1 - follow) + targetSampleX * follow;

      const x = margin + (previousX / (SAMPLE_SIZE - 1)) * usableSize;
      const y = margin + (sampleY / (SAMPLE_SIZE - 1)) * usableSize;
      const width = baseWidth * spacingGate * (0.34 + density * 1.15) * (1 - waveStrength * 0.58);
      centerPoints.push({ x: clamp(x, margin, PREVIEW_SIZE - margin), y });
      widthSamples.push(clamp(width, minWidth, baseWidth * 1.45));
    }

    smoothRibbonCenters(centerPoints, Math.round(2 + smoothness * 6));
    paths.push({
      kind: "ribbon",
      fill: true,
      points: buildRibbonPolygon(centerPoints, widthSamples),
    });
  }

  return paths;
}

function generateLichtensteinDots(grayscale, structure, edges, settings) {
  const { lineCount, amplitude, margin, detailThreshold, recognition, contourDetail, strokeWidth } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const columns = Math.max(36, Math.round(lineCount));
  const cell = usableSize / columns;
  const dotSizeCell = usableSize / 30;
  const radius = clamp(dotSizeCell * (0.08 + strokeWidth * 0.024), 1.92, dotSizeCell * 0.208);
  const minimumDistance = radius * 2.18;
  const placementGridSize = minimumDistance;
  const placementGrid = new Map();
  const candidateCount = Math.round(columns * columns * (1.22 + recognition * 0.58));
  const shadowDensity = 0.018 + (1 - recognition) * 0.045;
  const toneExponent = 1.18 - recognition * 0.46;
  const attractionAmount = clamp(0.12 + recognition * 0.22 + contourDetail * 0.16, 0, 0.48);
  const driftAmount = clamp(amplitude / 120, 0, 0.8);
  const dots = [];

  for (let seed = 0; seed < candidateCount; seed += 1) {
    const unitX = randomUnit(seed, 0);
    const unitY = randomUnit(seed, 1);
    const baseX = margin + unitX * usableSize;
    const baseY = margin + unitY * usableSize;
    const sampleX = clamp(Math.round(unitX * (SAMPLE_SIZE - 1)), 0, SAMPLE_SIZE - 1);
    const sampleY = clamp(Math.round(unitY * (SAMPLE_SIZE - 1)), 0, SAMPLE_SIZE - 1);
    const index = sampleY * SAMPLE_SIZE + sampleX;
    const sourceTone = grayscale[index] * 0.64 + structure[index] * 0.36;
    const tone = settings.invert ? 1 - sourceTone : sourceTone;
    const detail = Math.abs(grayscale[index] - structure[index]) * 0.58 + edges[index] * 0.42;
    const liftedTone = clamp((tone - detailThreshold * 0.36) / Math.max(0.001, 1 - detailThreshold * 0.36), 0, 1);
    const density = clamp(
      shadowDensity + Math.pow(liftedTone, toneExponent) * (0.9 - shadowDensity) + detail * contourDetail * 0.18,
      0,
      0.96
    );

    if (randomUnit(seed, 2) <= density) {
      const attract = brightAttractionOffset(grayscale, sampleX, sampleY, cell, attractionAmount);
      const driftX = (randomUnit(seed, 3) - 0.5) * cell * driftAmount;
      const driftY = (randomUnit(seed, 4) - 0.5) * cell * driftAmount;
      const x = clamp(baseX + attract.x + driftX, margin, PREVIEW_SIZE - margin);
      const y = clamp(baseY + attract.y + driftY, margin, PREVIEW_SIZE - margin);

      if (!canPlaceDot(placementGrid, x, y, placementGridSize, minimumDistance)) {
        continue;
      }

      registerPlacedDot(placementGrid, x, y, placementGridSize);
      dots.push({
        kind: "dot",
        x,
        y,
        r: radius,
      });
    }
  }

  return dots;
}

function generateChaosPaths(grayscale, structure, edges, settings) {
  const { lineCount, amplitude, smoothness, margin, recognition, contourDetail, strokeWidth } = settings;
  const usableSize = PREVIEW_SIZE - margin * 2;
  const contourSource = buildChaosContourSource(grayscale, structure, edges, settings);
  const binaryThreshold = computeOtsuThreshold(contourSource);
  const binaryMap = buildChaosBinaryMap(contourSource, binaryThreshold, settings);
  const contourSubpaths = generateChaosContourSubpaths(contourSource, binaryThreshold, edges, settings, margin, usableSize);
  const densityMap = buildChaosToneDensityMap(grayscale, structure, edges, binaryMap, settings);
  const visitMap = new Float32Array(densityMap.length);
  const toneSubpaths = [];
  const strokeCount = Math.round(lineCount * (0.46 + recognition * 0.46));
  const maxSteps = Math.round(70 + amplitude * 0.95);
  const stepSize = 1.85 + amplitude * 0.018;
  const inertia = 0.78 + smoothness * 0.16;
  const densityWeight = 0.1 + recognition * 0.2;
  const noiseWeight = 0.14 + (1 - smoothness) * 0.2;

  for (let strokeIndex = 0; strokeIndex < strokeCount; strokeIndex += 1) {
    const start = chooseChaosStart(densityMap, visitMap, strokeIndex, settings);
    if (!start) {
      continue;
    }

    let sampleX = start.x;
    let sampleY = start.y;
    const initialAngle = randomUnit(strokeIndex, 8) * Math.PI * 2;
    let dirX = Math.cos(initialAngle);
    let dirY = Math.sin(initialAngle);
    const points = [];

    for (let step = 0; step < maxSteps; step += 1) {
      const roundedX = clamp(Math.round(sampleX), 0, SAMPLE_SIZE - 1);
      const roundedY = clamp(Math.round(sampleY), 0, SAMPLE_SIZE - 1);
      const index = roundedY * SAMPLE_SIZE + roundedX;
      const density = densityMap[index] / (1 + visitMap[index] * 0.5);

      if (step > 18 && density < 0.035 && randomUnit(strokeIndex * 409 + step, 9) > density * 10) {
        break;
      }

      points.push(mapSamplePointToPreview(sampleX, sampleY, margin, usableSize));
      markChaosCoverage(visitMap, roundedX, roundedY, 0.5 + densityMap[index] * 0.46);

      const flow = chaosToneFlowVector(densityMap, strokeIndex, step, sampleX, sampleY);
      const noiseAngle = chaosNoiseAngle(strokeIndex, step, sampleX, sampleY);
      const noiseX = Math.cos(noiseAngle);
      const noiseY = Math.sin(noiseAngle);
      const brightnessPull = chaosBrightnessPull(densityMap, sampleX, sampleY);
      const nextDirX =
        dirX * inertia +
        flow.x * (0.44 + contourDetail * 0.16) +
        noiseX * noiseWeight +
        brightnessPull.x * densityWeight;
      const nextDirY =
        dirY * inertia +
        flow.y * (0.44 + contourDetail * 0.16) +
        noiseY * noiseWeight +
        brightnessPull.y * densityWeight;
      const length = Math.max(0.0001, Math.hypot(nextDirX, nextDirY));
      dirX = nextDirX / length;
      dirY = nextDirY / length;

      const localStep = stepSize * (0.82 + randomUnit(strokeIndex * 211 + step, 10) * 0.36) * (0.88 + density * 0.28);
      sampleX += dirX * localStep;
      sampleY += dirY * localStep;

      if (sampleX < 0 || sampleX > SAMPLE_SIZE - 1 || sampleY < 0 || sampleY > SAMPLE_SIZE - 1) {
        break;
      }
    }

    if (points.length >= 6) {
      smoothChaosPoints(points, Math.round(1 + smoothness * 3));
      toneSubpaths.push(points);
    }
  }

  if (contourSubpaths.length === 0 && toneSubpaths.length === 0) {
    return [];
  }

  const paths = [];
  if (contourSubpaths.length > 0) {
    paths.push({
      kind: "chaos",
      subpaths: contourSubpaths,
      strokeWidth,
    });
  }

  if (toneSubpaths.length > 0) {
    paths.push({
      kind: "chaos",
      subpaths: toneSubpaths,
      strokeWidth,
    });
  }

  return paths;
}

function computeOtsuThreshold(source) {
  const histogram = new Uint32Array(256);

  for (let index = 0; index < source.length; index += 1) {
    histogram[clamp(Math.round(source[index] * 255), 0, 255)] += 1;
  }

  const total = source.length;
  let sum = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    sum += index * histogram[index];
  }

  let weightBackground = 0;
  let sumBackground = 0;
  let bestVariance = -Infinity;
  let bestThreshold = 128;

  for (let threshold = 0; threshold < histogram.length; threshold += 1) {
    weightBackground += histogram[threshold];
    if (weightBackground === 0) {
      continue;
    }

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) {
      break;
    }

    sumBackground += threshold * histogram[threshold];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = threshold;
    }
  }

  return clamp(bestThreshold / 255, 0.18, 0.82);
}

function buildChaosBinaryMap(structure, threshold, settings) {
  const binary = new Uint8Array(structure.length);

  for (let index = 0; index < structure.length; index += 1) {
    const tone = settings.invert ? 1 - structure[index] : structure[index];
    binary[index] = tone > threshold ? 1 : 0;
  }

  return binary;
}

function buildChaosContourSource(grayscale, structure, edges, settings) {
  const source = new Float32Array(grayscale.length);

  for (let index = 0; index < source.length; index += 1) {
    const baseTone = grayscale[index] * 0.76 + structure[index] * 0.24;
    const detail = (grayscale[index] - structure[index]) * (0.28 + settings.recognition * 0.18);
    const edgeLift = edges[index] * (0.05 + settings.contourDetail * 0.08);
    source[index] = clamp(baseTone + detail + edgeLift, 0, 1);
  }

  return blurArray(source, SAMPLE_SIZE, SAMPLE_SIZE, settings.smoothness > 0.76 ? 1 : 0);
}

function generateChaosContourSubpaths(sourceMap, threshold, edges, settings, margin, usableSize) {
  const segments = [];
  const cellStep = settings.contourDetail > 0.62 ? 3 : 4;
  const maxSegments = Math.round(760 + settings.contourDetail * 2200);
  const edgeFloor = 0.008 + (1 - settings.contourDetail) * 0.028;
  const thresholds = chaosContourThresholds(threshold);

  for (const currentThreshold of thresholds) {
    for (let y = 0; y < SAMPLE_SIZE - cellStep; y += cellStep) {
      for (let x = 0; x < SAMPLE_SIZE - cellStep; x += cellStep) {
        const topLeftValue = chaosContourTone(sourceMap[y * SAMPLE_SIZE + x], settings);
        const topRightValue = chaosContourTone(sourceMap[y * SAMPLE_SIZE + x + cellStep], settings);
        const bottomRightValue = chaosContourTone(sourceMap[(y + cellStep) * SAMPLE_SIZE + x + cellStep], settings);
        const bottomLeftValue = chaosContourTone(sourceMap[(y + cellStep) * SAMPLE_SIZE + x], settings);
        const topLeft = topLeftValue > currentThreshold ? 1 : 0;
        const topRight = topRightValue > currentThreshold ? 1 : 0;
        const bottomRight = bottomRightValue > currentThreshold ? 1 : 0;
        const bottomLeft = bottomLeftValue > currentThreshold ? 1 : 0;
        const caseIndex = topLeft * 8 + topRight * 4 + bottomRight * 2 + bottomLeft;

        if (caseIndex === 0 || caseIndex === 15) {
          continue;
        }

        const edgeAverage =
          (edges[y * SAMPLE_SIZE + x] +
            edges[y * SAMPLE_SIZE + x + cellStep] +
            edges[(y + cellStep) * SAMPLE_SIZE + x] +
            edges[(y + cellStep) * SAMPLE_SIZE + x + cellStep]) /
          4;

        if (edgeAverage < edgeFloor && Math.abs(currentThreshold - threshold) > 0.18) {
          continue;
        }

        const cellSegments = marchingSegmentsForValues(caseIndex, x, y, cellStep, currentThreshold, {
          topLeft: topLeftValue,
          topRight: topRightValue,
          bottomRight: bottomRightValue,
          bottomLeft: bottomLeftValue,
        });
        for (const segment of cellSegments) {
          segments.push(segment);

          if (segments.length >= maxSegments) {
            return mapChaosContourSubpaths(stitchChaosSegments(segments), margin, usableSize, settings);
          }
        }
      }
    }
  }

  return mapChaosContourSubpaths(stitchChaosSegments(segments), margin, usableSize, settings);
}

function chaosContourThresholds(baseThreshold) {
  const thresholds = [
    baseThreshold - 0.3,
    baseThreshold - 0.11,
    baseThreshold,
    baseThreshold + 0.065,
    baseThreshold + 0.145,
    baseThreshold + 0.34,
  ];
  const unique = [];

  for (const threshold of thresholds) {
    const clamped = clamp(threshold, 0.06, 0.94);
    if (!unique.some((value) => Math.abs(value - clamped) < 0.025)) {
      unique.push(clamped);
    }
  }

  return unique;
}

function chaosContourTone(value, settings) {
  return settings.invert ? 1 - value : value;
}

function marchingSegmentsForValues(caseIndex, x, y, step, threshold, values) {
  const interpolate = (a, b) => clamp((threshold - a) / Math.max(0.0001, b - a), 0, 1);
  const topT = interpolate(values.topLeft, values.topRight);
  const rightT = interpolate(values.topRight, values.bottomRight);
  const bottomT = interpolate(values.bottomLeft, values.bottomRight);
  const leftT = interpolate(values.topLeft, values.bottomLeft);
  const top = { x: x + step * topT, y };
  const right = { x: x + step, y: y + step * rightT };
  const bottom = { x: x + step * bottomT, y: y + step };
  const left = { x, y: y + step * leftT };
  const cases = {
    1: [[left, bottom]],
    2: [[bottom, right]],
    3: [[left, right]],
    4: [[top, right]],
    5: [
      [top, left],
      [bottom, right],
    ],
    6: [[top, bottom]],
    7: [[top, left]],
    8: [[top, left]],
    9: [[top, bottom]],
    10: [
      [top, right],
      [left, bottom],
    ],
    11: [[top, right]],
    12: [[left, right]],
    13: [[bottom, right]],
    14: [[left, bottom]],
  };

  return cases[caseIndex] || [];
}

function stitchChaosSegments(segments) {
  const startMap = new Map();
  const endMap = new Map();
  const used = new Uint8Array(segments.length);
  const stitched = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    pushChaosSegmentIndex(startMap, chaosPointKey(segment[0]), index);
    pushChaosSegmentIndex(endMap, chaosPointKey(segment[segment.length - 1]), index);
  }

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    if (used[segmentIndex]) {
      continue;
    }

    const path = [...segments[segmentIndex]];
    used[segmentIndex] = 1;

    for (;;) {
      const endKey = chaosPointKey(path[path.length - 1]);
      const next = takeChaosSegmentByEndpoint(startMap, endKey, used);
      const previous = next === null ? takeChaosSegmentByEndpoint(endMap, endKey, used) : null;

      if (next !== null) {
        used[next] = 1;
        path.push(segments[next][1]);
      } else if (previous !== null) {
        used[previous] = 1;
        path.push(segments[previous][0]);
      } else {
        break;
      }
    }

    for (;;) {
      const startKey = chaosPointKey(path[0]);
      const previous = takeChaosSegmentByEndpoint(endMap, startKey, used);
      const next = previous === null ? takeChaosSegmentByEndpoint(startMap, startKey, used) : null;

      if (previous !== null) {
        used[previous] = 1;
        path.unshift(segments[previous][0]);
      } else if (next !== null) {
        used[next] = 1;
        path.unshift(segments[next][1]);
      } else {
        break;
      }
    }

    if (path.length >= 2) {
      stitched.push(path);
    }
  }

  return stitched;
}

function pushChaosSegmentIndex(map, key, index) {
  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key).push(index);
}

function takeChaosSegmentByEndpoint(map, key, used) {
  const indexes = map.get(key);
  if (!indexes) {
    return null;
  }

  while (indexes.length > 0) {
    const index = indexes.pop();
    if (!used[index]) {
      return index;
    }
  }

  return null;
}

function chaosPointKey(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function mapChaosContourSubpaths(subpaths, margin, usableSize, settings) {
  return subpaths.map((path) => {
    const mapped = path.map((point) => ({
      x: margin + (point.x / (SAMPLE_SIZE - 1)) * usableSize,
      y: margin + (point.y / (SAMPLE_SIZE - 1)) * usableSize,
    }));
    smoothFreeformPoints(mapped, Math.round(1 + settings.smoothness * 2));
    return mapped;
  });
}

function buildChaosDensityMap(grayscale, structure, edges, settings) {
  const rawDensity = new Float32Array(grayscale.length);
  const threshold = settings.detailThreshold * 0.42;

  for (let index = 0; index < grayscale.length; index += 1) {
    const sourceTone = grayscale[index] * 0.52 + structure[index] * 0.48;
    const tone = settings.invert ? 1 - sourceTone : sourceTone;
    const densityTone = clamp((tone - threshold * 0.72) / Math.max(0.001, 1 - threshold * 0.72), 0, 1);
    const darkCut = smoothStep(0.008, 0.13, tone);
    const shadowDetailGate = smoothStep(0.018, 0.22, tone) * (1 - smoothStep(0.5, 0.84, tone));
    const midDetailGate = smoothStep(0.16, 0.44, tone) * (1 - smoothStep(0.72, 1, tone));
    const tonalDensity =
      smoothStep(0.025, 0.16, densityTone) * 0.035 +
      smoothStep(0.14, 0.34, densityTone) * 0.075 +
      smoothStep(0.3, 0.52, densityTone) * 0.12 +
      smoothStep(0.48, 0.72, densityTone) * 0.18 +
      smoothStep(0.68, 0.92, densityTone) * 0.26 +
      smoothStep(0.86, 1, densityTone) * 0.18;
    const contrast = Math.abs(grayscale[index] - structure[index]);
    const edgeSignal = Math.pow(clamp(edges[index], 0, 0.52), 1.12);
    rawDensity[index] = clamp(
      (tonalDensity * (0.78 + settings.recognition * 0.4) +
        contrast * (0.08 + settings.recognition * 0.16) * (0.32 + midDetailGate * 0.52 + shadowDetailGate * 0.56) +
        edgeSignal * (0.025 + settings.contourDetail * 0.09) * (0.28 + midDetailGate * 0.46 + shadowDetailGate * 0.9)) *
        darkCut,
      0,
      1
    );
  }

  return equalizeChaosDensity(rawDensity, settings);
}

function buildChaosToneDensityMap(grayscale, structure, edges, binaryMap, settings) {
  const rawDensity = new Float32Array(grayscale.length);
  const threshold = settings.detailThreshold * 0.28;

  for (let index = 0; index < grayscale.length; index += 1) {
    const sourceTone = grayscale[index] * 0.64 + structure[index] * 0.36;
    const tone = settings.invert ? 1 - sourceTone : sourceTone;
    const liftedTone = clamp((tone - threshold) / Math.max(0.001, 1 - threshold), 0, 1);
    const darkness = 1 - liftedTone;
    const midTone = smoothStep(0.1, 0.48, liftedTone) * (1 - smoothStep(0.82, 1, liftedTone));
    const brightTone = smoothStep(0.36, 0.98, liftedTone);
    const shadowTexture = smoothStep(0.035, 0.18, liftedTone) * (1 - smoothStep(0.44, 0.76, liftedTone));
    const contrast = Math.abs(grayscale[index] - structure[index]);
    const edgePenalty = 1 - smoothStep(0.16, 0.52, edges[index]) * 0.62;
    const binaryInterior = binaryMap[index] ? 1 : 0;
    const shapeSignal = settings.invert ? 1 - binaryInterior : binaryInterior;

    rawDensity[index] = clamp(
      (brightTone * (0.36 + settings.recognition * 0.28) +
        midTone * (0.11 + settings.recognition * 0.13) +
        shadowTexture * (0.04 + settings.contourDetail * 0.08) +
        contrast * (0.06 + settings.recognition * 0.1) * (1 - darkness * 0.42) +
        shapeSignal * 0.035) *
        edgePenalty,
      0,
      1
    );
  }

  const smoothed = blurArray(rawDensity, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(3 + settings.smoothness * 5));
  const broad = blurArray(smoothed, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(12 + settings.smoothness * 16));
  const output = new Float32Array(rawDensity.length);

  for (let index = 0; index < output.length; index += 1) {
    output[index] = clamp(smoothed[index] * 0.58 + broad[index] * 0.72, 0, 1);
  }

  return output;
}

function equalizeChaosDensity(rawDensity, settings) {
  const smoothed = blurArray(rawDensity, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(1 + settings.smoothness * 2));
  const localAverage = blurArray(rawDensity, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(7 + settings.smoothness * 6));
  const output = new Float32Array(rawDensity.length);

  for (let index = 0; index < rawDensity.length; index += 1) {
    const flattened = smoothed[index] / (0.56 + localAverage[index] * (1.08 + settings.smoothness * 0.72));
    output[index] = clamp(Math.pow(flattened, 0.82) * (0.62 + smoothed[index] * 0.42), 0, 1);
  }

  return output;
}

function connectChaosSegments(segments, amplitude, margin, usableSize) {
  const remaining = [...segments];
  const connected = [...remaining.shift()];
  const connectorNoise = 4.2 + amplitude * 0.08;

  while (remaining.length > 0) {
    const currentEnd = connected[connected.length - 1];
    let bestIndex = 0;
    let bestReverse = false;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const segment = remaining[index];
      const start = segment[0];
      const end = segment[segment.length - 1];
      const startDistance = distanceBetweenPoints(currentEnd, start);
      const endDistance = distanceBetweenPoints(currentEnd, end);

      if (startDistance < bestDistance) {
        bestDistance = startDistance;
        bestIndex = index;
        bestReverse = false;
      }

      if (endDistance < bestDistance) {
        bestDistance = endDistance;
        bestIndex = index;
        bestReverse = true;
      }
    }

    const nextSegment = remaining.splice(bestIndex, 1)[0];
    if (bestReverse) {
      nextSegment.reverse();
    }

    appendChaosConnector(connected, nextSegment[0], connectorNoise);
    connected.push(...nextSegment);
  }

  return connected.map((point) => {
    if (point.x > PREVIEW_SIZE || point.y > PREVIEW_SIZE) {
      return point;
    }

    return {
      x: clamp(point.x, margin, margin + usableSize),
      y: clamp(point.y, margin, margin + usableSize),
    };
  });
}

function appendChaosConnector(points, target, connectorNoise) {
  const start = points[points.length - 1];
  const distance = distanceBetweenPoints(start, target);
  const steps = clamp(Math.round(distance / 18), 3, 28);
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const tangentX = dx / length;
  const tangentY = dy / length;
  const bendScale = Math.min(5.4, distance / 34);
  const bendA = (randomUnit(points.length, 30) - 0.5) * connectorNoise * bendScale;
  const bendB = (randomUnit(points.length, 31) - 0.5) * connectorNoise * bendScale * 0.55;
  const crawl = (randomUnit(points.length, 32) - 0.5) * connectorNoise * Math.min(2.4, distance / 70);
  const phase = randomUnit(points.length, 33) * Math.PI * 2;

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const ease = t * t * (3 - 2 * t);
    const envelope = Math.sin(t * Math.PI);
    const offset =
      envelope * bendA +
      Math.sin(t * Math.PI * 3 + phase) * bendB * envelope +
      (randomUnit(points.length + step, 34) - 0.5) * connectorNoise * 0.5 * envelope;
    const along = Math.sin(t * Math.PI * 2 + phase) * crawl * envelope;
    points.push({
      x: start.x + dx * ease + normalX * offset + tangentX * along,
      y: start.y + dy * ease + normalY * offset + tangentY * along,
    });
  }
}

function distanceBetweenPoints(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sampleChaosAnchors(densityMap, settings) {
  const targetCount = Math.round(78 + settings.lineCount * 1.26);
  const minimumDistance = clamp(10 - settings.recognition * 4.5, 4.5, 10);
  const placementGrid = new Map();
  const anchors = [];
  const maxAttempts = targetCount * 95;

  for (let attempt = 0; attempt < maxAttempts && anchors.length < targetCount; attempt += 1) {
    const x = randomUnit(attempt, 24) * (SAMPLE_SIZE - 1);
    const y = randomUnit(attempt, 25) * (SAMPLE_SIZE - 1);
    const index = Math.round(y) * SAMPLE_SIZE + Math.round(x);
    const density = densityMap[index];
    const acceptance = clamp(Math.pow(density, 0.78) * (0.92 + settings.recognition * 0.32), 0, 1);

    if (randomUnit(attempt, 26) > acceptance) {
      continue;
    }

    if (!canPlaceDot(placementGrid, x, y, minimumDistance, minimumDistance)) {
      continue;
    }

    registerPlacedDot(placementGrid, x, y, minimumDistance);
    anchors.push({ x, y, density });
  }

  return anchors;
}

function orderChaosAnchors(anchors, settings) {
  const remaining = [...anchors];
  const ordered = [];
  let currentIndex = 0;
  let bestStartScore = -Infinity;

  for (let index = 0; index < remaining.length; index += 1) {
    const anchor = remaining[index];
    const startScore = anchor.density + (1 - anchor.y / SAMPLE_SIZE) * 0.16 + randomUnit(index, 27) * 0.08;
    if (startScore > bestStartScore) {
      bestStartScore = startScore;
      currentIndex = index;
    }
  }

  ordered.push(remaining.splice(currentIndex, 1)[0]);

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nextIndex = 0;
    let bestScore = -Infinity;
    const sampleLimit = Math.min(remaining.length, 64);
    const offset = Math.floor(randomUnit(remaining.length + ordered.length, 28) * Math.max(1, remaining.length));

    for (let sample = 0; sample < sampleLimit; sample += 1) {
      const index = (offset + sample * 17) % remaining.length;
      const candidate = remaining[index];
      const distance = Math.hypot(candidate.x - current.x, candidate.y - current.y);
      const idealDistance = smoothStep(18, 80, distance) * (1 - smoothStep(118, 250, distance));
      const score =
        idealDistance * 0.74 +
        candidate.density * (0.55 + settings.recognition * 0.32) +
        randomUnit(ordered.length * 31 + sample, 29) * 0.14;

      if (score > bestScore) {
        bestScore = score;
        nextIndex = index;
      }
    }

    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
}

function chooseChaosStart(densityMap, visitMap, strokeIndex, settings) {
  const attempts = 34;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const seed = strokeIndex * 97 + attempt;
    const x = randomUnit(seed, 12) * (SAMPLE_SIZE - 1);
    const y = randomUnit(seed, 13) * (SAMPLE_SIZE - 1);
    const index = Math.round(y) * SAMPLE_SIZE + Math.round(x);
    const density = densityMap[index] / (1 + visitMap[index] * 0.78);

    const acceptance = Math.pow(density, 1.12) * (0.78 + settings.recognition * 0.46);
    if (randomUnit(seed, 14) < acceptance) {
      return { x, y };
    }
  }

  return null;
}

function markChaosCoverage(visitMap, centerX, centerY, amount) {
  for (let dy = -2; dy <= 2; dy += 1) {
    const y = clamp(centerY + dy, 0, SAMPLE_SIZE - 1);
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = clamp(centerX + dx, 0, SAMPLE_SIZE - 1);
      const distance = Math.hypot(dx, dy);
      const weight = Math.max(0, 1 - distance / 2.8);
      visitMap[y * SAMPLE_SIZE + x] += amount * weight;
    }
  }
}

function mapSamplePointToPreview(sampleX, sampleY, margin, usableSize) {
  return {
    x: margin + (sampleX / (SAMPLE_SIZE - 1)) * usableSize,
    y: margin + (sampleY / (SAMPLE_SIZE - 1)) * usableSize,
  };
}

function chooseChaosWaypoint(densityMap, visitMap, currentX, currentY, step, settings) {
  let best = null;
  let bestScore = -Infinity;
  const attempts = 96;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const seed = step * 131 + attempt * 17 + 23;
    const x = randomUnit(seed, 17) * (SAMPLE_SIZE - 1);
    const y = randomUnit(seed, 18) * (SAMPLE_SIZE - 1);
    const index = Math.round(y) * SAMPLE_SIZE + Math.round(x);
    const density = densityMap[index];
    const visited = visitMap[index];
    const distance = Math.hypot(x - currentX, y - currentY);
    const distanceScore = smoothStep(18, 115, distance) * (1 - smoothStep(190, 330, distance));
    const score =
      density * (1.12 + settings.recognition * 0.64) +
      distanceScore * 0.44 +
      randomUnit(seed, 19) * 0.16 -
      visited * 1.1;

    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }

  return best || { x: currentX, y: currentY };
}

function markChaosVisit(visitMap, sampleX, sampleY, radius) {
  for (let y = sampleY - radius; y <= sampleY + radius; y += 1) {
    if (y < 0 || y >= SAMPLE_SIZE) {
      continue;
    }

    for (let x = sampleX - radius; x <= sampleX + radius; x += 1) {
      if (x < 0 || x >= SAMPLE_SIZE) {
        continue;
      }

      const distance = Math.hypot(x - sampleX, y - sampleY);
      if (distance > radius) {
        continue;
      }

      const index = y * SAMPLE_SIZE + x;
      visitMap[index] = clamp(visitMap[index] + (1 - distance / (radius + 1)) * 0.1, 0, 1);
    }
  }
}

function chaosFlowVector(grayscale, densityMap, strokeIndex, step, sampleX, sampleY) {
  const x = clamp(Math.round(sampleX), 0, SAMPLE_SIZE - 1);
  const y = clamp(Math.round(sampleY), 0, SAMPLE_SIZE - 1);
  const left = grayscale[y * SAMPLE_SIZE + clamp(x - 2, 0, SAMPLE_SIZE - 1)];
  const right = grayscale[y * SAMPLE_SIZE + clamp(x + 2, 0, SAMPLE_SIZE - 1)];
  const top = grayscale[clamp(y - 2, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const bottom = grayscale[clamp(y + 2, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const densityLeft = densityMap[y * SAMPLE_SIZE + clamp(x - 3, 0, SAMPLE_SIZE - 1)];
  const densityRight = densityMap[y * SAMPLE_SIZE + clamp(x + 3, 0, SAMPLE_SIZE - 1)];
  const densityTop = densityMap[clamp(y - 3, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const densityBottom = densityMap[clamp(y + 3, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const gradX = right - left + (densityRight - densityLeft) * 0.8;
  const gradY = bottom - top + (densityBottom - densityTop) * 0.8;
  const flip = randomUnit(strokeIndex, 15) > 0.5 ? 1 : -1;
  const tangentX = -gradY * flip;
  const tangentY = gradX * flip;
  const tangentLength = Math.hypot(tangentX, tangentY);

  if (tangentLength > 0.0001) {
    return {
      x: tangentX / tangentLength,
      y: tangentY / tangentLength,
    };
  }

  const angle = chaosNoiseAngle(strokeIndex, step, sampleX, sampleY);
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function chaosBrightnessPull(densityMap, sampleX, sampleY) {
  const x = clamp(Math.round(sampleX), 0, SAMPLE_SIZE - 1);
  const y = clamp(Math.round(sampleY), 0, SAMPLE_SIZE - 1);
  const left = densityMap[y * SAMPLE_SIZE + clamp(x - 5, 0, SAMPLE_SIZE - 1)];
  const right = densityMap[y * SAMPLE_SIZE + clamp(x + 5, 0, SAMPLE_SIZE - 1)];
  const top = densityMap[clamp(y - 5, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const bottom = densityMap[clamp(y + 5, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const pullX = right - left;
  const pullY = bottom - top;
  const length = Math.hypot(pullX, pullY);

  if (length < 0.0001) {
    return { x: 0, y: 0 };
  }

  return {
    x: pullX / length,
    y: pullY / length,
  };
}

function chaosToneFlowVector(densityMap, strokeIndex, step, sampleX, sampleY) {
  const x = clamp(Math.round(sampleX), 0, SAMPLE_SIZE - 1);
  const y = clamp(Math.round(sampleY), 0, SAMPLE_SIZE - 1);
  const left = densityMap[y * SAMPLE_SIZE + clamp(x - 9, 0, SAMPLE_SIZE - 1)];
  const right = densityMap[y * SAMPLE_SIZE + clamp(x + 9, 0, SAMPLE_SIZE - 1)];
  const top = densityMap[clamp(y - 9, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const bottom = densityMap[clamp(y + 9, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + x];
  const gradX = right - left;
  const gradY = bottom - top;
  const tangentLength = Math.hypot(gradX, gradY);
  const flip = randomUnit(strokeIndex, 41) > 0.5 ? 1 : -1;
  const waveAngle =
    Math.sin(sampleY * 0.018 + strokeIndex * 0.37) * 0.95 +
    Math.cos(sampleX * 0.012 + step * 0.035 + strokeIndex * 0.19) * 0.45;
  const waveX = Math.cos(waveAngle);
  const waveY = Math.sin(waveAngle);

  if (tangentLength < 0.0001) {
    return { x: waveX, y: waveY };
  }

  const tangentX = (-gradY / tangentLength) * flip;
  const tangentY = (gradX / tangentLength) * flip;
  const mixedX = tangentX * 0.58 + waveX * 0.42;
  const mixedY = tangentY * 0.58 + waveY * 0.42;
  const mixedLength = Math.max(0.0001, Math.hypot(mixedX, mixedY));

  return {
    x: mixedX / mixedLength,
    y: mixedY / mixedLength,
  };
}

function chaosNoiseAngle(strokeIndex, step, sampleX, sampleY) {
  const scaleX = sampleX * 0.045;
  const scaleY = sampleY * 0.045;
  const wobble =
    Math.sin(scaleX * 1.7 + strokeIndex * 0.31) +
    Math.cos(scaleY * 1.3 + strokeIndex * 0.47) +
    Math.sin((scaleX + scaleY) * 0.82 + step * 0.24 + strokeIndex * 0.13);
  return wobble * Math.PI + randomUnit(strokeIndex * 173 + step, 16) * Math.PI * 0.75;
}

function smoothChaosPoints(points, passes) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 1; index < points.length - 1; index += 1) {
      points[index].x = points[index - 1].x * 0.24 + points[index].x * 0.52 + points[index + 1].x * 0.24;
      points[index].y = points[index - 1].y * 0.24 + points[index].y * 0.52 + points[index + 1].y * 0.24;
    }
  }
}

function smoothFreeformPoints(points, passes) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 1; index < points.length - 1; index += 1) {
      points[index].x = points[index - 1].x * 0.18 + points[index].x * 0.64 + points[index + 1].x * 0.18;
      points[index].y = points[index - 1].y * 0.18 + points[index].y * 0.64 + points[index + 1].y * 0.18;
    }
  }
}

function isChaosLooping(sampleHistory, sampleX, sampleY) {
  for (let index = sampleHistory.length - 18; index >= 0; index -= 6) {
    const point = sampleHistory[index];
    const distance = Math.hypot(point.x - sampleX, point.y - sampleY);
    if (distance < 7.5) {
      return true;
    }
  }

  return false;
}

function buildOscilloscopeDensityMap(grayscale, structure, edges, settings) {
  const { detailThreshold, recognition, contourDetail } = settings;
  const rawDensity = new Float32Array(grayscale.length);
  const baseDensity = 0.015 + (1 - recognition) * 0.025;
  const brightGain = 0.86 + recognition * 0.52;
  const contrastGain = 0.2 + recognition * 0.28;
  const edgeGain = 0.04 + contourDetail * 0.12;

  for (let index = 0; index < grayscale.length; index += 1) {
    const sourceLuminance = grayscale[index] * 0.72 + structure[index] * 0.28;
    const luminance = settings.invert ? 1 - sourceLuminance : sourceLuminance;
    const brightSignal = Math.max(0, luminance - detailThreshold) / Math.max(0.0001, 1 - detailThreshold);
    const localContrast = Math.abs(grayscale[index] - structure[index]);
    rawDensity[index] =
      baseDensity +
      Math.pow(brightSignal, 1.05) * brightGain +
      localContrast * contrastGain +
      edges[index] * edgeGain;
  }

  const blurred = blurArray(rawDensity, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(2 + settings.smoothness * 3));

  for (let index = 0; index < blurred.length; index += 1) {
    blurred[index] = clamp(blurred[index], 0, 1);
  }

  return blurred;
}

function buildOscilloscopeSpacingMap(densityMap, settings) {
  const blurred = blurArray(densityMap, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(18 + settings.smoothness * 18));
  const spacing = new Float32Array(densityMap.length);

  for (let index = 0; index < densityMap.length; index += 1) {
    spacing[index] = smoothStep(0.12, 0.72, blurred[index]);
  }

  return spacing;
}

function buildOscilloscopeActivityMap(grayscale, structure, edges, settings) {
  const rawActivity = new Float32Array(grayscale.length);
  const detailGain = 1.1 + settings.recognition * 1.25;
  const edgeGain = 0.55 + settings.contourDetail * 0.85;

  for (let index = 0; index < grayscale.length; index += 1) {
    const localContrast = Math.abs(grayscale[index] - structure[index]);
    rawActivity[index] = clamp(localContrast * detailGain + edges[index] * edgeGain, 0, 1);
  }

  return blurArray(rawActivity, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(1 + settings.smoothness * 3));
}

function buildOscilloscopeDisplacementMap(grayscale, structure, edges, settings) {
  const rawDisplacement = new Float32Array(grayscale.length);

  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const index = y * SAMPLE_SIZE + x;
      const left = grayscale[y * SAMPLE_SIZE + clamp(x - 2, 0, SAMPLE_SIZE - 1)];
      const right = grayscale[y * SAMPLE_SIZE + clamp(x + 2, 0, SAMPLE_SIZE - 1)];
      const localForm = grayscale[index] - structure[index];
      const gradient = left - right;
      rawDisplacement[index] = localForm * (0.9 + settings.recognition * 0.65) + gradient * (0.8 + edges[index] * 0.9);
    }
  }

  return blurArray(rawDisplacement, SAMPLE_SIZE, SAMPLE_SIZE, Math.round(2 + settings.smoothness * 4));
}

function smoothHashNoise(x, y, channel) {
  let total = 0;
  let weight = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const currentWeight = dx === 0 && dy === 0 ? 4 : 1;
      total += hashNoise(x + dx * 1.7 + channel * 13, y + dy * 1.7 + channel * 29) * currentWeight;
      weight += currentWeight;
    }
  }

  return total / weight;
}

function hashNoise(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function canPlaceDot(grid, x, y, gridSize, minimumDistance) {
  const gridX = Math.floor(x / gridSize);
  const gridY = Math.floor(y / gridSize);
  const minimumDistanceSquared = minimumDistance * minimumDistance;

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const cellDots = grid.get(`${gridX + offsetX},${gridY + offsetY}`);
      if (!cellDots) {
        continue;
      }

      for (const dot of cellDots) {
        const dx = x - dot.x;
        const dy = y - dot.y;
        if (dx * dx + dy * dy < minimumDistanceSquared) {
          return false;
        }
      }
    }
  }

  return true;
}

function registerPlacedDot(grid, x, y, gridSize) {
  const gridX = Math.floor(x / gridSize);
  const gridY = Math.floor(y / gridSize);
  const key = `${gridX},${gridY}`;

  if (!grid.has(key)) {
    grid.set(key, []);
  }

  grid.get(key).push({ x, y });
}

function randomUnit(seed, channel) {
  const primary = hashNoise(seed * 0.754877666 + channel * 31.4159, seed * 0.569840296 + channel * 17.913);
  const secondary = hashNoise(seed * 0.381966011 + channel * 7.77, seed * 0.618033989 + channel * 19.19);
  return clamp(primary * 0.78 + secondary * 0.22, 0, 1);
}

function brightAttractionOffset(grayscale, sampleX, sampleY, cell, amount) {
  const left = grayscale[sampleY * SAMPLE_SIZE + clamp(sampleX - 2, 0, SAMPLE_SIZE - 1)];
  const right = grayscale[sampleY * SAMPLE_SIZE + clamp(sampleX + 2, 0, SAMPLE_SIZE - 1)];
  const top = grayscale[clamp(sampleY - 2, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + sampleX];
  const bottom = grayscale[clamp(sampleY + 2, 0, SAMPLE_SIZE - 1) * SAMPLE_SIZE + sampleX];

  return {
    x: clamp((right - left) * cell * amount, -cell * 0.38, cell * 0.38),
    y: clamp((bottom - top) * cell * amount, -cell * 0.38, cell * 0.38),
  };
}

function smoothRibbonCenters(points, passes) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 1; index < points.length - 1; index += 1) {
      points[index].x = (points[index - 1].x + points[index].x * 2 + points[index + 1].x) / 4;
    }
  }
}

function buildRibbonPolygon(centerPoints, widthSamples) {
  const left = [];
  const right = [];

  for (let index = 0; index < centerPoints.length; index += 1) {
    const previous = centerPoints[clamp(index - 1, 0, centerPoints.length - 1)];
    const next = centerPoints[clamp(index + 1, 0, centerPoints.length - 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const halfWidth = widthSamples[index] / 2;
    const point = centerPoints[index];

    left.push({
      x: point.x + normalX * halfWidth,
      y: point.y + normalY * halfWidth,
    });
    right.push({
      x: point.x - normalX * halfWidth,
      y: point.y - normalY * halfWidth,
    });
  }

  return [...left, ...right.reverse()];
}

function generateContourPaths(grayscale, edges, settings) {
  const { margin, contourDetail, recognition } = settings;
  const paths = [];
  const usableSize = PREVIEW_SIZE - margin * 2;
  const cellStep = contourDetail > 0.72 ? 3 : 4;
  const edgeThreshold = 0.2 - contourDetail * 0.1;
  const maxPaths = Math.round(500 + contourDetail * 2400);
  const thresholds = [0.28, 0.42, 0.56, 0.7];

  if (contourDetail <= 0.01 || recognition <= 0.01) {
    return paths;
  }

  for (const threshold of thresholds) {
    for (let y = 0; y < SAMPLE_SIZE - cellStep; y += cellStep) {
      for (let x = 0; x < SAMPLE_SIZE - cellStep; x += cellStep) {
        const topLeft = grayscale[y * SAMPLE_SIZE + x] > threshold ? 1 : 0;
        const topRight = grayscale[y * SAMPLE_SIZE + x + cellStep] > threshold ? 1 : 0;
        const bottomRight = grayscale[(y + cellStep) * SAMPLE_SIZE + x + cellStep] > threshold ? 1 : 0;
        const bottomLeft = grayscale[(y + cellStep) * SAMPLE_SIZE + x] > threshold ? 1 : 0;
        const caseIndex = topLeft * 8 + topRight * 4 + bottomRight * 2 + bottomLeft;

        if (caseIndex === 0 || caseIndex === 15) {
          continue;
        }

        const edgeAverage =
          (edges[y * SAMPLE_SIZE + x] +
            edges[y * SAMPLE_SIZE + x + cellStep] +
            edges[(y + cellStep) * SAMPLE_SIZE + x] +
            edges[(y + cellStep) * SAMPLE_SIZE + x + cellStep]) /
          4;

        if (edgeAverage < edgeThreshold) {
          continue;
        }

        const segments = marchingSegmentsForCase(caseIndex, x, y, cellStep);
        for (const segment of segments) {
          paths.push({
            kind: "contour",
            points: segment.map((point) => ({
              x: margin + (point.x / (SAMPLE_SIZE - 1)) * usableSize,
              y: margin + (point.y / (SAMPLE_SIZE - 1)) * usableSize,
            })),
            strokeWidth: settings.strokeWidth,
          });

          if (paths.length >= maxPaths) {
            return paths;
          }
        }
      }
    }
  }

  return paths;
}

function marchingSegmentsForCase(caseIndex, x, y, step) {
  const top = { x: x + step / 2, y };
  const right = { x: x + step, y: y + step / 2 };
  const bottom = { x: x + step / 2, y: y + step };
  const left = { x, y: y + step / 2 };
  const cases = {
    1: [[left, bottom]],
    2: [[bottom, right]],
    3: [[left, right]],
    4: [[top, right]],
    5: [
      [top, left],
      [bottom, right],
    ],
    6: [[top, bottom]],
    7: [[top, left]],
    8: [[top, left]],
    9: [[top, bottom]],
    10: [
      [top, right],
      [left, bottom],
    ],
    11: [[top, right]],
    12: [[left, right]],
    13: [[bottom, right]],
    14: [[left, bottom]],
  };

  return cases[caseIndex] || [];
}

function smoothPoints(points, passes) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 1; index < points.length - 1; index += 1) {
      points[index].y = (points[index - 1].y + points[index].y * 2 + points[index + 1].y) / 4;
    }
  }
}

function buildSvgMarkup(linePaths, settings, size, options = {}) {
  const pathMarkup = linePaths
    .map((path) => {
      const scale = size / PREVIEW_SIZE;
      const previewUnknownOverscan =
        options.previewEffect === "unknownPleasures" && (path.kind === "scanline" || path.kind === "occlusion")
          ? Math.max(4, (path.strokeWidth || settings.strokeWidth || 1) * 3)
          : 0;
      const previewAdjustedPoints =
        previewUnknownOverscan > 0 && path.points?.length > 1
          ? path.points.map((point, index, points) => {
              if (index === 0) {
                return { ...point, x: -previewUnknownOverscan };
              }
              if (index === points.length - 1) {
                return { ...point, x: size + previewUnknownOverscan };
              }
              return point;
            })
          : path.points;
      const previewUnknownLineCap =
        options.previewEffect === "unknownPleasures" && path.kind === "scanline" && !path.lineCap ? "butt" : null;
      if (path.kind === "dot") {
        return `<circle cx="${(path.x * scale).toFixed(2)}" cy="${(path.y * scale).toFixed(2)}" r="${(path.r * scale).toFixed(3)}" fill="#ffffff" stroke="none" />`;
      }

      if (path.kind === "occlusion") {
        return `<path d="${buildSvgOcclusionPath(previewAdjustedPoints)}" fill="${path.fillColor || "#000000"}" stroke="none" />`;
      }

      const width = (path.strokeWidth || settings.strokeWidth) * (size / PREVIEW_SIZE);
      if (path.fill) {
        return `<path d="${buildSvgPath(previewAdjustedPoints, true)}" fill="#ffffff" stroke="none" />`;
      }

      if (path.subpaths) {
        const resolvedLineCap = previewUnknownLineCap || path.lineCap;
        const lineCapAttr = resolvedLineCap ? ` stroke-linecap="${resolvedLineCap}"` : "";
        return `<path d="${buildSvgSubpathMarkup(path.subpaths)}" stroke-width="${width.toFixed(3)}"${lineCapAttr} />`;
      }

      if (path.curve === "linear") {
        const resolvedLineCap = previewUnknownLineCap || path.lineCap;
        const lineCapAttr = resolvedLineCap ? ` stroke-linecap="${resolvedLineCap}"` : "";
        return `<path d="${buildSvgLinearPath(previewAdjustedPoints)}" stroke-width="${width.toFixed(3)}"${lineCapAttr} />`;
      }

      const resolvedLineCap = previewUnknownLineCap || path.lineCap;
      const lineCapAttr = resolvedLineCap ? ` stroke-linecap="${resolvedLineCap}"` : "";
      return `<path d="${buildSvgPath(previewAdjustedPoints)}" stroke-width="${width.toFixed(3)}"${lineCapAttr} />`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Generated artwork">
      <rect width="${size}" height="${size}" fill="#000000"></rect>
      <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
        ${pathMarkup}
      </g>
    </svg>
  `;
}

function buildSvgPath(points, closed = false) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpointX = (current.x + next.x) / 2;
    const midpointY = (current.y + next.y) / 2;
    path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`;
  }

  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  if (closed) {
    path += " Z";
  }
  return path;
}

function buildSvgLinearPath(points) {
  if (!points || points.length === 0) {
    return "";
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` L ${points[index].x.toFixed(2)} ${points[index].y.toFixed(2)}`;
  }
  return path;
}

function buildSvgOcclusionPath(points) {
  if (!points || points.length < 2) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${buildSvgPath(points)} L ${last.x.toFixed(2)} ${(PREVIEW_SIZE + 2).toFixed(2)} L ${first.x.toFixed(2)} ${(PREVIEW_SIZE + 2).toFixed(2)} Z`;
}

function buildSvgSubpathMarkup(subpaths) {
  return subpaths
    .filter((points) => points.length >= 2)
    .map((points) => buildSvgPath(points))
    .join(" ");
}

function renderEmptyPreview() {
  elements.previewStage.classList.add("empty");
  delete elements.previewStage.dataset.effect;
  elements.previewStage.innerHTML = "";
}

function onPrintRequested() {
  if (elements.formatToggle.checked) {
    downloadSvg();
    return;
  }

  downloadPng();
}

function downloadSvg() {
  if (!state.svgMarkup) {
    return;
  }

  const blob = new Blob([state.svgMarkup.trim()], { type: "image/svg+xml;charset=utf-8" });
  incrementDownloadCounter();
  triggerDownload(blob, "oscilloscope-artwork.svg");
}

function downloadPng() {
  if (!state.linePaths.length) {
    return;
  }

  renderPngToExportCanvas();
  elements.exportCanvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    incrementDownloadCounter();
    triggerDownload(blob, "oscilloscope-artwork.png");
  }, "image/png");
}

function renderPngToExportCanvas() {
  exportContext.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
  exportContext.fillStyle = "#000";
  exportContext.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

  const scale = EXPORT_SIZE / PREVIEW_SIZE;
  exportContext.strokeStyle = "#fff";
  exportContext.lineWidth = state.settings.strokeWidth * scale;
  exportContext.lineCap = "round";
  exportContext.lineJoin = "round";

  for (const path of state.linePaths) {
    if (path.kind === "dot") {
      exportContext.save();
      exportContext.beginPath();
      exportContext.fillStyle = "#fff";
      exportContext.arc(path.x * scale, path.y * scale, path.r * scale, 0, Math.PI * 2);
      exportContext.fill();
      exportContext.restore();
      continue;
    }

    if (path.kind === "occlusion") {
      exportContext.save();
      exportContext.beginPath();
      drawPointPathToCanvas(exportContext, path.points, scale);
      const first = path.points[0];
      const last = path.points[path.points.length - 1];
      exportContext.lineTo(last.x * scale, (PREVIEW_SIZE + 2) * scale);
      exportContext.lineTo(first.x * scale, (PREVIEW_SIZE + 2) * scale);
      exportContext.closePath();
      exportContext.fillStyle = path.fillColor || "#000";
      exportContext.fill();
      exportContext.restore();
      continue;
    }

    if (path.subpaths) {
      exportContext.save();
      exportContext.beginPath();
      exportContext.lineCap = path.lineCap || "round";

      for (const points of path.subpaths) {
        drawPointPathToCanvas(exportContext, points, scale);
      }

      exportContext.lineWidth = (path.strokeWidth || state.settings.strokeWidth) * scale;
      exportContext.stroke();
      exportContext.restore();
      continue;
    }

    const points = path.points;
    if (!points || points.length < 2) {
      continue;
    }

    exportContext.save();
    exportContext.beginPath();
    exportContext.lineCap = path.lineCap || "round";
    if (path.curve === "linear") {
      drawLinearPointPathToCanvas(exportContext, points, scale);
    } else {
      drawPointPathToCanvas(exportContext, points, scale);
    }
    if (path.fill) {
      exportContext.closePath();
      exportContext.fillStyle = "#fff";
      exportContext.fill();
    } else {
      exportContext.lineWidth = (path.strokeWidth || state.settings.strokeWidth) * scale;
      exportContext.stroke();
    }
    exportContext.restore();
  }
}

function drawPointPathToCanvas(context, points, scale) {
  if (!points || points.length < 2) {
    return;
  }

  context.moveTo(points[0].x * scale, points[0].y * scale);

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpointX = (current.x + next.x) / 2;
    const midpointY = (current.y + next.y) / 2;
    context.quadraticCurveTo(current.x * scale, current.y * scale, midpointX * scale, midpointY * scale);
  }

  const last = points[points.length - 1];
  context.lineTo(last.x * scale, last.y * scale);
}

function drawLinearPointPathToCanvas(context, points, scale) {
  if (!points || points.length < 2) {
    return;
  }

  context.moveTo(points[0].x * scale, points[0].y * scale);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x * scale, points[index].y * scale);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadDownloadCounter() {
  try {
    const storedValue = Number(window.localStorage.getItem(DOWNLOAD_COUNTER_KEY));
    state.downloadCount = Number.isFinite(storedValue) && storedValue > 0 ? storedValue : 0;
  } catch (error) {
    state.downloadCount = 0;
  }

  updateDownloadCounter();

  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (!payload || !Number.isFinite(payload.count)) {
      return;
    }

    state.downloadCount = Math.max(0, Number(payload.count));
    persistDownloadCounter();
    updateDownloadCounter();
  } catch (error) {
    // Fall back to the locally cached count when the shared counter is unavailable.
  }
}

async function incrementDownloadCounter() {
  state.downloadCount += 1;
  persistDownloadCounter();
  updateDownloadCounter();

  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (!payload || !Number.isFinite(payload.count)) {
      return;
    }

    state.downloadCount = Math.max(0, Number(payload.count));
    persistDownloadCounter();
    updateDownloadCounter();
  } catch (error) {
    // Ignore network failures; the local fallback count is already shown.
  }
}

function persistDownloadCounter() {
  try {
    window.localStorage.setItem(DOWNLOAD_COUNTER_KEY, String(state.downloadCount));
  } catch (error) {
    // Ignore storage failures; the counter can still use in-memory state.
  }
}

function updateDownloadCounter() {
  if (!elements.downloadCounter) {
    return;
  }

  elements.downloadCounter.textContent = String(state.downloadCount).padStart(6, "0");
}

function resetAll() {
  const effectMode = state.settings.effectMode || DEFAULT_SETTINGS.effectMode;
  state.settings = getEffectSettings(effectMode);
  updateSettingsUi();

  if (state.image) {
    initializeCropFromImage(state.image);
    requestRender("Reset complete. You can fine-tune the image again.");
    return;
  }

  renderEmptyPreview();
  drawCropCanvas();
  setStatus("Upload an image to begin.");
}

function randomizeSettings() {
  for (const input of elements.settingInputs) {
    const { setting } = input.dataset;

    if (!setting || setting === "effectMode") {
      continue;
    }

    if (input.type === "checkbox") {
      state.settings[setting] = Math.random() >= 0.5;
      continue;
    }

    if (input.type === "range") {
      const min = Number(input.min);
      const max = Number(input.max);
      const step = Number(input.step) || 1;
      const randomValue = min + Math.random() * (max - min);
      const steppedValue = min + Math.round((randomValue - min) / step) * step;
      state.settings[setting] = normalizeRandomValue(clamp(steppedValue, min, max), step);
    }
  }

  updateSettingsUi();
  requestRender("Randomized parameters.");
}

function normalizeRandomValue(value, step) {
  if (step >= 1) {
    return Math.round(value);
  }

  const decimals = Math.min(6, Math.max(0, String(step).split(".")[1]?.length || 0));
  return Number(value.toFixed(decimals));
}

function getEffectSettings(effectMode) {
  const safeEffectMode = EFFECT_DEFAULTS[effectMode] ? effectMode : DEFAULT_SETTINGS.effectMode;
  return {
    effectMode: safeEffectMode,
    ...EFFECT_DEFAULTS[safeEffectMode],
  };
}

function updateSettingsUi() {
  for (const input of elements.settingInputs) {
    const { setting } = input.dataset;
    const output = document.querySelector(`#${setting}Value`);
    const value = state.settings[setting];

    if (input.type === "checkbox") {
      input.checked = Boolean(value);
      syncToggleVisual(input);
      continue;
    }

    if (input.tagName === "SELECT") {
      input.value = String(value);
      syncEffectButtons(input.value);
      continue;
    }

    input.value = String(value);
    syncRangeVisual(input);
    if (output) {
      output.textContent = String(value);
    }
  }

  syncToggleVisual(elements.formatToggle);
  requestAnimationFrame(updatePatchCable);
}

function readInputValue(input) {
  if (input.type === "checkbox") {
    return input.checked;
  }

  if (input.tagName === "SELECT") {
    return input.value;
  }

  return Number(input.value);
}

function updateZoomUi() {
  if (!state.image) {
    elements.zoomControl.value = "100";
    elements.zoomControl.disabled = true;
    elements.zoomValue.textContent = "100%";
    syncRangeVisual(elements.zoomControl);
    return;
  }

  const zoomPercentage = Math.round(scaleToSliderValue(state.crop.scale));
  elements.zoomControl.disabled = false;
  elements.zoomControl.value = String(zoomPercentage);
  elements.zoomValue.textContent = `${zoomPercentage}%`;
  syncRangeVisual(elements.zoomControl);
}

function syncEffectButtons(effectMode) {
  for (const button of elements.effectButtons) {
    button.classList.toggle("is-active", button.dataset.effectOption === effectMode);
  }

  updatePatchCable();
}

function syncRangeVisual(input) {
  if (!input || !input.id) {
    return;
  }

  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const ratio = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
  const knob = document.querySelector(`[data-knob-for="${input.id}"]`);
  const setting = input.closest(".setting");
  const knobFace = knob?.querySelector(".knob-face-art");
  const knobAngle = -138 + ratio * 276;

  if (setting) {
    setting.style.setProperty("--ratio", String(ratio));
    setting.classList.toggle("is-disabled", input.disabled);
  }

  if (knob) {
    knob.setAttribute("aria-valuemin", input.min);
    knob.setAttribute("aria-valuemax", input.max);
    knob.setAttribute("aria-valuenow", input.value);
    knob.setAttribute("role", "slider");
    knob.tabIndex = input.disabled ? -1 : 0;
    knob.disabled = input.disabled;
  }

  if (knobFace) {
    knobFace.style.setProperty("--knob-angle", `${knobAngle}deg`);
  }
}

function sliderValueToScale(sliderValue) {
  const ratio = (sliderValue - 100) / 400;
  return state.crop.minScale + ratio * (state.crop.maxScale - state.crop.minScale);
}

function scaleToSliderValue(scale) {
  const ratio = (scale - state.crop.minScale) / Math.max(0.0001, state.crop.maxScale - state.crop.minScale);
  return 100 + ratio * 400;
}

function setButtonsEnabled(enabled) {
  elements.printButton.disabled = false;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function syncToggleVisual(input) {
  if (!input) {
    return;
  }

  const button = document.querySelector(`[data-toggle-for="${input.id}"]`);
  const image = button?.querySelector(".toggle-image");

  if (!button || !image) {
    return;
  }

  image.src = input.checked ? "./assets/ui/toggle-down.svg" : "./assets/ui/toggle-up.svg";
}

function updateInputPlaceholder() {
  if (!elements.inputPlaceholder) {
    return;
  }

  elements.inputPlaceholder.classList.toggle("is-hidden", Boolean(state.image));
}

function updatePatchCable() {
  if (!elements.deviceFrame || !elements.effectCable || !elements.effectSourceJack || elements.effectButtons.length === 0) {
    return;
  }

  const activeButton =
    elements.effectButtons.find((button) => button.classList.contains("is-active")) || elements.effectButtons[0];
  const targetJack = activeButton?.querySelector(".effect-jack");

  if (!targetJack) {
    elements.effectCable.setAttribute("d", "");
    return;
  }

  const frameRect = elements.deviceFrame.getBoundingClientRect();
  const sourceRect = elements.effectSourceJack.getBoundingClientRect();
  const targetRect = targetJack.getBoundingClientRect();

  const sourceX = ((sourceRect.left + sourceRect.width / 2 - frameRect.left) / frameRect.width) * 800;
  const sourceY = ((sourceRect.top + sourceRect.height / 2 - frameRect.top) / frameRect.height) * 800;
  const targetX = ((targetRect.left + targetRect.width / 2 - frameRect.left) / frameRect.width) * 800;
  const targetY = ((targetRect.top + targetRect.height / 2 - frameRect.top) / frameRect.height) * 800;
  const spreadX = Math.abs(targetX - sourceX);
  const lift = 170 + spreadX * 0.16;
  const sweep = Math.max(132, spreadX * 1.05);
  const controlX1 = sourceX + 10;
  const controlY1 = sourceY - lift;
  const controlX2 = targetX - sweep;
  const controlY2 = targetY + Math.min(126, lift * 0.74);

  const d = [
    `M ${sourceX.toFixed(2)} ${sourceY.toFixed(2)}`,
    `C ${controlX1.toFixed(2)} ${controlY1.toFixed(2)}`,
    `${controlX2.toFixed(2)} ${controlY2.toFixed(2)}`,
    `${targetX.toFixed(2)} ${targetY.toFixed(2)}`,
  ].join(" ");

  elements.effectCable.setAttribute("d", d);
}

function syncGridAlignment() {
  if (!elements.deviceFrame) {
    return;
  }

  const frameRect = elements.deviceFrame.getBoundingClientRect();
  const snappedLeft = Math.round(frameRect.left);
  const snappedTop = Math.round(frameRect.top);
  const deltaX = snappedLeft - frameRect.left;
  const deltaY = snappedTop - frameRect.top;

  elements.deviceFrame.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  document.documentElement.style.setProperty("--grid-offset-x", `${snappedLeft}px`);
  document.documentElement.style.setProperty("--grid-offset-y", `${snappedTop}px`);
}

function getCanvasPoint(event) {
  const rect = elements.cropCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * CROP_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * CROP_SIZE,
  };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function smoothStep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

setup();

import { round } from "../core/math.js";

const CHART_PADDING = { left: 58, right: 22, top: 24, bottom: 42 };

export function drawChart(elements, state) {
  const canvas = elements.canvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth * ratio;
  const height = canvas.clientHeight * ratio;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#fcfdff";
  ctx.fillRect(0, 0, w, h);

  if (!state.wavelengths.length) {
    ctx.fillStyle = "#657188";
    ctx.font = "14px system-ui";
    ctx.fillText("Загрузите или вставьте массивы данных", CHART_PADDING.left, CHART_PADDING.top + 24);
    return;
  }

  const scale = createChartScale({
    width: w,
    height: h,
    wavelengths: state.wavelengths,
    intensities: state.intensities,
  });

  drawGrid(ctx, scale);

  ctx.lineWidth = 2;
  const gradient = ctx.createLinearGradient(scale.padding.left, 0, scale.padding.left + scale.plotW, 0);
  gradient.addColorStop(0, "#005aaa");
  gradient.addColorStop(0.75, "#ab3a8d");
  gradient.addColorStop(1, "#e72b70");
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  state.wavelengths.forEach((x, index) => {
    const px = scale.scaleX(x);
    const py = scale.scaleY(state.intensities[index]);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  if (Number.isFinite(state.threshold)) {
    const y = scale.scaleY(state.threshold);
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = "rgba(200, 58, 97, 0.55)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(scale.padding.left, y);
    ctx.lineTo(scale.padding.left + scale.plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  state.peaks.forEach((peak) => {
    const px = scale.scaleX(peak.wavelength);
    const py = scale.scaleY(peak.intensity);
    ctx.fillStyle = peak.match ? "#ab3a8d" : "#b36b00";
    ctx.beginPath();
    ctx.arc(px, py, peak === state.hoverPeak ? 5 : 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (peak.match) {
      ctx.fillStyle = "#141d2f";
      ctx.font = "700 10px system-ui";
      ctx.fillText(peak.match.symbol, px + 6, py - 7);
    }
  });
}

export function updateHover(elements, state) {
  return (event) => {
    if (!state.peaks.length) return;
    const rect = elements.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scale = createChartScale({
      width: rect.width,
      height: rect.height,
      wavelengths: state.wavelengths,
      intensities: state.intensities,
    });
    const nearest = state.peaks
      .map((peak) => ({
        peak,
        distance: Math.hypot(scale.scaleX(peak.wavelength) - x, scale.scaleY(peak.intensity) - y),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearest || nearest.distance > 22) {
      state.hoverPeak = null;
      elements.tooltip.hidden = true;
      drawChart(elements, state);
      return;
    }

    state.hoverPeak = nearest.peak;
    elements.tooltip.hidden = false;
    elements.tooltip.style.left = `${Math.min(x + 14, rect.width - 250)}px`;
    elements.tooltip.style.top = `${Math.max(10, y - 16)}px`;
    const match = nearest.peak.match;
    elements.tooltip.innerHTML = `
      <strong>${round(nearest.peak.wavelength, 3)} нм</strong><br>
      Интенсивность: ${round(nearest.peak.intensity, 3)}<br>
      ${match ? `${match.symbol} · ${match.name}<br>Линия: ${round(match.line, 3)} нм · Δ ${round(match.delta, 3)} нм` : "Совпадений нет"}
    `;
    drawChart(elements, state);
  };
}

export function createChartScale({ width, height, wavelengths, intensities }) {
  const padding = CHART_PADDING;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const xMin = Math.min(...wavelengths);
  const xMax = Math.max(...wavelengths);
  const yMin = Math.min(...intensities);
  const yMax = Math.max(...intensities);
  const yPad = (yMax - yMin || 1) * 0.08;
  const scaleX = (value) => padding.left + ((value - xMin) / (xMax - xMin || 1)) * plotW;
  const scaleY = (value) => padding.top + plotH - ((value - yMin + yPad) / (yMax - yMin + yPad * 2 || 1)) * plotH;

  return { padding, plotW, plotH, xMin, xMax, yMin, yMax, scaleX, scaleY };
}

function drawGrid(ctx, { padding, plotW, plotH, xMin, xMax, yMin, yMax }) {
  ctx.strokeStyle = "#edf2f8";
  ctx.lineWidth = 0.8;
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#657188";

  for (let i = 0; i <= 5; i += 1) {
    const x = padding.left + (plotW * i) / 5;
    const value = xMin + ((xMax - xMin) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();
    ctx.fillText(round(value, 1), x - 16, padding.top + plotH + 24);
  }

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotH * i) / 4;
    const value = yMax - ((yMax - yMin) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
    ctx.fillText(round(value, 1), 12, y + 4);
  }

  ctx.strokeStyle = "#d7e2ee";
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.stroke();
}

import { formatAnswer } from "./scoring.js";

const resizeObservers = new WeakMap();
const EPS = 1e-9;

function css(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function palette() {
  return {
    panel: css("--panel", "#12172a"),
    panel2: css("--panel2", "#181e34"),
    line: css("--line", "rgba(173,185,230,.13)"),
    line2: css("--line2", "rgba(173,185,230,.22)"),
    text: css("--text", "#f8f9ff"),
    muted: css("--muted", "#919ab7"),
    primary: css("--primary", "#7c5cff"),
    accent: css("--accent", "#35e7d0"),
    danger: css("--danger", "#ff627e"),
    yellow: css("--yellow", "#ffd44d")
  };
}

function setupCanvas(canvas, minWidth = 280, minHeight = 220) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const width = Math.max(minWidth, Math.round(canvas.clientWidth || 700));
  const height = Math.max(minHeight, Math.round(canvas.clientHeight || minHeight));
  const pxW = Math.round(width * dpr), pxH = Math.round(height * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW; canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  return { ctx, width, height, dpr };
}

function observe(canvas, render) {
  if (!canvas || typeof ResizeObserver === "undefined") return;
  resizeObservers.get(canvas)?.disconnect?.();
  let raf = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  });
  observer.observe(canvas);
  resizeObservers.set(canvas, observer);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos), rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function axisNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e11 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K`;
  if (abs > 0 && abs < .001) return n.toExponential(1).replace("e+", "e");
  if (abs < 10 && !Number.isInteger(n)) return Number(n.toPrecision(3)).toString();
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function roundedRect(ctx, x, y, w, h, r = 8) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrid(ctx, left, right, top, bottom, color, rows = 4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i++) {
    const y = top + ((bottom - top) * i / rows);
    ctx.globalAlpha = i === rows ? .9 : .55;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
  ctx.restore();
}

function chipWidth(ctx, label, value) {
  ctx.font = "800 10px system-ui";
  const a = ctx.measureText(label).width;
  ctx.font = "800 11px system-ui";
  const b = ctx.measureText(value).width;
  return Math.max(58, Math.ceil(Math.max(a, b) + 20));
}

function drawMarkerChip(ctx, { x, y, label, value, color, plotTop, plotBottom, width }) {
  const p = palette();
  const valueText = String(value ?? "");
  const w = chipWidth(ctx, label, valueText), h = 34;
  const bx = clamp(x - w / 2, 5, width - w - 5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, plotBottom); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(8,12,24,.94)";
  roundedRect(ctx, bx, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.font = "900 8px system-ui"; ctx.textAlign = "center";
  ctx.fillText(label, bx + w / 2, y + 12);
  ctx.fillStyle = p.text; ctx.font = "800 10px system-ui";
  ctx.fillText(valueText, bx + w / 2, y + 25);
  ctx.restore();
}

function markerRows(markers, ctx, width) {
  const sorted = [...markers].sort((a, b) => a.x - b.x);
  let lastEndByRow = [-Infinity, -Infinity, -Infinity];
  for (const marker of sorted) {
    const w = chipWidth(ctx, marker.label, marker.value);
    const start = clamp(marker.x - w / 2, 5, width - w - 5);
    let row = 0;
    while (row < lastEndByRow.length - 1 && start < lastEndByRow[row] + 8) row++;
    marker.row = row;
    lastEndByRow[row] = start + w;
  }
  return sorted;
}

function drawAxis(ctx, { left, right, y, values, p, footer = "" }) {
  ctx.save();
  ctx.font = "700 10px system-ui";
  values.forEach(({ x, label }, i) => {
    ctx.fillStyle = p.muted;
    ctx.textAlign = i === 0 ? "left" : i === values.length - 1 ? "right" : "center";
    ctx.fillText(label, x, y);
  });
  if (footer) {
    ctx.fillStyle = p.muted;
    ctx.globalAlpha = .78;
    ctx.font = "700 9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(footer, (left + right) / 2, y + 18);
  }
  ctx.restore();
}

function chooseProjectedDomain(values, important = [], minSpan = 1) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [-.5, .5];
  let lo = sorted.length > 20 ? quantile(sorted, .02) : sorted[0];
  let hi = sorted.length > 20 ? quantile(sorted, .98) : sorted[sorted.length - 1];
  for (const v of important.filter(Number.isFinite)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  let span = Math.max(EPS, hi - lo);
  if (span < minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpan / 2; hi = mid + minSpan / 2; span = minSpan;
  }
  const pad = span * .08;
  return [lo - pad, hi + pad];
}

export function renderGuessHistogram(canvas, guesses = [], answer = null, myGuess = null) {
  if (!canvas) return;
  const render = () => {
    const { ctx, width, height } = setupCanvas(canvas, 280, 240);
    const p = palette();
    const guessValues = guesses.map(Number).filter(Number.isFinite);
    const a = Number(answer), me = Number(myGuess);
    const all = [...guessValues, ...(Number.isFinite(a) ? [a] : []), ...(Number.isFinite(me) ? [me] : [])];
    if (!all.length) return;

    const positive = all.every(v => v > 0);
    const useLog = positive && Math.max(...all) / Math.max(EPS, Math.min(...all)) > 3;
    const project = useLog ? v => Math.log10(v) : v => v;
    const invert = useLog ? v => 10 ** v : v => v;
    const projectedGuesses = guessValues.map(project);
    const important = [a, me].filter(Number.isFinite).map(project);
    const minSpan = useLog ? .8 : Math.max(1, Math.abs(a || 1) * .2);
    const [lo, hi] = chooseProjectedDomain(projectedGuesses.length ? projectedGuesses : important, important, minSpan);

    const markerCount = [a, me].filter(Number.isFinite).length;
    const top = markerCount ? 78 : 22, bottom = height - 48, left = 28, right = width - 18;
    drawGrid(ctx, left, right, top, bottom, p.line, 4);

    const bins = width < 480 ? 12 : 18;
    const counts = new Array(bins).fill(0);
    projectedGuesses.forEach(v => {
      const i = clamp(Math.floor(((v - lo) / (hi - lo)) * bins), 0, bins - 1);
      counts[i]++;
    });
    const maxCount = Math.max(1, ...counts);
    const bw = (right - left) / bins;
    counts.forEach((count, i) => {
      const h = (count / maxCount) * Math.max(1, bottom - top - 8);
      const gradient = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      gradient.addColorStop(0, p.primary); gradient.addColorStop(1, "rgba(124,92,255,.22)");
      ctx.fillStyle = gradient;
      roundedRect(ctx, left + i * bw + 1.5, bottom - h, Math.max(1, bw - 3), h, 3); ctx.fill();
    });

    const toX = v => left + clamp((project(v) - lo) / (hi - lo), 0, 1) * (right - left);
    const markers = [];
    if (Number.isFinite(a)) markers.push({ x: toX(a), label: "ANSWER", value: axisNumber(a), color: p.accent });
    if (Number.isFinite(me)) markers.push({ x: toX(me), label: "YOU", value: axisNumber(me), color: p.danger });
    markerRows(markers, ctx, width).forEach(m => drawMarkerChip(ctx, { ...m, y: 6 + m.row * 36, plotTop: top, plotBottom: bottom, width }));

    const tickCount = width < 480 ? 3 : 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const t = i / (tickCount - 1); return { x: left + t * (right - left), label: axisNumber(invert(lo + t * (hi - lo))) };
    });
    drawAxis(ctx, { left, right, y: height - 27, values: ticks, p, footer: useLog ? "logarithmic scale" : "guess scale" });
  };
  render(); observe(canvas, render);
}

export function closenessText(answer, guess) {
  const a = Number(answer), g = Number(guess);
  if (!Number.isFinite(a) || !Number.isFinite(g)) return "";
  if (a === g) return "Exactly right";
  if (a > 0 && g > 0) {
    const factor = g / a;
    if (factor > 1) return `${factor.toFixed(factor >= 10 ? 1 : 2)}× too high`;
    const inverse = a / g;
    return `${inverse.toFixed(inverse >= 10 ? 1 : 2)}× too low`;
  }
  const delta = g - a;
  return `${formatAnswer(Math.abs(delta))} ${delta > 0 ? "high" : "low"}`;
}

export function renderClosenessScale(canvas, answer, myGuess) {
  if (!canvas) return;
  const render = () => {
    const a = Number(answer), g = Number(myGuess);
    if (!Number.isFinite(a) || !Number.isFinite(g)) return;
    const { ctx, width, height } = setupCanvas(canvas, 280, 190);
    const p = palette();
    const left = 28, right = width - 22, axisY = Math.round(height * .57);
    let lo, hi, project, invert;
    if (a > 0 && g > 0) {
      const rel = Math.log10(g / a);
      const extent = clamp(Math.max(.6, Math.abs(rel) * 1.35 + .2), .6, 4);
      lo = -extent; hi = extent;
      project = value => Math.log10(value / a);
      invert = value => a * (10 ** value);
    } else {
      const span = Math.max(1, Math.abs(g - a), Math.abs(a) * .25);
      lo = Math.min(a, g) - span * .35; hi = Math.max(a, g) + span * .35;
      project = value => value; invert = value => value;
    }
    const xFor = value => left + clamp((project(value) - lo) / (hi - lo), 0, 1) * (right - left);
    const answerX = xFor(a), guessX = xFor(g);

    ctx.strokeStyle = p.line2; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(left, axisY); ctx.lineTo(right, axisY); ctx.stroke();
    const grad = ctx.createLinearGradient(Math.min(answerX, guessX), 0, Math.max(answerX, guessX), 0);
    grad.addColorStop(0, p.accent); grad.addColorStop(1, p.primary);
    ctx.strokeStyle = grad; ctx.lineWidth = 7; ctx.globalAlpha = .48;
    ctx.beginPath(); ctx.moveTo(answerX, axisY); ctx.lineTo(guessX, axisY); ctx.stroke(); ctx.globalAlpha = 1;

    const markers = [
      { x: answerX, label: "ANSWER", value: axisNumber(a), color: p.accent },
      { x: guessX, label: "YOU", value: axisNumber(g), color: p.primary }
    ];
    markerRows(markers, ctx, width).forEach(m => drawMarkerChip(ctx, { ...m, y: 5 + m.row * 36, plotTop: 72, plotBottom: axisY, width }));

    const ticks = [0, .5, 1].map(t => ({ x: left + t * (right - left), label: axisNumber(invert(lo + t * (hi - lo))) }));
    drawAxis(ctx, { left, right, y: height - 28, values: ticks, p, footer: closenessText(a, g) });
  };
  render(); observe(canvas, render);
}

export function renderCommunityHistogram(canvas, stats, answer, myGuess, excludeSelf = false) {
  if (!canvas) return;
  const render = () => {
    const sourceHist = Array.isArray(stats?.histogram) ? stats.histogram : [];
    const hist = sourceHist.map(v => Math.max(0, Number(v) || 0));
    const bins = hist.length || 41;
    if (!hist.length) hist.push(...new Array(41).fill(0));
    let total = Number(stats?.total_answers || hist.reduce((a, b) => a + b, 0));
    const a = Number(answer), g = Number(myGuess);
    const bmin = Number(stats?.bucket_min ?? -4), bmax = Number(stats?.bucket_max ?? 4), bstep = Number(stats?.bucket_step ?? ((bmax - bmin) / Math.max(1, bins - 1)));
    const relative = (guess) => {
      if (!Number.isFinite(a) || !Number.isFinite(guess)) return 0;
      if (a > 0 && guess > 0) return Math.log10(guess / a);
      return (guess - a) / Math.max(1, Math.abs(a));
    };
    const userRel = clamp(relative(g), bmin, bmax);

    if (excludeSelf && total > 0 && Number.isFinite(g)) {
      const idx = clamp(Math.round((userRel - bmin) / bstep), 0, hist.length - 1);
      if (hist[idx] > 0) { hist[idx]--; total--; }
    }

    const occupied = [];
    hist.forEach((count, i) => { if (count > 0) occupied.push(bmin + i * bstep); });
    let viewLo = Math.min(0, Number.isFinite(g) ? userRel : 0, ...(occupied.length ? occupied : [0]));
    let viewHi = Math.max(0, Number.isFinite(g) ? userRel : 0, ...(occupied.length ? occupied : [0]));
    // Keep at least one decade either side of the true answer for positive Fermi questions,
    // but do not force the full ±4-decade storage range when the data is tightly clustered.
    const minimumHalf = (a > 0) ? 1 : .75;
    viewLo = Math.min(viewLo - bstep * 1.5, -minimumHalf);
    viewHi = Math.max(viewHi + bstep * 1.5, minimumHalf);
    viewLo = clamp(viewLo, bmin, bmax); viewHi = clamp(viewHi, bmin, bmax);
    if (viewHi - viewLo < EPS) { viewLo -= .5; viewHi += .5; }

    const { ctx, width, height } = setupCanvas(canvas, 280, 245);
    const p = palette();
    const top = 80, bottom = height - 52, left = 28, right = width - 18;
    drawGrid(ctx, left, right, top, bottom, p.line, 4);

    const visible = hist.map((count, i) => ({ count, rel: bmin + i * bstep })).filter(x => x.rel >= viewLo - bstep && x.rel <= viewHi + bstep);
    const maxCount = Math.max(1, ...visible.map(x => x.count));
    const xForRel = rel => left + clamp((rel - viewLo) / (viewHi - viewLo), 0, 1) * (right - left);
    const pxPerStep = (right - left) * bstep / (viewHi - viewLo);
    visible.forEach(({ count, rel }) => {
      if (!count) return;
      const h = (count / maxCount) * Math.max(1, bottom - top - 7);
      const x = xForRel(rel);
      const w = Math.max(3, pxPerStep * .74);
      const gradient = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      gradient.addColorStop(0, p.primary); gradient.addColorStop(1, "rgba(124,92,255,.18)");
      ctx.fillStyle = gradient;
      roundedRect(ctx, x - w / 2, bottom - h, w, h, Math.min(4, w / 2)); ctx.fill();
    });

    const markers = [];
    if (Number.isFinite(a)) markers.push({ x: xForRel(0), label: "ANSWER", value: axisNumber(a), color: p.accent });
    if (Number.isFinite(g)) markers.push({ x: xForRel(userRel), label: "YOU", value: axisNumber(g), color: p.danger });
    markerRows(markers, ctx, width).forEach(m => drawMarkerChip(ctx, { ...m, y: 6 + m.row * 36, plotTop: top, plotBottom: bottom, width }));

    const tickRels = width < 480 ? [viewLo, 0, viewHi] : [viewLo, viewLo + (viewHi - viewLo) * .25, 0, viewLo + (viewHi - viewLo) * .75, viewHi];
    const unique = [...new Set(tickRels.map(v => Number(v.toFixed(6))))].sort((x, y) => x - y);
    const ticks = unique.map(rel => ({
      x: xForRel(rel),
      label: Number.isFinite(a) && a > 0 ? axisNumber(a * (10 ** rel)) : axisNumber(a + rel * Math.max(1, Math.abs(a)))
    }));
    drawAxis(ctx, { left, right, y: height - 28, values: ticks, p, footer: `${Math.max(0, total).toLocaleString()} community answer${total === 1 ? "" : "s"} · ${a > 0 ? "adaptive log view" : "adaptive view"}` });

    if (total <= 1) {
      ctx.save(); ctx.fillStyle = p.muted; ctx.font = "700 10px system-ui"; ctx.textAlign = "right";
      ctx.fillText("Distribution grows as more players answer", right, top + 12); ctx.restore();
    }
  };
  render(); observe(canvas, render);
}

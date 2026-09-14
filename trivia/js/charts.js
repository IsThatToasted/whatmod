import { formatAnswer } from "./scoring.js";

export function renderGuessHistogram(canvas, guesses = [], answer = null, myGuess = null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, canvas.clientWidth || 700);
  const height = Math.max(220, canvas.clientHeight || 280);
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const values = guesses.map(Number).filter(Number.isFinite);
  if (Number.isFinite(Number(answer))) values.push(Number(answer));
  if (Number.isFinite(Number(myGuess))) values.push(Number(myGuess));
  if (!values.length) return;

  // Numeric estimation questions often span orders of magnitude. Plot positive
  // data logarithmically; otherwise use a normal linear axis.
  const positiveOnly = values.every(v => v > 0);
  const project = positiveOnly ? v => Math.log10(v) : v => v;
  const projected = values.map(project);
  let min = Math.min(...projected), max = Math.max(...projected);
  if (min === max) { min -= .5; max += .5; }
  const pad = (max - min) * .08;
  min -= pad; max += pad;

  const bins = 14;
  const counts = new Array(bins).fill(0);
  guesses.map(Number).filter(Number.isFinite).forEach(v => {
    let i = Math.floor(((project(v)-min)/(max-min))*bins);
    i = Math.max(0, Math.min(bins-1, i));
    counts[i]++;
  });

  const left = 38, right = 18, top = 20, bottom = 42;
  const innerW = width-left-right, innerH = height-top-bottom;
  const maxCount = Math.max(1, ...counts);
  const style = getComputedStyle(document.documentElement);
  const grid = style.getPropertyValue("--line").trim() || "#26304b";
  const text = style.getPropertyValue("--muted").trim() || "#8c98b8";
  const primary = style.getPropertyValue("--primary").trim() || "#7c5cff";
  const accent = style.getPropertyValue("--accent").trim() || "#3dd9c5";
  const danger = style.getPropertyValue("--danger").trim() || "#ff647c";

  ctx.strokeStyle = grid; ctx.lineWidth = 1;
  for (let y=0;y<=4;y++) {
    const py = top + innerH*y/4;
    ctx.beginPath(); ctx.moveTo(left,py); ctx.lineTo(width-right,py); ctx.stroke();
  }

  const gap = 4;
  counts.forEach((count, i) => {
    const bw = innerW/bins;
    const h = (count/maxCount)*(innerH-8);
    ctx.fillStyle = primary;
    ctx.globalAlpha = .78;
    ctx.fillRect(left+i*bw+gap/2, top+innerH-h, bw-gap, h);
  });
  ctx.globalAlpha = 1;

  function marker(v, color, label) {
    if (!Number.isFinite(Number(v))) return;
    const x = left + ((project(Number(v))-min)/(max-min))*innerW;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top+innerH); ctx.stroke();
    ctx.fillStyle = color; ctx.font = "700 12px system-ui";
    ctx.textAlign = x > width*.72 ? "right" : "left";
    ctx.fillText(label, x + (x > width*.72 ? -6 : 6), top+14);
  }
  marker(Number(answer), accent, `Answer ${formatAnswer(answer)}`);
  marker(Number(myGuess), danger, `You ${formatAnswer(myGuess)}`);

  ctx.fillStyle = text; ctx.font = "12px system-ui"; ctx.textAlign = "left";
  const inv = positiveOnly ? x => Math.pow(10, x) : x => x;
  ctx.fillText(formatAnswer(inv(min)), left, height-12);
  ctx.textAlign = "right";
  ctx.fillText(formatAnswer(inv(max)), width-right, height-12);
  ctx.textAlign = "center";
  ctx.fillText(positiveOnly ? "Guess distribution · logarithmic scale" : "Guess distribution", left+innerW/2, height-12);
}

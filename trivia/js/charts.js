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
  const delta = g-a;
  return `${formatAnswer(Math.abs(delta))} ${delta > 0 ? "high" : "low"}`;
}

export function renderClosenessScale(canvas, answer, myGuess) {
  if (!canvas) return;
  const a = Number(answer), g = Number(myGuess);
  if (!Number.isFinite(a) || !Number.isFinite(g)) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, canvas.clientWidth || 700);
  const height = Math.max(180, canvas.clientHeight || 220);
  canvas.width = width*dpr; canvas.height = height*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,width,height);

  const style = getComputedStyle(document.documentElement);
  const line = style.getPropertyValue("--line").trim() || "#26304b";
  const text = style.getPropertyValue("--muted").trim() || "#8c98b8";
  const primary = style.getPropertyValue("--primary").trim() || "#7c5cff";
  const accent = style.getPropertyValue("--accent").trim() || "#3dd9c5";
  const left=38,right=28,axisY=104,innerW=width-left-right;

  let minX,maxX,project,invert,answerX,guessX;
  if (a>0 && g>0) {
    const err=Math.log10(g/a);
    const extent=Math.max(1.5,Math.min(4,Math.ceil(Math.abs(err)*2)/2+.5));
    minX=-extent; maxX=extent;
    project=v=>left+((Math.log10(v/a)-minX)/(maxX-minX))*innerW;
    invert=t=>a*Math.pow(10,t);
    answerX=project(a); guessX=Math.max(left,Math.min(width-right,project(g)));

    ctx.strokeStyle=line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,axisY);ctx.lineTo(width-right,axisY);ctx.stroke();
    const tickStart=Math.ceil(minX); const tickEnd=Math.floor(maxX);
    for(let t=tickStart;t<=tickEnd;t++){
      const x=left+((t-minX)/(maxX-minX))*innerW;
      ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,axisY-8);ctx.lineTo(x,axisY+8);ctx.stroke();
      ctx.fillStyle=text;ctx.font="11px system-ui";ctx.textAlign="center";ctx.fillText(formatAnswer(invert(t)),x,axisY+28);
    }
  } else {
    let min=Math.min(a,g),max=Math.max(a,g); const span=Math.max(1,max-min); min-=span*.5;max+=span*.5;
    project=v=>left+((v-min)/(max-min))*innerW; answerX=project(a);guessX=project(g);
    ctx.strokeStyle=line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,axisY);ctx.lineTo(width-right,axisY);ctx.stroke();
    ctx.fillStyle=text;ctx.font="11px system-ui";ctx.textAlign="left";ctx.fillText(formatAnswer(min),left,axisY+28);ctx.textAlign="right";ctx.fillText(formatAnswer(max),width-right,axisY+28);
  }

  ctx.strokeStyle=primary;ctx.globalAlpha=.25;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(Math.min(answerX,guessX),axisY);ctx.lineTo(Math.max(answerX,guessX),axisY);ctx.stroke();ctx.globalAlpha=1;

  function marker(x,color,title,value,above=true){
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,axisY-32);ctx.lineTo(x,axisY+16);ctx.stroke();
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,axisY,6,0,Math.PI*2);ctx.fill();
    ctx.font="800 11px system-ui";ctx.textAlign=x>width*.78?"right":x<width*.22?"left":"center";
    ctx.fillText(title,x,above?axisY-44:axisY+48);
    ctx.font="700 12px system-ui";ctx.fillText(formatAnswer(value),x,above?axisY-29:axisY+63);
  }
  marker(answerX,accent,"ANSWER",a,true);
  marker(guessX,primary,"YOU",g,false);

  ctx.fillStyle=text;ctx.font="700 12px system-ui";ctx.textAlign="center";
  ctx.fillText(closenessText(a,g),width/2,height-12);
}

export function renderCommunityHistogram(canvas, stats, answer, myGuess, excludeSelf=false) {
  if (!canvas) return;
  const hist=(stats?.histogram || []).map(Number);
  let total=Number(stats?.total_answers || hist.reduce((a,b)=>a+b,0));
  const a=Number(answer),g=Number(myGuess);
  if(excludeSelf && total>0 && hist.length){
    const bmin=Number(stats?.bucket_min ?? -4),bstep=Number(stats?.bucket_step ?? .2);
    let v=0;
    if(Number.isFinite(a)&&Number.isFinite(g)){
      if(a>0&&g>0)v=Math.log10(g/a);else v=(g-a)/Math.max(1,Math.abs(a));
      v=Math.max(Number(stats?.bucket_min??-4),Math.min(Number(stats?.bucket_max??4),v));
      const idx=Math.max(0,Math.min(hist.length-1,Math.round((v-bmin)/bstep)));
      if(hist[idx]>0){hist[idx]--;total--;}
    }
  }
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const width=Math.max(320,canvas.clientWidth||700),height=Math.max(220,canvas.clientHeight||280);
  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  const style=getComputedStyle(document.documentElement);
  const line=style.getPropertyValue("--line").trim()||"#26304b";
  const text=style.getPropertyValue("--muted").trim()||"#8c98b8";
  const primary=style.getPropertyValue("--primary").trim()||"#7c5cff";
  const accent=style.getPropertyValue("--accent").trim()||"#3dd9c5";
  const danger=style.getPropertyValue("--danger").trim()||"#ff647c";
  const left=38,right=18,top=30,bottom=50,innerW=width-left-right,innerH=height-top-bottom;
  const bins=hist.length||41,maxCount=Math.max(1,...hist);

  ctx.strokeStyle=line;ctx.lineWidth=1;
  for(let y=0;y<=4;y++){const py=top+innerH*y/4;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(width-right,py);ctx.stroke();}
  const bw=innerW/bins;
  hist.forEach((count,i)=>{const h=(count/maxCount)*(innerH-8);ctx.fillStyle=primary;ctx.globalAlpha=.72;ctx.fillRect(left+i*bw+1,top+innerH-h,Math.max(1,bw-2),h);});ctx.globalAlpha=1;

  const bmin=Number(stats?.bucket_min ?? -4),bstep=Number(stats?.bucket_step ?? .2);
  const answerIndex=(0-bmin)/bstep;
  const answerX=left+(answerIndex/(Math.max(1,bins-1)))*innerW;
  let guessIndex=answerIndex;
  if(Number.isFinite(a)&&Number.isFinite(g)){
    let v;
    if(a>0&&g>0)v=Math.log10(g/a);else v=(g-a)/Math.max(1,Math.abs(a));
    v=Math.max(Number(stats?.bucket_min??-4),Math.min(Number(stats?.bucket_max??4),v));
    guessIndex=(v-bmin)/bstep;
  }
  const guessX=left+(guessIndex/(Math.max(1,bins-1)))*innerW;
  function lineMarker(x,color,label){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+innerH);ctx.stroke();ctx.fillStyle=color;ctx.font="800 11px system-ui";ctx.textAlign=x>width*.75?"right":"left";ctx.fillText(label,x+(x>width*.75?-5:5),top+13);}
  lineMarker(answerX,accent,"ANSWER");lineMarker(guessX,danger,"YOU");

  ctx.fillStyle=text;ctx.font="11px system-ui";
  ctx.textAlign="left";ctx.fillText(Number.isFinite(a)&&a>0?formatAnswer(a*Math.pow(10,bmin)):"far low",left,height-16);
  ctx.textAlign="center";ctx.fillText(`${total.toLocaleString()} community answers · all-time clustered`,width/2,height-16);
  ctx.textAlign="right";ctx.fillText(Number.isFinite(a)&&a>0?formatAnswer(a*Math.pow(10,Number(stats?.bucket_max??4))):"far high",width-right,height-16);
}

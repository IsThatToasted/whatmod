import type { Bone, ImageAsset, Transform2D } from '../types';

export class Viewport2D{
  private ctx:CanvasRenderingContext2D; private imageCache=new Map<string,HTMLImageElement>();
  constructor(private canvas:HTMLCanvasElement){this.ctx=canvas.getContext('2d')!; this.resize(); new ResizeObserver(()=>this.resize()).observe(canvas.parentElement!);}
  resize(){const p=this.canvas.parentElement!; const dpr=devicePixelRatio||1;this.canvas.width=Math.max(1,p.clientWidth*dpr);this.canvas.height=Math.max(1,p.clientHeight*dpr);this.canvas.style.width=`${p.clientWidth}px`;this.canvas.style.height=`${p.clientHeight}px`;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  async ensureImage(asset:ImageAsset){if(this.imageCache.has(asset.id))return;const i=new Image();i.src=asset.dataUrl;await i.decode();this.imageCache.set(asset.id,i);}
  draw(images:ImageAsset[],bones:Bone[],transforms:Map<string,Transform2D>,selectedId:string|null,groundY:number,currentTime:number){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight,ctx=this.ctx;ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#18222a');g.addColorStop(1,'#0e1216');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.save();const scale=Math.min((w-80)/700,(h-80)/700),ox=w/2-350*scale,oy=h/2-350*scale;ctx.translate(ox,oy);ctx.scale(scale,scale);
    ctx.strokeStyle='rgba(122,180,160,.18)';ctx.lineWidth=1/scale;for(let x=0;x<=700;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,700);ctx.stroke();}for(let y=0;y<=700;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(700,y);ctx.stroke();}
    ctx.strokeStyle='#6fd4ad';ctx.lineWidth=2/scale;ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(700,groundY);ctx.stroke();
    const asset=images[0],img=asset?this.imageCache.get(asset.id):undefined;if(img){ctx.globalAlpha=.72;const ratio=Math.min(430/img.width,560/img.height);const iw=img.width*ratio,ih=img.height*ratio;ctx.drawImage(img,350-iw/2,groundY-ih,iw,ih);ctx.globalAlpha=1;}
    for(const b of bones){const t=transforms.get(b.id)||b.transform;const sx=b.start.x+t.x,sy=b.start.y+t.y; const dx=b.end.x-b.start.x,dy=b.end.y-b.start.y; const c=Math.cos(t.rotation),s=Math.sin(t.rotation);const ex=sx+(dx*c-dy*s)*t.scaleX,ey=sy+(dx*s+dy*c)*t.scaleY;
      ctx.strokeStyle=b.id===selectedId?'#ffe08a':'#8de7c2';ctx.lineWidth=(b.id===selectedId?6:4)/scale;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.fillStyle=b.id===selectedId?'#ffe08a':'#d8fff0';ctx.beginPath();ctx.arc(sx,sy,7/scale,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();ctx.fillStyle='rgba(255,255,255,.65)';ctx.font='12px system-ui';ctx.fillText(`2D Rig Preview • ${currentTime.toFixed(2)}s`,18,24);
  }
}

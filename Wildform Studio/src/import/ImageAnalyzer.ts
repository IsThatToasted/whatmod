import type { ImageAsset, SpriteRegion } from '../types';
import { uid } from '../state';

export type AnalysisResult = { asset: ImageAsset; mode:'single'|'sprite-sheet'; confidence:number; notes:string[] };

type Rect={x:number;y:number;w:number;h:number;area:number};

export async function analyzeImage(name:string,dataUrl:string):Promise<AnalysisResult>{
  const img=await loadImage(dataUrl);
  const canvas=document.createElement('canvas'); canvas.width=img.width; canvas.height=img.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!; ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,img.width,img.height).data;
  const opaque=(x:number,y:number)=>data[(y*img.width+x)*4+3]>20;
  const blankRows=new Array(img.height).fill(true), blankCols=new Array(img.width).fill(true);
  for(let y=0;y<img.height;y++) for(let x=0;x<img.width;x++) if(opaque(x,y)){blankRows[y]=false;blankCols[x]=false;}
  const rowBands=bands(blankRows), colBands=bands(blankCols);
  const regions:SpriteRegion[]=[];
  // Transparent gutter grid detection: non-blank bands on both axes = likely sheet.
  if(rowBands.length>1 && colBands.length>1 && rowBands.length*colBands.length<=256){
    for(const rb of rowBands) for(const cb of colBands){
      if(hasOpaque(opaque,cb[0],rb[0],cb[1]-cb[0]+1,rb[1]-rb[0]+1)){
        regions.push({id:uid('region'),name:`Cell ${regions.length+1}`,x:cb[0],y:rb[0],w:cb[1]-cb[0]+1,h:rb[1]-rb[0]+1,sourceId:''});
      }
    }
  }
  let mode:'single'|'sprite-sheet'=regions.length>=2?'sprite-sheet':'single';
  if(mode==='single'){
    const components=connectedComponents(img.width,img.height,opaque);
    const useful=components.filter(r=>r.area>Math.max(25,img.width*img.height*.0005)).slice(0,64);
    if(useful.length>=2){
      for(const r of useful) regions.push({id:uid('region'),name:`Part ${regions.length+1}`,x:r.x,y:r.y,w:r.w,h:r.h,sourceId:''});
    } else {
      const b=alphaBounds(img.width,img.height,opaque);
      regions.push({id:uid('region'),name:'Creature',x:b.x,y:b.y,w:b.w,h:b.h,sourceId:''});
    }
  }
  const id=uid('img'); regions.forEach(r=>r.sourceId=id);
  inferRoles(regions,img.width,img.height);
  return {asset:{id,name,dataUrl,width:img.width,height:img.height,regions},mode,confidence:mode==='sprite-sheet'?.9:.7,
    notes:[mode==='sprite-sheet'?`Detected ${regions.length} sprite cells.`:`Detected ${regions.length} visible region(s).`, 'Part roles are heuristic and remain editable.']};
}

function bands(blank:boolean[]):Array<[number,number]>{
  const out:Array<[number,number]>=[]; let s=-1;
  for(let i=0;i<=blank.length;i++){
    const active=i<blank.length && !blank[i];
    if(active&&s<0)s=i;
    if((!active||i===blank.length)&&s>=0){out.push([s,i-1]);s=-1;}
  } return out;
}
function hasOpaque(fn:(x:number,y:number)=>boolean,x0:number,y0:number,w:number,h:number){
  for(let y=y0;y<y0+h;y+=Math.max(1,Math.floor(h/10))) for(let x=x0;x<x0+w;x+=Math.max(1,Math.floor(w/10))) if(fn(x,y))return true; return false;
}
function alphaBounds(w:number,h:number,op:(x:number,y:number)=>boolean):Rect{
  let minX=w,minY=h,maxX=0,maxY=0,count=0; for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(op(x,y)){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;}
  return count?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area:count}:{x:0,y:0,w,h,area:w*h};
}
function connectedComponents(w:number,h:number,op:(x:number,y:number)=>boolean):Rect[]{
  const seen=new Uint8Array(w*h), out:Rect[]=[]; const step=Math.max(1,Math.floor(Math.max(w,h)/900));
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const idx=y*w+x;if(seen[idx]||!op(x,y))continue;
    const q:[[number,number]]|any=[[x,y]]; seen[idx]=1; let qi=0,minX=x,maxX=x,minY=y,maxY=y,count=0;
    while(qi<q.length){const [cx,cy]=q[qi++];count++;minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
      for(const [nx,ny] of [[cx+step,cy],[cx-step,cy],[cx,cy+step],[cx,cy-step]]){if(nx<0||ny<0||nx>=w||ny>=h)continue; const ni=ny*w+nx;if(!seen[ni]&&op(nx,ny)){seen[ni]=1;q.push([nx,ny]);}}
    }
    out.push({x:minX,y:minY,w:maxX-minX+step,h:maxY-minY+step,area:count*step*step});
  }
  return out.sort((a,b)=>b.area-a.area);
}
function inferRoles(regions:SpriteRegion[],w:number,h:number){
  if(regions.length<2){regions[0].role='full-creature';return;}
  const sorted=[...regions].sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2));
  for(const r of sorted){const cy=(r.y+r.h/2)/h, cx=(r.x+r.w/2)/w;
    if(cy<.30)r.role='head-or-accessory'; else if(cy<.62 && Math.abs(cx-.5)<.22)r.role='body'; else if(cy>.62)r.role=cx<.5?'leg-left':'leg-right'; else r.role=cx<.5?'arm-left':'arm-right';
  }
}
function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}

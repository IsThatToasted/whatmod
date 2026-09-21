import type { AnimationClip, Bone, Keyframe, Transform2D } from '../types';
import { uid } from '../state';

const clone=(t:Transform2D):Transform2D=>({...t});
const key=(boneId:string,time:number,base:Transform2D, patch:Partial<Transform2D>, easing='easeInOut'):Keyframe=>({id:uid('key'),boneId,time,transform:{...clone(base),...patch},easing});

export type Recipe='Idle'|'Walk'|'Run'|'Jump'|'Celebrate'|'Attack';
export function generateRecipe(recipe:Recipe,bones:Bone[]):AnimationClip{
 const find=(n:string)=>bones.find(b=>b.name===n)!; const frames:Keyframe[]=[];
 const add=(name:string,time:number,p:Partial<Transform2D>)=>{const b=find(name); if(b)frames.push(key(b.id,time,b.transform,p));};
 let duration=1.2,loop=true;
 if(recipe==='Idle'){
   duration=2; add('Chest',0,{y:0});add('Chest',1,{y:-5,rotation:.02});add('Chest',2,{y:0});
   add('Tail',0,{rotation:-.12});add('Tail',1,{rotation:.15});add('Tail',2,{rotation:-.12});
   add('Head',0,{rotation:-.025});add('Head',1,{rotation:.025});add('Head',2,{rotation:-.025});
 }
 if(recipe==='Walk'||recipe==='Run'){
   duration=recipe==='Run'?.7:1.0; const a=recipe==='Run'?.75:.48, arm=a*.75, bounce=recipe==='Run'?10:6;
   [0,.5,1].forEach((p,i)=>{const tm=p*duration,sg=i===1?-1:1; add('Thigh.L',tm,{rotation:a*sg});add('Thigh.R',tm,{rotation:-a*sg});add('UpperArm.L',tm,{rotation:-arm*sg});add('UpperArm.R',tm,{rotation:arm*sg});add('Pelvis',tm,{y:i===1?-bounce:0});});
   add('Tail',0,{rotation:-.18});add('Tail',duration/2,{rotation:.2});add('Tail',duration,{rotation:-.18});
 }
 if(recipe==='Jump'){
   duration=1.1;loop=false; add('Pelvis',0,{y:0});add('Pelvis',.25,{y:10});add('Pelvis',.58,{y:-90});add('Pelvis',.95,{y:6});add('Pelvis',1.1,{y:0});
   for(const n of ['Thigh.L','Thigh.R']){add(n,.25,{rotation:.5});add(n,.58,{rotation:-.15});add(n,.95,{rotation:.4});add(n,1.1,{rotation:0});}
 }
 if(recipe==='Celebrate'){
   duration=1.5;loop=false; add('UpperArm.L',0,{rotation:0});add('UpperArm.R',0,{rotation:0});add('UpperArm.L',.35,{rotation:-2});add('UpperArm.R',.35,{rotation:2});add('Pelvis',.6,{y:-40});add('Pelvis',1,{y:0});add('Tail',.2,{rotation:-.5});add('Tail',.6,{rotation:.5});add('Tail',1.0,{rotation:-.4});
 }
 if(recipe==='Attack'){
   duration=.8;loop=false; add('Chest',0,{rotation:0});add('Chest',.2,{rotation:-.28});add('Chest',.42,{rotation:.35});add('Chest',.8,{rotation:0});add('UpperArm.R',0,{rotation:0});add('UpperArm.R',.2,{rotation:-1.2});add('UpperArm.R',.42,{rotation:1.4});add('UpperArm.R',.8,{rotation:0});
 }
 return {id:uid('clip'),name:recipe,duration,fps:30,loop,keyframes:frames,events:recipe==='Attack'?[{id:uid('evt'),time:.38,name:'damage-window',payload:'start'},{id:uid('evt'),time:.48,name:'damage-window',payload:'end'}]:[]};
}

export function sampleTransform(clip:AnimationClip,boneId:string,time:number,base:Transform2D):Transform2D{
 const ks=clip.keyframes.filter(k=>k.boneId===boneId).sort((a,b)=>a.time-b.time); if(!ks.length)return {...base}; if(time<=ks[0].time)return {...ks[0].transform}; if(time>=ks[ks.length-1].time)return {...ks[ks.length-1].transform};
 let a=ks[0],b=ks[1]; for(let i=0;i<ks.length-1;i++)if(time>=ks[i].time&&time<=ks[i+1].time){a=ks[i];b=ks[i+1];break;}
 let u=(time-a.time)/(b.time-a.time); u=u*u*(3-2*u); const lerp=(x:number,y:number)=>x+(y-x)*u;
 return {x:lerp(a.transform.x,b.transform.x),y:lerp(a.transform.y,b.transform.y),rotation:lerp(a.transform.rotation,b.transform.rotation),scaleX:lerp(a.transform.scaleX,b.transform.scaleX),scaleY:lerp(a.transform.scaleY,b.transform.scaleY)};
}

import type { AnimationClip, Bone, Transform2D, WildformProject } from './types';

const t = (x=0,y=0):Transform2D => ({x,y,rotation:0,scaleX:1,scaleY:1});
export function uid(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

export function createDefaultRig(width=500, height=650): Bone[] {
  const cx=width/2, top=height*0.12, hipY=height*0.57;
  const make=(name:string,parentId:string|null,sx:number,sy:number,ex:number,ey:number):Bone=>({
    id:uid('bone'),name,parentId,start:{x:sx,y:sy},end:{x:ex,y:ey},transform:t(),length:Math.hypot(ex-sx,ey-sy)
  });
  const root=make('Root',null,cx,hipY,cx,hipY-5);
  const pelvis=make('Pelvis',root.id,cx,hipY,cx,hipY-45);
  const spine=make('Spine',pelvis.id,cx,hipY-45,cx,height*.33);
  const chest=make('Chest',spine.id,cx,height*.33,cx,height*.25);
  const neck=make('Neck',chest.id,cx,height*.25,cx,top+75);
  const head=make('Head',neck.id,cx,top+75,cx,top);
  const armL=make('UpperArm.L',chest.id,cx-25,height*.29,cx-105,height*.40);
  const foreL=make('Forearm.L',armL.id,cx-105,height*.40,cx-135,height*.52);
  const armR=make('UpperArm.R',chest.id,cx+25,height*.29,cx+105,height*.40);
  const foreR=make('Forearm.R',armR.id,cx+105,height*.40,cx+135,height*.52);
  const legL=make('Thigh.L',pelvis.id,cx-28,hipY,cx-55,height*.75);
  const shinL=make('Shin.L',legL.id,cx-55,height*.75,cx-55,height*.92);
  const legR=make('Thigh.R',pelvis.id,cx+28,hipY,cx+55,height*.75);
  const shinR=make('Shin.R',legR.id,cx+55,height*.75,cx+55,height*.92);
  const tail=make('Tail',pelvis.id,cx,hipY,cx+120,height*.63);
  return [root,pelvis,spine,chest,neck,head,armL,foreL,armR,foreR,legL,shinL,legR,shinR,tail];
}

export function newClip(name='Idle'):AnimationClip { return {id:uid('clip'),name,duration:1.5,fps:30,loop:true,keyframes:[],events:[]}; }
export function createProject():WildformProject {
  const clip=newClip('Idle');
  return { version:1,id:uid('project'),name:'Untitled Wildform Creature',images:[],models:[],bones:createDefaultRig(),clips:[clip],activeClipId:clip.id,
    settings:{groundY:620,snap:1/30,onionSkin:false,autoKey:true,footLock:true,playbackSpeed:1} };
}

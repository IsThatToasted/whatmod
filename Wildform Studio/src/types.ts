export type Vec2 = { x: number; y: number };
export type Transform2D = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
export type Bone = {
  id: string; name: string; parentId: string | null; start: Vec2; end: Vec2;
  transform: Transform2D; length: number; locked?: boolean;
};
export type SpriteRegion = { id:string; name:string; x:number; y:number; w:number; h:number; role?:string; sourceId:string };
export type ImageAsset = { id:string; name:string; dataUrl:string; width:number; height:number; regions:SpriteRegion[] };
export type ModelAsset = { id:string; name:string; dataUrl:string; ext:string };
export type Keyframe = { id:string; time:number; boneId:string; transform:Transform2D; easing:string };
export type AnimationEvent = { id:string; time:number; name:string; payload?:string };
export type AnimationClip = { id:string; name:string; duration:number; fps:number; loop:boolean; keyframes:Keyframe[]; events:AnimationEvent[] };
export type ProjectSettings = { groundY:number; snap:number; onionSkin:boolean; autoKey:boolean; footLock:boolean; playbackSpeed:number };
export type WildformProject = {
  version: 1; id:string; name:string; images:ImageAsset[]; models:ModelAsset[]; bones:Bone[];
  clips:AnimationClip[]; activeClipId:string; settings:ProjectSettings;
};

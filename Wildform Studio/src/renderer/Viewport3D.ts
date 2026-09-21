import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class Viewport3D{
  private scene=new THREE.Scene(); private camera=new THREE.PerspectiveCamera(45,1,.01,1000); private renderer:THREE.WebGLRenderer; private model:THREE.Object3D|null=null; private angle=0;
  constructor(private host:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(devicePixelRatio);host.appendChild(this.renderer.domElement);this.camera.position.set(3,2.2,5);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x24313b,2.2));const d=new THREE.DirectionalLight(0xffffff,2.2);d.position.set(4,7,5);this.scene.add(d);
    const grid=new THREE.GridHelper(10,20,0x46645a,0x253630);this.scene.add(grid);
    const demo=new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.15,12,24),new THREE.MeshStandardMaterial({color:0x6fd4ad,roughness:.58}));demo.position.y=1.25;demo.name='Wildform preview proxy';this.model=demo;this.scene.add(demo);
    new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.animate();
    this.renderer.domElement.addEventListener('pointermove',e=>{if(e.buttons===1){this.angle+=e.movementX*.01;this.camera.position.x=Math.sin(this.angle)*5;this.camera.position.z=Math.cos(this.angle)*5;this.camera.lookAt(0,1,0);}});
  }
  resize(){const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  animate=()=>{requestAnimationFrame(this.animate);this.renderer.render(this.scene,this.camera);};
  async load(name:string,ext:string,dataUrl:string){
    if(this.model)this.scene.remove(this.model);const buffer=await fetch(dataUrl).then(r=>r.arrayBuffer());
    if(ext==='.glb'||ext==='.gltf'){
      const loader=new GLTFLoader();const parsed=await new Promise<THREE.Group>((res,rej)=>loader.parse(buffer,'',g=>res(g.scene),rej));this.model=parsed;
    }else if(ext==='.obj'){
      const text=new TextDecoder().decode(buffer);this.model=new OBJLoader().parse(text);
    }else throw new Error('Supported 3D formats: .glb, .gltf, .obj');
    const box=new THREE.Box3().setFromObject(this.model);const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());this.model.position.sub(center);this.model.position.y+=size.y/2;const max=Math.max(size.x,size.y,size.z)||1;this.model.scale.setScalar(2.2/max);this.scene.add(this.model);
  }
}

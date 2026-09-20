import type { ActivityEntry, EventRecord, LifeItem, Place, Space, UserProfile } from '../types/models';
const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0,10); };
const iso = new Date().toISOString();
export const demoProfile: UserProfile = { id:'demo-user', email:'demo@justglance.local', name:'Brian', greeting_name:'Brian', wake_time:'07:00', sleep_time:'23:00', theme:'system', onboarding_complete:true };
export const demoItems: LifeItem[] = [
  {id:'1',title:'Call dentist',type:'call',status:'open',priority:'high',due_date:day(0),due_time:'16:30',estimated_minutes:5,context_tags:['call'],created_at:iso,updated_at:iso,postpone_count:2},
  {id:'2',title:'Return package',type:'errand',status:'open',priority:'normal',due_date:day(0),estimated_minutes:10,place_name:'UPS Store',context_tags:['errand'],created_at:iso,updated_at:iso,postpone_count:1},
  {id:'3',title:'Buy milk',type:'shopping',status:'open',priority:'normal',due_date:day(1),place_name:'Walmart',estimated_minutes:5,context_tags:['shopping'],created_at:iso,updated_at:iso,postpone_count:0},
  {id:'4',title:'Take trash out',type:'chore',status:'open',priority:'normal',due_date:day(0),due_time:'20:00',estimated_minutes:5,context_tags:['home'],created_at:iso,updated_at:iso,postpone_count:0},
  {id:'5',title:'Change air filter',type:'chore',status:'open',priority:'low',due_date:day(4),estimated_minutes:15,context_tags:['home'],created_at:iso,updated_at:iso,postpone_count:0},
  {id:'6',title:'Gift idea for Ashley',type:'idea',status:'open',priority:'low',context_tags:['note'],created_at:iso,updated_at:iso,postpone_count:0}
];
export const demoEvents: EventRecord[] = [{id:'e1',title:'Dinner with Ashley',start_at:`${day(0)}T19:00:00`,end_at:`${day(0)}T20:30:00`,location:'Downtown'}];
export const demoSpaces: Space[] = [{id:'personal',name:'Personal',role:'owner',emoji:'◌',member_count:1},{id:'home',name:'Home',role:'owner',emoji:'⌂',member_count:2}];
export const demoPlaces: Place[] = [{id:'p1',name:'Home',category:'home',address:'Your saved home'},{id:'p2',name:'Walmart',category:'shopping',address:'Favorite store'},{id:'p3',name:'Work',category:'work',address:'Your workplace'}];
export const demoActivity: ActivityEntry[] = [{id:'a1',text:'Ashley picked up paper towels',created_at:iso},{id:'a2',text:'You completed grocery pickup',created_at:iso}];

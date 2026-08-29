import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { Estimator } from './pages/Estimator';
import { Field } from './pages/Field';
import { Team } from './pages/Team';
import { Placeholder } from './pages/Placeholder';

const router = createHashRouter([{ path:'/', element:<Shell/>, children:[
  {index:true, element:<Home/>},
  {path:'projects', element:<Projects/>},
  {path:'estimator', element:<Estimator/>},
  {path:'field', element:<Field/>},
  {path:'team', element:<Team/>},
  {path:'inbox', element:<Placeholder title="Inbox" copy="Project conversations, mentions, approvals, and client communication in one focused queue."/>},
  {path:'settings', element:<Placeholder title="Settings" copy="Company defaults, production rates, roles, integrations, branding, and security."/>}
]}]);
export default function App(){ return <RouterProvider router={router}/>; }

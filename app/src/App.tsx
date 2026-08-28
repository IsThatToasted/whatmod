import { AuthGate, useAuth } from './auth/AuthGate';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { Estimator } from './pages/Estimator';
import { Field } from './pages/Field';
import { Team } from './pages/Team';
import { AdminWorkspace } from './pages/Admin';
import { Placeholder } from './pages/Placeholder';

function AdminRoute({children}:{children:ReactNode}){
  const {isAdmin}=useAuth();
  return isAdmin ? children : <Navigate to="/" replace/>;
}

const router = createHashRouter([
 { path:'/', element:<Shell/>, children:[
  {index:true, element:<Home/>},
  {path:'projects', element:<Projects/>},
  {path:'estimator', element:<Estimator/>},
  {path:'field', element:<Field/>},
  {path:'team', element:<Team/>},
  {path:'inbox', element:<Placeholder title="Inbox" copy="Project conversations, mentions, approvals, and client communication in one focused queue."/>},
  {path:'settings', element:<Placeholder title="Settings" copy="Personal preferences, notifications, appearance, device permissions, and account controls."/>}
 ]},
 {path:'/admin', element:<AdminRoute><AdminWorkspace/></AdminRoute>}
]);
export default function App(){ return <AuthGate><RouterProvider router={router}/></AuthGate>; }

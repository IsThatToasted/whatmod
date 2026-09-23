import { X } from 'lucide-react'
import type { ReactNode } from 'react'
export function Modal({open,onClose,title,children}:{open:boolean,onClose:()=>void,title:string,children:ReactNode}){
  if(!open)return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="modal-body">{children}</div></section></div>
}

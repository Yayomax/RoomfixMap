import { TECHS } from "./data.js";
import { priority, compatible, isOpen, isEmergency, routeFor, roomPoint, corridorDistance, FLOOR_GRAPH } from "./engine.js";
import { personPosition } from "./crew.js";

const minutes = ticket => ({ clima:25, agua:20, luz:12, equipo:15, otro:15 }[ticket.category] ?? 20) + (ticket.unusable ? 5 : 0);
function travel(queue, person, position, now) {
  const planning = queue.filter(t => t.status !== "blocked").map(t => ({...t, accessCoordinated:true}));
  const rooms = [...new Set(routeFor(planning,person.id,now,position.node).map(t => t.room))];
  const origin = FLOOR_GRAPH.nodes[position.node];
  let point={x:origin[0],y:origin[1]}, distance=0;
  for(const room of rooms) {
    const next=roomPoint(room);
    distance+=corridorDistance(point,next);
    point=next;
  }
  return distance;
}

// Planificación interna: trabajo activo y cambios manuales quedan fijados.
export function dispatchTickets(tickets, now=Date.now(), people=TECHS) {
  const result=structuredClone(tickets);
  const plans=new Map(people.map(person=>[person.id,[]]));
  const waiting=[];
  for(const ticket of result) {
    if(!isOpen(ticket)||isEmergency(ticket))continue;
    const person=people.find(person=>person.id===ticket.tech);
    if(person && (ticket.status==="working" || ((ticket.status==="blocked" || ticket.assignmentMode==="manual") && compatible(ticket,person)))) {
      plans.get(person.id).push(ticket);
    } else waiting.push(ticket);
  }
  waiting.sort((a,b)=>Number(priority(a,now).level.slice(1))-Number(priority(b,now).level.slice(1)) || priority(b,now).score-priority(a,now).score || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
  for(const ticket of waiting) {
    const candidates=people.filter(person=>compatible(ticket,person));
    const choices=candidates.map(person=>{
      const queue=plans.get(person.id),position=personPosition(person,result);
      const load=queue.reduce((sum,t)=>sum+(t.status==="working"?20:t.status==="blocked"?6:minutes(t)),0);
      const added=Math.max(0,travel([...queue,{...ticket,tech:person.id,status:"assigned"}],person,position,now)-travel(queue,person,position,now));
      const current=FLOOR_GRAPH.nodes[position.node];
      const proximity=corridorDistance({x:current[0],y:current[1]},roomPoint(ticket.room));
      const urgent=priority(ticket,now).level==="P1";
      const busy=queue.some(t=>t.status==="working");
      const sameRoom=queue.some(t=>t.room===ticket.room);
      const cost=load*(urgent?1.5:1)+queue.length*3+added*.009+proximity*.014+(busy?(urgent?18:5):0)-(sameRoom?8:0)-(ticket.tech===person.id?1.5:0);
      return {person,cost};
    }).sort((a,b)=>a.cost-b.cost||a.person.id.localeCompare(b.person.id));
    const selected=choices[0]?.person;
    if(!selected)continue;
    const changed=ticket.tech!==selected.id || ["new","classified"].includes(ticket.status);
    ticket.tech=selected.id;
    if(ticket.status!=="blocked")ticket.status="assigned";
    ticket.assignmentMode="automatic";
    if(changed) {
      ticket.updatedAt=now;
      ticket.history.push({at:now,text:`Asignado a ${selected.name}.`});
    }
    plans.get(selected.id).push(ticket);
  }
  return result;
}

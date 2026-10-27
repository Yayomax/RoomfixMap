import test from "node:test";
import assert from "node:assert/strict";
import { seed, prepareScenario, roomLabel, normalizeRoom, TECHS } from "../js/data.js";
import { newTicket, compatible, transition } from "../js/engine.js";
import { dispatchTickets } from "../js/dispatch.js";
import { crewView } from "../js/crew.js";
import { routeGeometry } from "../js/routes.js";

const now=1800000000000;
const report=(id,room,extra={})=>newTicket({room,category:"equipo",symptom:"El televisor no funciona",occupied:false,unusable:false,contactFirst:true,...extra},`RF-${id}`,now);
const held=(ticket,tech)=>({...ticket,tech,status:"assigned",assignmentMode:"manual",accessCoordinated:true});

test("planta baja usa 001–012 y acepta enlaces anteriores sin cambiar la ubicación física",()=>{
  assert.equal(roomLabel(1),"001");assert.equal(roomLabel(12),"012");
  assert.equal(normalizeRoom("008"),8);assert.equal(normalizeRoom("208"),8);
  assert.throws(()=>report(1,201));assert.throws(()=>report(1,0));
});
test("la migración renumera los reportes guardados y conserva identidades e historial",()=>{
  const original=seed(now);delete original.roomScheme;
  original.tickets.forEach(t=>t.room+=200);
  original.tickets[0].status="resolved";
  const history=structuredClone(original.tickets[0].history);
  const migrated=prepareScenario(original,now);
  assert.equal(original.tickets[0].room,204);
  assert.equal(migrated.tickets[0].room,4);
  assert.equal(migrated.tickets.length,original.tickets.length);
  assert.deepEqual(migrated.tickets.map(t=>t.id),original.tickets.map(t=>t.id));
  assert.deepEqual(migrated.tickets[0].history,history);
  assert.equal(migrated.tickets[0].status,"resolved");
  assert.equal(prepareScenario(migrated,now),migrated);
});
test("todas las incidencias ordinarias reciben responsable compatible sin autorizar ingreso",()=>{
  const tickets=dispatchTickets(seed(now).tickets,now);
  assert.equal(tickets.filter(t=>t.tech).length,11);
  assert.ok(tickets.every(t=>compatible(t,TECHS.find(p=>p.id===t.tech))));
  assert.ok(tickets.every(t=>t.tech!=="diego"));
  for(const room of [4,6])assert.equal(tickets.find(t=>t.room===room).accessCoordinated,false);
});
test("en igualdad de carga se elige la ubicación más cercana",()=>{
  const [assigned]=dispatchTickets([report(1,6)],now);
  assert.equal(assigned.tech,"lucia");
});
test("la carga se reparte entre personas compatibles cuando parten del mismo lugar",()=>{
  const people=TECHS.filter(p=>p.available).map(p=>({...p,base:{node:"c0",label:"Recepción"}}));
  const tickets=dispatchTickets([1,2,3,4,5,6].map((room,i)=>report(i+1,room)),now,people);
  const counts=people.map(person=>tickets.filter(t=>t.tech===person.id).length);
  assert.ok(Math.abs(counts[0]-counts[1])<=1,JSON.stringify(counts));
});
test("la criticidad se planifica primero y evita esperar a una persona ocupada",()=>{
  const active={...report(10,11,{category:"agua",symptom:"No sale agua",occupied:true}),tech:"lucia",status:"working",accessCoordinated:true};
  const urgent=report(11,6,{symptom:"La cerradura falla",occupied:true,unusable:true});
  const low=report(12,6);
  const first=dispatchTickets([active,low,urgent],now);
  const second=dispatchTickets([urgent,active,low],now);
  assert.equal(first.find(t=>t.id===urgent.id).tech,"martin");
  assert.deepEqual(first.map(t=>[t.id,t.tech]).sort(),second.map(t=>[t.id,t.tech]).sort());
});
test("la próxima ruta pesa en la elección aunque las personas estén en la misma posición",()=>{
  const people=TECHS.filter(p=>p.available).map(p=>({...p,base:{node:"c0",label:"Recepción"}}));
  const tickets=[held(report(1,6),"martin"),held(report(2,1),"lucia"),report(3,5)];
  assert.equal(dispatchTickets(tickets,now,people).find(t=>t.id==="RF-3").tech,"martin");
  tickets[0].room=1;tickets[1].room=6;
  assert.equal(dispatchTickets(tickets,now,people).find(t=>t.id==="RF-3").tech,"lucia");
});
test("se conservan intervenciones activas, bloqueos y ajustes manuales de responsable",()=>{
  const active={...held(report(1,11),"lucia"),status:"working"};
  const manual=held(report(2,12),"martin");
  const blocked={...held(report(3,2),"martin"),status:"blocked",blockReason:"Repuesto"};
  const original=[active,manual,blocked,report(4,5)];
  const result=dispatchTickets(original,now);
  for(const ticket of [active,manual,blocked])assert.deepEqual(result.find(t=>t.id===ticket.id),ticket);
  assert.equal(original[3].tech,null);
});
test("reabrir vuelve a asignar sin perder el reporte ni reutilizar el permiso de acceso",()=>{
  const ticket={...held(report(1,8),"martin"),status:"resolved"};
  const reopened=transition(ticket,"reopen",{},[ticket],now);
  const [assigned]=dispatchTickets([reopened],now);
  assert.ok(assigned.tech);assert.equal(assigned.status,"assigned");assert.equal(assigned.accessCoordinated,false);
  assert.equal(assigned.id,ticket.id);assert.ok(assigned.history.some(e=>e.text.includes("Reapertura")));
});
test("recargar no mueve responsables ni duplica eventos",()=>{
  const once=dispatchTickets(seed(now).tickets,now);
  let result=once;
  for(let i=0;i<10;i++)result=dispatchTickets(result,now);
  assert.deepEqual(result,once);
});
test("las emergencias conservan su vía separada",()=>{
  const emergency=report(1,8,{category:"emergencia",symptom:"Humo o fuego"});
  const [result]=dispatchTickets([emergency],now);
  assert.equal(result.tech,null);assert.equal(result.status,"classified");
});
test("cada tramo tiene su carril y una dirección coherente, sin diagonales a través de habitaciones",()=>{
  const views=crewView(dispatchTickets(seed(now).tickets,now),"all",now).filter(v=>v.route.length);
  const horizontalLanes=[];
  for(const [personIndex,view] of views.entries()) {
    const legs=routeGeometry(view,personIndex,views.length);
    for(const leg of legs.filter(leg=>!leg.current)) {
      const lane=leg.points.find((p,i)=>i&&p[1]===leg.points[i-1][1]&&Math.abs(p[0]-leg.points[i-1][0])>=24)?.[1];
      if(lane!==undefined){assert.ok(lane>270&&lane<340);horizontalLanes.push(lane);}
      for(let i=1;i<leg.points.length;i++)assert.ok(leg.points[i][0]===leg.points[i-1][0]||leg.points[i][1]===leg.points[i-1][1]);
      if(leg.arrow&&lane!==undefined){
        const a=leg.points[0],b=leg.points.at(-1);
        assert.equal(Math.sign(Math.cos(leg.arrow.angle*Math.PI/180)),Math.sign(b[0]-a[0]));
      }
    }
  }
  assert.equal(new Set(horizontalLanes).size,horizontalLanes.length);
});
test("una tarea en atención marca su parada sin inventar un tramo de desplazamiento",()=>{
  const view=crewView(dispatchTickets(seed(now).tickets,now),"lucia",now)[0];
  const [current]=routeGeometry(view);
  assert.equal(current.current,true);assert.deepEqual(current.points,[]);assert.equal(current.arrow,null);
});

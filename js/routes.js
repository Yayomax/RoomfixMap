import { roomPoint } from "./engine.js";

// Un carril por tramo evita flechas opuestas sobre el mismo segmento.
export function routeGeometry(view, personIndex=0, personCount=1) {
  const side=personCount>1?(personIndex%2?9:-9):0;
  const drawable=view.stops.filter((stop,i)=>!(i===0&&view.position.status==="En atención"&&view.position.node===`r${stop.room}`)).length;
  const band=personCount>1 ? {min:personIndex%2?309:277,max:personIndex%2?335:303} : {min:282,max:328};
  let laneIndex=0;
  return view.stops.map((stop,index)=>{
    const current=index===0&&view.position.status==="En atención"&&view.position.node===`r${stop.room}`;
    if(current)return {index,room:stop.room,current:true,points:[],arrow:null};
    const previous=view.stops[index-1];
    const origin=previous?roomPoint(previous.room):view.position;
    const fromPosition=!previous||(index===1&&view.position.status==="En atención");
    const start=fromPosition?view.position:{x:origin.x+side,y:origin.y};
    const end=roomPoint(stop.room);
    const lane=drawable<=1?(band.min+band.max)/2:band.min+(band.max-band.min)*laneIndex/(drawable-1);
    laneIndex++;
    const startX=fromPosition?start.x+side:start.x;
    const endX=end.x+side;
    const points=[[start.x,start.y],[startX,start.y],[startX,lane],[endX,lane],[endX,end.y]].filter((point,i,all)=>i===0||point[0]!==all[i-1][0]||point[1]!==all[i-1][1]);
    let segment=null;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!segment||length>segment.length)segment={a,b,length};
    }
    const arrow=segment&&segment.length>=24?{x:(segment.a[0]+segment.b[0])/2,y:(segment.a[1]+segment.b[1])/2,angle:Math.atan2(segment.b[1]-segment.a[1],segment.b[0]-segment.a[0])*180/Math.PI}:null;
    return {index,room:stop.room,current:false,points,arrow};
  });
}

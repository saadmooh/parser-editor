import { ExtrudeGeometry, Shape } from 'three'
import { pavingPolygons } from '../pathways/rendering/paving-polygons'
import type { PondNode } from './schema'
import { pondOutline } from './terrain'
import type { BorderRock } from './rock-border'

type Point = [number,number]
const LIMIT = 384

/** Low fitted coping, inspired by Pool's flat bevelled stones and corner ownership. */
export function pondStoneBorder(node: PondNode): BorderRock[] {
  const outline = pondOutline(node), offsets = node.rockBorderPlacement === 'both' ? [0,-node.bankWidth]
    : [node.rockBorderPlacement === 'outer' ? -node.bankWidth : 0]
  const rings = offsets.flatMap(offset => offset === 0 ? [outline] : pavingPolygons.inset([[outline]],offset).map(p => p[0]!))
    .map(ring => {
      const points = ring.map(p => [p[0]!,p[1]!] as Point)
      if (points.length > 1 && points[0]![0] === points.at(-1)![0] && points[0]![1] === points.at(-1)![1]) points.pop()
      const lengths = points.map((a,i) => { const b = points[(i+1)%points.length]!; return Math.hypot(b[0]-a[0],b[1]-a[1]) })
      const stations: number[] = []; let length = 0
      for (const segment of lengths) { stations.push(length); length += segment }
      const area = points.reduce((sum,a,i) => {const b=points[(i+1)%points.length]!;return sum+a[0]*b[1]-b[0]*a[1]},0)
      return { points,lengths,stations,length,orientation: area >= 0 ? 1 : -1 }
    }).filter(ring => ring.length > .001)
  const total = rings.reduce((sum,ring) => sum+ring.length,0)
  let seed = node.rockBorderSeed
  const random = () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  return rings.flatMap(ring => {
    const pitch = Math.max(node.rockBorderSize * 1.65,total / (LIMIT-rings.length))
    const count = Math.max(1,Math.floor(ring.length/pitch)), step = ring.length/count
    const tangent = (i: number): Point => {
      const a=ring.points[i]!,b=ring.points[(i+1)%ring.points.length]!,l=ring.lengths[i]!
      return [(b[0]-a[0])/(l||1),(b[1]-a[1])/(l||1)]
    }
    const sample = (station: number, offset: number): Point => {
      const s=((station%ring.length)+ring.length)%ring.length
      let edge=0
      while(edge<ring.stations.length-1 && ring.stations[edge+1]!<=s+1e-8)edge++
      const a=ring.points[edge]!,t=tangent(edge),d=s-ring.stations[edge]!
      let nx=t[1]*ring.orientation,nz=-t[0]*ring.orientation
      if(Math.abs(d)<1e-7){
        const prev=tangent((edge-1+ring.points.length)%ring.points.length)
        const px=prev[1]*ring.orientation,pz=-prev[0]*ring.orientation
        const dot=px*nx+pz*nz,denom=Math.max(.4,1+dot)
        nx=(nx+px)/denom;nz=(nz+pz)/denom
      }
      return [a[0]+t[0]*d+nx*offset,a[1]+t[1]*d+nz*offset]
    }
    // Assign sharp vertices to a single stone. Smooth outline samples need no corner pieces.
    const corners = ring.stations.filter((_,i) => {
      const a=tangent((i-1+ring.points.length)%ring.points.length),b=tangent(i)
      return a[0]*b[0]+a[1]*b[1]<.86
    })
    const circularDistance=(a:number,b:number)=>Math.min(Math.abs(a-b),ring.length-Math.abs(a-b))
    const centres: number[]=[]
    for(const corner of corners)if(centres.length<count&&centres.every(c=>circularDistance(c,corner)>step*.55))centres.push(corner)
    for(let i=0;i<count && centres.length<count;i++){
      const station=(i+.5)*step
      if(centres.every(c=>circularDistance(c,station)>step*.55))centres.push(station)
    }
    centres.sort((a,b)=>a-b)
    return centres.map((centre,i) => {
      const previous=i?centres[i-1]!:centres.at(-1)!-ring.length
      const next=i<centres.length-1?centres[i+1]!:centres[0]!+ring.length
      const gap=Math.min(node.rockBorderGap,Math.min(centre-previous,next-centre)*.15)
      const start=(previous+centre)/2+gap/2,end=(centre+next)/2-gap/2
      const stops=[start,...ring.stations.flatMap(v=>[v-ring.length,v,v+ring.length]).filter(v=>v>start+1e-7&&v<end-1e-7).sort((a,b)=>a-b),end]
      const width=node.rockBorderSize*(1+(random()-.5)*node.rockBorderVariation*.12)
      // Keep fitted end faces; break up the long outer edge like Pool's natural coping.
      const edgeStops = stops.flatMap((s,j) => j === stops.length-1 ? [s] : [s,(s+stops[j+1]!)/2])
      const outer=edgeStops.map((s,j)=>sample(s,width*(.75+(j%2 ? (random()-.5)*.12 : 0))))
      const inner=stops.map(s=>sample(s,-width*.25)).reverse()
      const point=sample(centre,0),height=Math.min(.16,node.rockBorderSize*.28)*(1+(random()-.5)*node.rockBorderHeightVariation*.2)
      return {x:point[0],z:point[1],size:width,angle:0,height,aspect:1,tiltX:0,tiltZ:0,
        shapeSeed:Math.floor(random()*0xffffffff),colorIndex:Math.floor(random()*8),stoneFootprint:[...outer,...inner]}
    })
  })
}

export function flatStoneGeometry(stone: BorderRock) {
  const shape=new Shape()
  stone.stoneFootprint!.forEach(([x,z],i)=>{if(i===0)shape.moveTo(x-stone.x,-z+stone.z);else shape.lineTo(x-stone.x,-z+stone.z)})
  shape.closePath()
  const bevel=Math.min(.025,stone.size*.065,stone.height*.22)
  const geometry=new ExtrudeGeometry(shape,{depth:stone.height,steps:1,curveSegments:1,bevelEnabled:true,
    bevelSegments:2,bevelSize:bevel,bevelThickness:bevel})
  geometry.rotateX(-Math.PI/2)
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere()
  return geometry
}

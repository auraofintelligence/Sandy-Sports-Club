const root='/assets/straddie-satellite/';
const tiles=new Map();
const views=new Set();
const region={west:153.02,east:153.90,south:-27.96,north:-27.08};
const layers=[
  {name:'island',west:153.22,north:-27.32,step:.10,columns:5,rows:5,minDensity:1800},
  {name:'detail',west:153.34,north:-27.36,step:.04,columns:6,rows:10,minDensity:8200}
];

function load(name){
  let tile=tiles.get(name);
  if(tile){
    tiles.delete(name);tiles.set(name,tile);
    return tile;
  }
  tile=new Image();
  tile.onload=tile.onerror=()=>{for(const redraw of views)redraw();};
  tiles.set(name,tile);
  if(tiles.size>48)tiles.delete(tiles.keys().next().value);
  tile.src=root+name+'.webp';
  return tile;
}

export function subscribeSatellite(redraw){
  views.add(redraw);
  return ()=>views.delete(redraw);
}

export function drawSatellite(ctx,x,y,width,height,span){
  const visible=(west,north,east,south)=>x(west)<width&&x(east)>0&&y(north)<height&&y(south)>0;
  if(!visible(region.west,region.north,region.east,region.south))return 'Outside satellite coverage. Showing the coastline.';
  let painted=false;
  function draw(name,west,north,east,south){
    const image=load(name);
    if(!image.complete||!image.naturalWidth)return;
    const left=x(west),top=y(north);
    ctx.drawImage(image,left,top,x(east)-left+.2,y(south)-top+.2);
    painted=true;
  }
  draw('region',region.west,region.north,region.east,region.south);
  for(const layer of layers){
    if(width/span<layer.minDensity||(layer.name==='detail'&&span>.18))continue;
    for(let row=0;row<layer.rows;row++){
      for(let col=0;col<layer.columns;col++){
        const west=layer.west+col*layer.step,north=layer.north-row*layer.step,east=west+layer.step,south=north-layer.step;
        if(visible(west,north,east,south))draw(layer.name+'-'+col+'-'+row,west,north,east,south);
      }
    }
  }
  if(painted)return 'Satellite · July to September 2017';
  return tiles.get('region')?.complete?'Satellite image unavailable. Showing the coastline.':'Loading satellite imagery…';
}

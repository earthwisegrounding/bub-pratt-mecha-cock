"""Copy prepared step-6 blockouts and geographic collision metadata into the browser build."""
import json, math, pathlib, shutil, sys
source=pathlib.Path(sys.argv[1]); dest=pathlib.Path(__file__).resolve().parents[1]/'public/assets/bremerton'
manifest=json.loads((source/'BremertonTiles/tiles.json').read_text()); origin=manifest['origin']; rows=[]
for row in manifest['tiles']:
    meta=json.loads((source/'BremertonTiles'/row['json']).read_text())
    scale=math.cos(math.radians(origin['lat']))/math.cos(math.radians(meta['center']['lat']))
    x=(meta['center']['lng']-origin['lng'])*111320*math.cos(math.radians(origin['lat']))
    z=-(meta['center']['lat']-origin['lat'])*110574
    y=meta['elevation']['centerElevationMetres']-manifest['baseElevationMetres']
    b=meta['bounds']; hx=(b['east']-b['west'])*111320*math.cos(math.radians(origin['lat']))/2; hz=(b['north']-b['south'])*110574/2
    shutil.copyfile(source/'BremertonTiles'/row['prepared'],dest/(row['id']+'.glb'))
    rows.append(dict(id=row['id'],offset=[x,y,z],scale=scale,bounds=[x-hx,z-hz,x+hx,z+hz],buildings=meta['buildings']))
(dest/'level.json').write_text(json.dumps(dict(origin=origin,tiles=rows),separators=(',',':')))
print('Imported',len(rows),'tiles;',sum(len(r['buildings']) for r in rows),'buildings')

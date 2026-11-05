"""Build the local garment library from the user-supplied vectors.zip.
Requires Pillow 11.3.0, numpy 2.0.2, scipy 1.13.1 and vtracer 0.6.15. Originals are byte-preserved.
Tracing is deterministic grayscale artwork conversion, not recovery of source vectors.
"""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import argparse, hashlib, json, re, tempfile, xml.etree.ElementTree as ET
from PIL import Image
import numpy as np
import vtracer
from scipy.ndimage import binary_fill_holes

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/garment-assets'

def category(name):
    n=name.lower()
    if any(k in n for k in ['hat','beanie','balaclava','ski mask']): return 'Headwear'
    if any(k in n for k in ['bag','backpack','tote','glasses','sock','skateboard']): return 'Accessories'
    if any(k in n for k in ['pants','jeans','shorts','sweats','denim joggers','flared denim','flares','slacks']): return 'Bottoms'
    if any(k in n for k in ['jacket','parka','puffer','vest','windbreaker','letterman']): return 'Outerwear'
    if 'hoodie' in n: return 'Hoodies'
    if any(k in n for k in ['sweater','cardigan','crew','turtle']): return 'Knitwear'
    return 'Tops'

def partitions(im):
    # Split only on transparent gutters; never cut through a garment silhouette.
    a=np.asarray(im);ink=(a[:,:,3]>128)&(a[:,:,:3].mean(axis=2)<240)
    bbox=Image.fromarray((ink*255).astype('uint8')).getbbox()
    im=im.crop(bbox)
    def split(box, depth=0):
        crop=im.crop(box);pixels=np.asarray(crop);a=(pixels[:,:,3]>128)&(pixels[:,:,:3].mean(axis=2)<240)
        if depth>=3: return [box]
        for axis in [0,1]:
            projection=a.any(axis=axis);size=len(projection)
            runs=[];start=None
            for i,filled in enumerate(projection):
                if not filled and start is None:start=i
                if filled and start is not None:
                    if i-start>=max(8,size*.005) and start>size*.1 and i<size*.9:runs.append((start,i))
                    start=None
            if not runs:continue
            segments=[];pos=0
            for lo,hi in runs:segments.append((pos,lo));pos=hi
            segments.append((pos,size))
            result=[]
            for lo,hi in segments:
                child=(box[0]+lo,box[1],box[0]+hi,box[3]) if axis==0 else (box[0],box[1]+lo,box[2],box[1]+hi)
                c=im.crop(child);pixels=np.asarray(c);ink=(pixels[:,:,3]>128)&(pixels[:,:,:3].mean(axis=2)<240)
                if ink.sum()<a.sum()*.06:continue
                bbox=Image.fromarray((ink*255).astype('uint8')).getbbox()
                if bbox:
                    child=(child[0]+bbox[0],child[1]+bbox[1],child[0]+bbox[2],child[1]+bbox[3])
                    result+=split(child,depth+1)
            return result
        return [box]
    return im, sorted(split((0,0,*im.size)),key=lambda b:(round(b[1]/max(1,im.height)*4),b[0]))

def parse_paths(svg):
    contours=[]
    for el in ET.fromstring(svg):
        if not el.tag.endswith('path'):continue
        tx,ty=map(float,re.findall(r'-?\d+(?:\.\d+)?',el.get('transform','translate(0,0)')))
        tokens=re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?',el.get('d',''))
        i=0;nodes=[]
        def point(x,y):return {'x':round(float(x)+tx,3),'y':round(float(y)+ty,3)}
        while i<len(tokens):
            cmd=tokens[i];i+=1
            if cmd=='M':
                if nodes:raise ValueError('unclosed path')
                nodes=[point(*tokens[i:i+2])];i+=2
            elif cmd=='L':nodes.append(point(*tokens[i:i+2]));i+=2
            elif cmd=='C':
                nodes[-1]['out']=point(*tokens[i:i+2]);p=point(*tokens[i+4:i+6]);p['in']=point(*tokens[i+2:i+4]);nodes.append(p);i+=6
            elif cmd=='Z':
                if len(nodes)>1 and abs(nodes[-1]['x']-nodes[0]['x'])<.01 and abs(nodes[-1]['y']-nodes[0]['y'])<.01:
                    if 'in' in nodes[-1]:nodes[0]['in']=nodes[-1]['in']
                    nodes.pop()
                if len(nodes)>=2:contours.append(nodes)
                nodes=[]
            else:raise ValueError('Unsupported path command '+cmd)
    return contours

def trace(im, temp):
    im=im.copy();im.thumbnail((1800,1800),Image.Resampling.LANCZOS)
    a=np.asarray(im);g=a[:,:,:3].mean(axis=2);valid=a[:,:,3]>=128
    inside=binary_fill_holes(valid & (g<240))
    colors=[('#cccccc',valid&(g>=160)&(g<240)),('#ffffff',valid&(g>=240)&inside),('#181818',valid&(g<160))]
    shapes=[]
    for color,mask in colors:
        if not mask.any():continue
        Image.fromarray(np.where(mask,0,255).astype('uint8')).save(temp/'mask.png')
        vtracer.convert_image_to_svg_py(str(temp/'mask.png'),str(temp/'trace.svg'),colormode='binary',mode='polygon',filter_speckle=0,length_threshold=3.5,corner_threshold=60,splice_threshold=45,path_precision=2)
        contours=parse_paths((temp/'trace.svg').read_text())
        if contours:shapes.append({'fill':color,'contours':contours})
    return {'width':im.width,'height':im.height,'shapes':shapes}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('archive',type=Path);ap.add_argument('--only');args=ap.parse_args()
    OUT.mkdir(exist_ok=True,parents=True);catalog=[]
    with ZipFile(args.archive) as z, tempfile.TemporaryDirectory() as d:
        temp=Path(d)
        for entry in sorted(z.infolist(),key=lambda x:x.filename.lower()):
            if entry.is_dir() or not entry.filename.lower().endswith('.png'):continue
            name=Path(entry.filename).stem
            if args.only and name!=args.only:continue
            if entry.file_size>20_000_000:raise ValueError('Oversized image')
            slug=re.sub('[^a-z0-9]+','-',name.lower()).strip('-');folder=OUT/slug;folder.mkdir(exist_ok=True)
            raw=z.read(entry);(folder/'original.png').write_bytes(raw)
            source=Image.open(BytesIO(raw)).convert('RGBA');source_size=list(source.size)
            if source.width*source.height>80_000_000:raise ValueError('Oversized canvas')
            im,boxes=partitions(source)
            thumb=im.copy();thumb.thumbnail((640,440),Image.Resampling.LANCZOS);thumb.save(folder/'preview.webp',lossless=True)
            views=[]
            for index,box in enumerate(boxes):
                crop=im.crop(box);data=trace(crop,temp);count=sum(len(c) for s in data['shapes'] for c in s['contours'])
                maxnodes=max(len(c) for s in data['shapes'] for c in s['contours'])
                if count>60000 or maxnodes>2000:raise ValueError(f'{name}: trace budget {count} / {maxnodes}')
                (folder/f'view-{index+1}.json').write_text(json.dumps(data,separators=(',',':')))
                small=crop.copy();small.thumbnail((420,440),Image.Resampling.LANCZOS);small.save(folder/f'view-{index+1}.webp',lossless=True)
                views.append({'label':'Side view' if 'side view' in name.lower() else f'View {index+1}','file':f'view-{index+1}.json','preview':f'view-{index+1}.webp','width':data['width'],'height':data['height'],'nodes':count})
            # Remove stale generated views when a source's segmentation is refined.
            expected={v['file'] for v in views}|{v['preview'] for v in views}
            for stale in folder.glob('view-*'):
                if stale.name not in expected:stale.unlink()
            catalog.append({'id':slug,'name':name,'category':category(name),'source':entry.filename,'sourceSize':source_size,'sha256':hashlib.sha256(raw).hexdigest(),'views':views})
            print(f'{name}: {len(views)} views / {sum(v["nodes"] for v in views)} nodes',flush=True)
    if not args.only:
        (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
        (OUT/'provenance.json').write_text(json.dumps({'archive':'vectors.zip','sha256':hashlib.sha256(args.archive.read_bytes()).hexdigest(),'sourceCount':len(catalog),'sourceFormat':'PNG','conversion':'VTracer 0.6.15, grayscale polygon trace, 1800 px maximum per view; automatic trace, not original vector paths','license':'User-supplied artwork; no third-party license was present in the archive. No new license is asserted.'},indent=2)+'\n')

if __name__=='__main__':main()

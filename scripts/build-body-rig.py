"""Pack the CC0 skeleton and exact interpolated skin weights for body revision 6.

First run build-detailed-anatomy.py --full-body --rig-sidecar and
build-reference-bodies.py --rig-sidecar. Both verify byte-identical historical
meshes before exporting; no nearest-neighbor correspondence is used.
"""
from pathlib import Path
import hashlib,json
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/anatomy';TEMP=ROOT/'.tools/anatomy'
for sex in ['male','female']:
    source=json.loads((TEMP/f'rig-source-{sex}.json').read_text())
    rows=np.load(TEMP/f'rig-v5-{sex}.npy'); count=len(source['bones']);n=len(rows)
    weights=rows[:,:count]
    assert np.isfinite(weights).all() and weights.min()>=-1e-12
    weights[weights<1e-10]=0
    weights/=weights.sum(axis=1)[:,None]
    ids,bones=np.nonzero(weights)
    values=weights[ids,bones].astype('<f4')
    offsets=np.concatenate([[0],np.cumsum(np.bincount(ids,minlength=n))]).astype('<u4')
    meta=json.loads((OUT/f'human-v6-{sex}.json').read_text());assert meta['vertexCount']==n
    old=json.loads((OUT/f'human-v5-{sex}.json').read_text())
    raw=(OUT/old['buffer']).read_bytes();v=np.frombuffer(raw[:n*48],'<f4').reshape(n,12)
    # Source-cumulative channels remain reproducible after all cuts.
    names=[b['name'] for b in source['bones']]
    def desc(i,root):
        while i>=0:
            if names[i]==root:return True
            i=source['bones'][i]['parent']
        return False
    maximum=0
    for side,k in [('L',0),('R',3)]:
        for c,root in enumerate(['upperarm01','lowerarm01','lowerleg01']):
            aggregate=weights[:,[i for i in range(count) if desc(i,root+'.'+side)]].sum(axis=1)
            maximum=max(maximum,float(np.max(np.abs(aggregate-v[:,6+k+c]))))
    # Source files round weights to 3 decimals, so normalize their small residual.
    assert maximum<.002,maximum
    blob=offsets.tobytes()+bones.astype('u1').tobytes()
    blob+=bytes((-len(blob))%4);weight_offset=len(blob)
    blob+=values.tobytes();chart_offset=len(blob);blob+=v[:,:3].astype('<f4').tobytes()
    name=f'rig-v6-{sex}';(OUT/f'{name}.bin').write_bytes(blob)
    info={'version':1,'license':'CC0','provenance':source['sourceSha256'],'sourceSkeletonSha256':hashlib.sha256((ROOT/'assets/anatomy/source/default.mhskel').read_bytes()).hexdigest(),'sourceWeightsSha256':hashlib.sha256((ROOT/'assets/anatomy/source/default_weights.mhw').read_bytes()).hexdigest(),'vertexCount':n,'bones':source['bones'],'influenceCount':len(values),'weightsOffset':weight_offset,'chartRestOffset':chart_offset,'byteLength':len(blob),'buffer':name+'.bin','sha256':hashlib.sha256(blob).hexdigest(),'correspondence':'Exact Catmull-Clark and edge-cut interpolation; historical source mesh byte identity verified. All nonzero bone weights retained. Revision 5 chart positions preserved.'}
    (OUT/f'{name}.json').write_text(json.dumps(info,indent=2)+'\n')
    meta['rig']=name+'.json';(OUT/f'human-v6-{sex}.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(sex,len(source['bones']),'bones',len(values),'influences',len(blob),'bytes; max cumulative residual',maximum,flush=True)
manifest=json.loads((ROOT/'assets/anatomy/hashes.json').read_text())
for f in OUT.iterdir():
    if f.is_file():manifest[f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
(ROOT/'assets/anatomy/hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')

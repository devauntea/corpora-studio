"""Blender worker for reproducible r9 fairing and matched clay QA renders.

Run through build-body-revision9.py, or pass `-- render` for QA. Rendering uses
the actual shipped vertex buffers; no subdivision or render-only displacement
is added. All comparisons share framing, camera, lights and material.
"""
from pathlib import Path
import json
import math
import sys
import bpy
import numpy as np
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT/'.tools/anatomy/r9'
QA = ROOT/'qa/body-018/sculpt-comparison'


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def mesh_object(name, vertices, tris):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices.tolist(), [], tris.tolist())
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def fair():
    for sex in ['male','female']:
        f = np.load(TEMP/f'input-{sex}.npz')
        d, tris, mask = f['original'], f['tris'], f['fair']
        result = {}
        for build in [0,1]:
            clear()
            p = d[:,:3]+d[:,3:6]*build
            obj = mesh_object(f'{sex} muscle fairing', p, tris)
            group = obj.vertex_groups.new(name='Protected muscle planes')
            for i in np.flatnonzero(mask > 1e-6):
                group.add([int(i)],float(mask[i]),'REPLACE')
            mod = obj.modifiers.new('Local fairing, fixed cut rims','SMOOTH')
            mod.factor=.5
            mod.iterations=18
            mod.vertex_group=group.name
            bpy.ops.object.modifier_apply(modifier=mod.name)
            q=np.empty(len(p)*3,np.float32)
            obj.data.vertices.foreach_get('co',q)
            q=q.reshape(-1,3).astype(np.float64)
            q[mask==0]=p[mask==0]
            q[f['rim']]=p[f['rim']]
            result[f'build{build}']=q
        np.savez(TEMP/f'faired-{sex}.npz',**result)
        print(f'Faired {sex} through Blender {bpy.app.version_string}',flush=True)


def load(revision, sex, build):
    out=ROOT/'public/anatomy'
    m=json.loads((out/f'human-v{revision}-{sex}.json').read_text())
    raw=(out/m['buffer']).read_bytes()
    n=m['vertexCount']
    d=np.frombuffer(raw[:n*48],'<f4').reshape(n,12)
    p=(d[:,:3]+d[:,3:6]*build).copy()
    t=np.frombuffer(raw[n*48:],'<u4').reshape(-1,3)
    parts=[];off=0
    for c in m['partCounts']:
        parts.append(t[off:off+c//3]);off+=c//3
    return p,parts


def point(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def render():
    QA.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=820
    scene.render.resolution_y=1100
    scene.render.resolution_percentage=100
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.035,.035,.04,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    material=bpy.data.materials.new('Neutral clay for identical comparison')
    material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(.43,.40,.37,1)
    bsdf.inputs['Roughness'].default_value=.53
    specs=[('back',8,180),('arm-front',1,18),('arm-back',1,170),('leg-front',6,22),('leg-back',6,172)]
    records=[]
    for sex in ['male','female']:
      for build in [1]:
       for label,part,yaw in specs:
        a,parts=load(8,sex,build)
        tri=parts[part]
        used=np.unique(tri)
        # Presentation-only rotation makes the isolated arm vertical. All
        # shipped coordinates stay unchanged, and both revisions share it.
        rotation=np.eye(3)
        if part == 1:
            m=json.loads((ROOT/f'public/anatomy/human-v8-{sex}.json').read_text())
            j=m['joints']['L']
            axis=np.asarray(j['wrist'])-np.asarray(j['shoulder'])
            rz=-math.pi/2-math.atan2(axis[1],axis[0])
            rotation=np.array([[math.cos(rz),-math.sin(rz),0],[math.sin(rz),math.cos(rz),0],[0,0,1]])
            a=a@rotation.T
        lo,hi=a[used].min(0),a[used].max(0)
        center=(lo+hi)/2
        height=float(hi[1]-lo[1])
        angle=math.radians(yaw)
        forward=np.array([math.sin(angle),0,math.cos(angle)])
        right=np.array([math.cos(angle),0,-math.sin(angle)])
        up=np.array([0,1,0])
        for revision in [8,9]:
            clear()
            p,parts=load(revision,sex,build)
            p=p@rotation.T
            obj=mesh_object(f'{sex} r{revision} {label}',p,tri)
            obj.data.materials.append(material)
            camera_data=bpy.data.cameras.new('Matched orthographic camera')
            camera=bpy.data.objects.new('Matched orthographic camera',camera_data)
            bpy.context.collection.objects.link(camera)
            camera.location=Vector(center+forward*height*2.8)
            # Explicit Y-up frame; Blender's generic track quaternion uses
            # Z-up in rear views and would roll these studies upside down.
            camera.rotation_euler=Matrix(np.stack([right,up,forward],axis=1).tolist()).to_euler()
            camera_data.type='ORTHO'
            width=float(np.ptp((a[used]-center)@right))
            camera_data.ortho_scale=max(height,width*1100/820)*1.12
            scene.camera=camera
            for name,dx,dy,dz,power,size in [('Key',-1.0,.8,.85,1700,.85),('Fill',1,.25,1,350,1.4),('Rim',.7,.5,-1,1100,.7)]:
                light_data=bpy.data.lights.new(name,'AREA')
                light_data.energy=power*(height/8)**2
                light_data.shape='DISK';light_data.size=height*size*.55
                light=bpy.data.objects.new(name,light_data)
                bpy.context.collection.objects.link(light)
                light.location=Vector(center+(right*dx+up*dy+forward*dz)*height)
                point(light,center)
            path=QA/f'{sex}-fit-r{revision}-{label}.png'
            scene.render.filepath=str(path)
            bpy.ops.render.render(write_still=True)
            records.append({'sex':sex,'build':'fit','revision':revision,'view':label,'path':str(path.relative_to(ROOT))})
    (QA/'renders.json').write_text(json.dumps({'renderer':bpy.app.version_string,'samples':24,'renderOnlyGeometry':False,'comparisons':records},indent=2)+'\n')


mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'fair'
{'fair':fair,'render':render}[mode]()

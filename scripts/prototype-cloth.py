"""External Blender cloth experiment only; Blender and its code are not shipped.
Run with factory startup and --disable-autoexec. Writes measured solver output.
"""
import bpy,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
vertices=[];faces=[];edges=[];n=12
for panel in range(2):
 offset=len(vertices)
 for row in range(n+1):
  for col in range(n+1):vertices.append((-.34+col*.3/n+panel*.38,0,.7-row*.5/n))
 for row in range(n):
  for col in range(n):
   a=offset+row*(n+1)+col;faces.append((a,a+1,a+n+2,a+n+1))
for row in range(n+1):edges.append((row*(n+1)+n,(n+1)**2+row*(n+1)))
mesh=bpy.data.meshes.new('Independent prototype grid');mesh.from_pydata(vertices,edges,faces);mesh.update()
obj=bpy.data.objects.new('Sewing experiment',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
pins=obj.vertex_groups.new(name='Pins');pins.add([0,(n+1)**2+n],1,'REPLACE')
cloth=obj.modifiers.new('Cloth','CLOTH');cloth.settings.quality=8;cloth.settings.mass=.18;cloth.settings.use_sewing_springs=True;cloth.settings.sewing_force_max=10;cloth.settings.vertex_group_mass=pins.name
cloth.point_cache.frame_start=1;cloth.point_cache.frame_end=45
for frame in range(1,46):bpy.context.scene.frame_set(frame)
evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=evaluated.to_mesh();gaps=[(m.vertices[a].co-m.vertices[b].co).length*1000 for a,b in edges]
result={'tool':'External Blender 4.5.9 cloth sewing prototype','frames':45,'initial_gap_mm':80,'final_mean_gap_mm':sum(gaps)/len(gaps),'final_max_gap_mm':max(gaps),'finite':all(math.isfinite(x) for v in m.vertices for x in v.co),'physical_validation':False}
evaluated.to_mesh_clear();out=root/'.tools/anatomy/cloth-prototype.json';out.write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)

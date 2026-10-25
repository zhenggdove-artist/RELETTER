# Bake the supplied OBJ surface and matching FBX run into a shared GPU point animation.
import bpy,sys,json,random,math,struct
from pathlib import Path
from mathutils import Vector
src=Path(sys.argv[sys.argv.index('--')+1]);out=Path('art');rng=random.Random(7342)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(src/'吊嘎阿伯原始.obj'));obj=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.ops.import_scene.fbx(filepath=str(src/'跑動.fbx'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');skin=next(o for o in bpy.data.objects if o.type=='MESH' and o!=obj)
assert len(obj.data.vertices)==len(skin.data.vertices)
assert max((a.co-b.co).length for a,b in zip(obj.data.vertices,skin.data.vertices))<1e-6
for group in skin.vertex_groups:obj.vertex_groups.new(name=group.name)
for v in skin.data.vertices:
 for g in v.groups:obj.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
obj.parent=rig;obj.matrix_world=skin.matrix_world.copy();mod=obj.modifiers.new('Skeleton','ARMATURE');mod.object=rig;bpy.data.objects.remove(skin,do_unlink=True)
obj.data.calc_loop_triangles();triangles=list(obj.data.loop_triangles);weights=[]
for t in triangles:
 center=sum((obj.data.vertices[i].co for i in t.vertices),Vector())/3
 weights.append(t.area*(12 if center.y>.355 and center.x>.015 else 1))
samples=[];uv=[];face=[];norm=[];mask=[]
for t in rng.choices(triangles,weights=weights,k=24000):
 a=math.sqrt(rng.random());b=rng.random();bary=(1-a,a*(1-b),a*b);v=sum((obj.data.vertices[i].co*w for i,w in zip(t.vertices,bary)),Vector());samples.append((list(t.vertices),bary));tex=sum((obj.data.uv_layers.active.data[i].uv*w for i,w in zip(t.loops,bary)),Vector((0,0)));uv.extend(tex);face.extend([-(v.z-.002)/.065,(v.y-.438)/.065]);mask.append(1 if v.x>.015 and v.y>.355 else 0);n=sum((obj.data.vertices[i].normal*w for i,w in zip(t.vertices,bary)),Vector()).normalized();norm.extend([-n.z,n.y,n.x])
# World is Blender Z-up; game conversion x=-world.y, y=world.z, z=world.x.
rig.data.pose_position='REST';bpy.context.view_layer.update();ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());rest=[ev.matrix_world@v.co for v in ev.data.vertices];low=min(v.z for v in rest);height=max(v.z for v in rest)-low;scale=7.3/height
restHip=rig.matrix_world@rig.pose.bones['mixamorig:Hips'].head;restRotation=(rig.matrix_world@rig.pose.bones['mixamorig:Hips'].matrix).to_quaternion();rig.data.pose_position='POSE';start,end=rig.animation_data.action.frame_range;frames=20;positions=[]
for f in range(frames):
 bpy.context.scene.frame_set(int(start+(end-start)*f/frames));bpy.context.view_layer.update();ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());verts=[ev.matrix_world@v.co for v in ev.data.vertices]
 # Remove horizontal root motion while retaining articulated run.
 hip=rig.matrix_world@rig.pose.bones['mixamorig:Hips'].head;forward=((rig.matrix_world@rig.pose.bones['mixamorig:Hips'].matrix).to_quaternion()@restRotation.inverted())@Vector((1,0,0));yaw=math.atan2(forward.y,forward.x)
 for inds,bary in samples:
  v=sum((verts[i]*w for i,w in zip(inds,bary)),Vector());dx=v.x-hip.x;dy=v.y-hip.y;xx=dx*math.cos(yaw)+dy*math.sin(yaw);yy=-dx*math.sin(yaw)+dy*math.cos(yaw);positions.extend([-yy*scale,(v.z-hip.z+restHip.z-low)*scale,xx*scale])
(out/'guardian-run.bin').write_bytes(struct.pack('<%sf'%len(positions),*positions))
(out/'guardian-points.json').write_text(json.dumps({'count':24000,'frames':frames,'uv':uv,'face':face,'normal':norm,'mask':mask},separators=(',',':')))
# Copy authored bitmap unchanged; projection is performed in shaders.
import shutil
shutil.copyfile(src/'tripo_node_527721b1-5774-4c1b-a1cb-908580b153ba_BaseColor.jpg',out/'guardian-body.jpg')
print('BAKED',len(samples),'points',frames,'frames',height)

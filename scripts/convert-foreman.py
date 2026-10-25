# Convert the user's OBJ with the exact matching FBX skin weights; never modify source assets.
import bpy,sys
from pathlib import Path
src=Path(sys.argv[sys.argv.index('--')+1]);out=Path('art/foreman-rig.glb').resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(src/'原始中年男子.obj'))
obj=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.ops.import_scene.fbx(filepath=str(src/'跑步.fbx'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');skin=next(o for o in bpy.data.objects if o.type=='MESH' and o!=obj)
assert len(obj.data.vertices)==len(skin.data.vertices)
assert max((a.co-b.co).length for a,b in zip(obj.data.vertices,skin.data.vertices))<1e-6
for group in skin.vertex_groups:obj.vertex_groups.new(name=group.name)
for v in skin.data.vertices:
 for g in v.groups:obj.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
obj.parent=rig;obj.matrix_world=skin.matrix_world.copy();mod=obj.modifiers.new('Matched FBX skeleton','ARMATURE');mod.object=rig
bpy.data.objects.remove(skin,do_unlink=True)
run=rig.animation_data.action;run.name='Run'
before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(src/'踢ATTACK.fbx'))
other=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o!=rig);kick=other.animation_data.action;kick.name='Kick';kick.use_fake_user=True
for o in list(set(bpy.data.objects)-before):bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data.action=None
for action in [run,kick]:
 track=rig.animation_data.nla_tracks.new();track.name=action.name;track.strips.new(action.name,1,action)
# Keep original topology/UV but use smooth normals; authored material with modest roughness.
for poly in obj.data.polygons:poly.use_smooth=True
for mat in obj.data.materials:
 if mat.use_nodes:
  bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if bs:bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.82
obj.name='User_OBJ_Foreman';rig.name='ForemanRig'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_apply=False)
print('EXPORTED',out,out.stat().st_size,'vertices',len(obj.data.vertices))

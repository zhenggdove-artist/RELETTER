"""
Convert Mixamo FBX files to separate GLB files:
  - character.glb  = mesh + armature from first FBX (no animation)
  - anim_idle.glb  = idle animation only
  - anim_drink.glb = drink animation only
  - anim_jump.glb  = jump animation only
Run with: blender --background --python convert_all.py
"""
import bpy, os, sys

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playermodel')
OUT = os.path.dirname(os.path.abspath(__file__))

ANIMS = [
    ('Breathing Idle.fbx', 'anim_idle.glb'),
    ('Drinking.fbx',       'anim_drink.glb'),
    ('Jumping.fbx',        'anim_jump.glb'),
]

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def export_glb(path, anims=True):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=anims,
        export_apply=False,
        export_image_format='NONE',
    )
    print(f'  -> {os.path.basename(path)} ({os.path.getsize(path)//1024}KB)')

# 1) Export character mesh from the idle FBX
print('=== Exporting character mesh ===')
clear()
bpy.ops.import_scene.fbx(filepath=os.path.join(DIR, 'Breathing Idle.fbx'))
# Remove all animations from this export
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
export_glb(os.path.join(OUT, 'character.glb'), anims=False)

# 2) Export each animation (armature only, no mesh)
for fbx, out in ANIMS:
    print(f'=== Exporting {fbx} -> {out} ===')
    clear()
    bpy.ops.import_scene.fbx(filepath=os.path.join(DIR, fbx))
    # Remove mesh objects to keep only armature + animation
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in bpy.data.meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for mat in bpy.data.materials:
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for img in bpy.data.images:
        if img.users == 0:
            bpy.data.images.remove(img)
    export_glb(os.path.join(OUT, out), anims=True)

print('=== Done! ===')

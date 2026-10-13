import bpy
import sys
import os

argv = sys.argv
argv = argv[argv.index("--") + 1:]
input_fbx = argv[0]
output_glb = argv[1]

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
bpy.ops.import_scene.fbx(filepath=input_fbx)

# Delete all mesh objects, keep only armature
for obj in list(bpy.data.objects):
    if obj.type == 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)

# Clean up orphan data
for mesh in bpy.data.meshes:
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
for mat in bpy.data.materials:
    if mat.users == 0:
        bpy.data.materials.remove(mat)
for img in bpy.data.images:
    if img.users == 0:
        bpy.data.images.remove(img)

# Export as GLB - animation only (no mesh)
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format='GLB',
    export_animations=True,
    export_apply=False,
    export_image_format='NONE',
)

print(f"Converted {input_fbx} -> {output_glb}")

"""
Export optimized character mesh: strip textures, decimate, Draco compress.
Run with: blender --background --python convert_char.py
"""
import bpy, os

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playermodel')
OUT = os.path.dirname(os.path.abspath(__file__))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(DIR, 'Breathing Idle.fbx'))

# Remove all animations
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# Strip all textures and images, set simple pastel materials
for mat in bpy.data.materials:
    if mat.node_tree:
        for node in list(mat.node_tree.nodes):
            if node.type == 'TEX_IMAGE':
                mat.node_tree.nodes.remove(node)
        # Set base color to pastel
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Base Color'].default_value = (0.85, 0.75, 0.78, 1.0)  # pastel pink
                node.inputs['Roughness'].default_value = 0.8
                node.inputs['Metallic'].default_value = 0.0

for img in list(bpy.data.images):
    bpy.data.images.remove(img)

# Decimate mesh objects to reduce poly count
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = 0.15  # 15% of original polys
        bpy.ops.object.modifier_apply(modifier='Decimate')

# Export without Draco (avoid needing decoder on client)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'character.glb'),
    export_format='GLB',
    export_animations=False,
    export_apply=False,
    export_image_format='NONE',
)

size = os.path.getsize(os.path.join(OUT, 'character.glb'))
print(f'character.glb: {size//1024}KB')

"""
Create a single GLB with character mesh + textures + all animations.
Manually assigns textures from playermodel/ directory.
Run with: blender --background --python convert_combined.py
"""
import bpy, os

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playermodel')
OUT = os.path.dirname(os.path.abspath(__file__))

# Texture files
TEX_BASE = os.path.join(DIR, 'tripo_model_basecolor.JPEG')
TEX_METAL = os.path.join(DIR, 'tripo_model_metallic.JPEG')
TEX_NORMAL = os.path.join(DIR, 'tripo_model_normal.JPEG')
TEX_ROUGH = os.path.join(DIR, 'tripo_model_roughness.JPEG')

# Step 1: Import character from idle FBX
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(DIR, 'Breathing Idle.fbx'))

armature = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

# Rename idle action
for action in bpy.data.actions:
    action.name = 'idle'

# Step 2: Import additional animations
for fbx_name, action_name in [
    ('Drinking.fbx', 'drink'),
    ('Walking.fbx', 'walk'),
    ('Running.fbx', 'run'),
    ('Jumping.fbx', 'jump'),
    ('Falling.fbx', 'fall'),
]:
    existing = set(a.name for a in bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.join(DIR, fbx_name))
    for action in bpy.data.actions:
        if action.name not in existing:
            action.name = action_name
    # Remove duplicate armatures
    for obj in list(bpy.data.objects):
        if obj != armature and obj.type == 'ARMATURE':
            bpy.data.objects.remove(obj, do_unlink=True)

# Remove duplicate meshes (keep only the first set)
seen = set()
for obj in list(bpy.data.objects):
    if obj.type == 'MESH':
        base = obj.name.split('.')[0]
        if base in seen:
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            seen.add(base)

# Step 3: Create proper material with textures
def load_tex(path, color_space='sRGB'):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = color_space
    img.pack()
    return img

mat = bpy.data.materials.new(name='CharSkin')
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

# Principled BSDF
bsdf = nodes.new('ShaderNodeBsdfPrincipled')
bsdf.location = (0, 0)
output = nodes.new('ShaderNodeOutputMaterial')
output.location = (300, 0)
links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

# Base Color texture
if os.path.exists(TEX_BASE):
    tex_base = nodes.new('ShaderNodeTexImage')
    tex_base.image = load_tex(TEX_BASE, 'sRGB')
    tex_base.location = (-400, 200)
    links.new(tex_base.outputs['Color'], bsdf.inputs['Base Color'])

# Metallic texture
if os.path.exists(TEX_METAL):
    tex_metal = nodes.new('ShaderNodeTexImage')
    tex_metal.image = load_tex(TEX_METAL, 'Non-Color')
    tex_metal.location = (-400, -100)
    links.new(tex_metal.outputs['Color'], bsdf.inputs['Metallic'])

# Roughness texture
if os.path.exists(TEX_ROUGH):
    tex_rough = nodes.new('ShaderNodeTexImage')
    tex_rough.image = load_tex(TEX_ROUGH, 'Non-Color')
    tex_rough.location = (-400, -400)
    links.new(tex_rough.outputs['Color'], bsdf.inputs['Roughness'])

# Normal map
if os.path.exists(TEX_NORMAL):
    tex_norm = nodes.new('ShaderNodeTexImage')
    tex_norm.image = load_tex(TEX_NORMAL, 'Non-Color')
    tex_norm.location = (-700, -700)
    norm_map = nodes.new('ShaderNodeNormalMap')
    norm_map.location = (-400, -700)
    links.new(tex_norm.outputs['Color'], norm_map.inputs['Color'])
    links.new(norm_map.outputs['Normal'], bsdf.inputs['Normal'])

# Assign material to all mesh objects
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.data.materials.clear()
        obj.data.materials.append(mat)

# Decimate
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = 0.3
        bpy.ops.object.modifier_apply(modifier='Decimate')

# Clear NLA tracks
if armature and armature.animation_data:
    for track in list(armature.animation_data.nla_tracks):
        armature.animation_data.nla_tracks.remove(track)

# Push each action to NLA as separate tracks
armature.animation_data_create()
for action in bpy.data.actions:
    track = armature.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, int(action.frame_range[0]), action)
    strip.action = action
    track.mute = False

print(f'Actions: {[a.name for a in bpy.data.actions]}')
print(f'NLA tracks: {[t.name for t in armature.animation_data.nla_tracks]}')
print(f'Materials: {[m.name for m in bpy.data.materials]}')
print(f'Images: {[i.name for i in bpy.data.images]}')

# Export
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'character.glb'),
    export_format='GLB',
    export_animations=True,
    export_apply=False,
    export_image_format='AUTO',
    export_nla_strips=True,
    export_animation_mode='NLA_TRACKS',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
)

size = os.path.getsize(os.path.join(OUT, 'character.glb'))
print(f'character.glb: {size//1024}KB')

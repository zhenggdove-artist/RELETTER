"""Inspect GLB files for bone names and animation tracks."""
import bpy, os, sys

DIR = os.path.dirname(os.path.abspath(__file__))
files = ['character.glb', 'anim_idle.glb', 'anim_drink.glb', 'anim_jump.glb']

for f in files:
    path = os.path.join(DIR, f)
    if not os.path.exists(path): continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    print(f'\n=== {f} ===')
    for obj in bpy.data.objects:
        print(f'  Object: {obj.name} (type={obj.type})')
        if obj.type == 'ARMATURE':
            for bone in obj.data.bones:
                print(f'    Bone: {bone.name}')
    for action in bpy.data.actions:
        print(f'  Action: {action.name} ({len(action.fcurves)} curves, {action.frame_range})')
        # Print first 3 track names
        for i, fc in enumerate(action.fcurves[:3]):
            print(f'    Track: {fc.data_path}')
        if len(action.fcurves) > 3:
            print(f'    ... and {len(action.fcurves)-3} more')

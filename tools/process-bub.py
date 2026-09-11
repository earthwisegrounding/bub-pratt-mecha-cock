import bpy,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'; OUT.mkdir(exist_ok=True)
MAP={'bub': {'Walking': 'walk', 'Running': 'run', 'Punch_Combo': 'punch', 'Spartan_Kick': 'kick', 'Jump_Over_Obstacle_2': 'jump', 'Squat_Stance': 'idle', 'Block6': 'hit', 'Fall_Dead_from_Abdominal_Injury': 'death', 'Boom_Dance': 'dance1', 'Bubble_Dance': 'dance2', 'Cherish_Pop_Dance': 'dance3', 'Denim_Pop_Dance': 'dance4', 'Hip_Hop_Dance_1': 'dance5', 'Hip_Hop_Dance_3': 'dance6', 'Superlove_Pop_Dance': 'dance7'}, 'rooster': {'Walking': 'walk', 'Running': 'run', 'Attack': 'attack', 'Block6': 'block', 'Dead': 'death', 'Stand_Up7': 'intro', 'falling_down': 'stumble'}}
report={}
for character,clips in MAP.items():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 base=None;keep=[];actions=[]
 for source,name in clips.items():
  before=set(bpy.data.objects)
  path=next((ROOT/'.source'/character).rglob('*Animation_'+source+'_withSkin.glb'))
  bpy.ops.import_scene.gltf(filepath=str(path))
  objs=set(bpy.data.objects)-before
  arm=next(o for o in objs if o.type=='ARMATURE')
  action=arm.animation_data.action;action.name=name;action.use_fake_user=True
  # Preserve authored motion in the pose; strip horizontal root travel so gameplay owns displacement.
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      if (fc.data_path=='location' or fc.data_path=='pose.bones["pelvis"].location') and fc.array_index in [0,1]:
       first=fc.keyframe_points[0].co.y if fc.keyframe_points else 0
       for k in fc.keyframe_points:k.co.y=first;k.handle_left.y=first;k.handle_right.y=first
  actions.append(action)
  if base is None:
   base=arm;keep=[o for o in objs if o.type in ['ARMATURE','MESH'] and o.name!='Icosphere']
   for o in list(objs):
    if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
  else:
   for o in objs:bpy.data.objects.remove(o,do_unlink=True)
 # Drop duplicate one-frame actions and duplicate skin textures.
 base.animation_data_clear();base.animation_data_create()
 for a in list(bpy.data.actions):
  if a not in actions:bpy.data.actions.remove(a)
 for action in actions:
  track=base.animation_data.nla_tracks.new();track.name=action.name
  strip=track.strips.new(action.name,int(action.frame_range[0]),action);strip.action_slot=action.slots[0]
  strip.action_frame_start=action.frame_range[0];strip.action_frame_end=action.frame_range[1]
  track.mute=True
 for o in keep:
  if o.type=='MESH' and len(o.data.vertices)>35000:
   bpy.context.view_layer.objects.active=o
   mod=o.modifiers.new('Mobile mesh budget','DECIMATE');mod.ratio=30000/len(o.data.vertices)
   bpy.ops.object.modifier_apply(modifier=mod.name)
 for image in bpy.data.images:
  if image.size[0]>1024:
   image.scale(1024,1024);image.pack()
 bpy.ops.object.select_all(action='DESELECT')
 for o in keep:o.select_set(True)
 bpy.context.view_layer.objects.active=base
 bpy.ops.export_scene.gltf(filepath=str(OUT/(character+'.glb')),use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=82)
 report[character]={'clips':{a.name:round((a.frame_range[1]-a.frame_range[0])/bpy.context.scene.render.fps,3) for a in actions},'meshes':[{ 'name':o.name,'vertices':len(o.data.vertices)} for o in keep if o.type=='MESH']}
(OUT/'characters.json').write_text(json.dumps(report,indent=2))
print('CHARACTER_REPORT',json.dumps(report))

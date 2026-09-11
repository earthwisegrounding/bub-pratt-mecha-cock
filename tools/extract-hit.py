"""Extract Bub's supplied Block6 reaction before running process-bub.py.
Usage: python3 tools/extract-hit.py /path/to/Meshy_AI_Meshy_Merged_Animations.glb
"""
import json, pathlib, struct, sys
source=pathlib.Path(sys.argv[1]).read_bytes()
length=struct.unpack_from('<I',source,12)[0]
doc=json.loads(source[20:20+length])
doc['animations']=[a for a in doc['animations'] if a.get('name')=='Block6']
if len(doc['animations'])!=1:raise ValueError('Expected exactly one Block6 reaction')
raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*(-len(raw)%4)
tail=source[20+length:]
out=struct.pack('<III',0x46546c67,2,20+len(raw)+len(tail))+struct.pack('<II',len(raw),0x4e4f534a)+raw+tail
path=pathlib.Path(__file__).resolve().parents[1]/'.source/bub/Meshy_Animation_Block6_withSkin.glb'
path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(out)

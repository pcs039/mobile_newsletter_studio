/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic isolated publication fixtures. */
const {randomUUID}=require('node:crypto');
const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',asset='33333333-3333-4333-8333-333333333333';
function capture(){return {
 project:{id:p,title:'소식지',primary_color:'#113355',title_font_asset_id:null,body_font_asset_id:null},
 article:{id:a,project_id:p,title:'기사',body:'본문',summary:'요약',article_type:'general',publication_kind:'regular',audio_source:'none',public_info:{},updated_at:'2026-10-21T00:00:00+00:00'},
 blocks:[{id:randomUUID(),project_id:p,article_id:a,block_type:'paragraph',body:'문단',sort_order:10,metadata:{},is_visible:true}],
 links:[],compositions:[],placements:[],assets:[],photos:[],fonts:[],audio:[]
};}
function image(c){c.blocks.push({id:randomUUID(),project_id:p,article_id:a,block_type:'image',title:'사진',body:`projects/${p}/original.png`,asset_id:asset,sort_order:20,is_visible:true,metadata:{}});
 c.assets.push({id:asset,project_id:p,asset_type:'illustration',is_active:true,approval_status:'approved',storage_bucket:'a2-isolated-source',storage_path:`projects/${p}/original.png`,mime_type:'image/png'});c.photos.push({id:asset,project_id:p,file_path:`projects/${p}/original.png`,mime_type:"image/png",is_approved:true,storage_bucket:"a2-isolated-source"});return c;}
function wav(){const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;}
function syntheticFont({ family = 'NanumGothic', subfamily = 'Regular', weight = 400, variable = false, italic = false, format = 'ttf' } = {}) {
  const values = [[1, family], [2, subfamily], [4, family + ' ' + subfamily], [5, 'Version 1.000'], [6, family + '-' + subfamily]];
  const encoded = values.map(([, value]) => { const b = Buffer.from(value, 'utf16le'); return b.swap16(); });
  const names = Buffer.alloc(6 + values.length * 12 + encoded.reduce((sum, b) => sum + b.length, 0));
  names.writeUInt16BE(values.length, 2); names.writeUInt16BE(6 + values.length * 12, 4);
  let offset = 0;
  values.forEach(([id], index) => {
    const pos = 6 + index * 12;
    [3, 1, 0x409, id, encoded[index].length, offset].forEach((n, j) => names.writeUInt16BE(n, pos + j * 2));
    encoded[index].copy(names, 6 + values.length * 12 + offset); offset += encoded[index].length;
  });
  const os2 = Buffer.alloc(96); os2.writeUInt16BE(weight, 4); if (italic) os2.writeUInt16BE(1, 62);
  const maxp = Buffer.alloc(32); maxp.writeUInt32BE(0x10000); maxp.writeUInt16BE(1, 4);
  const tables = { name: names, 'OS/2': os2, maxp };
  if (variable) { const fvar = Buffer.alloc(36); fvar.writeUInt32BE(0x10000); fvar.writeUInt16BE(16, 4); fvar.writeUInt16BE(2, 6); fvar.writeUInt16BE(1, 8); fvar.writeUInt16BE(20, 10); fvar.write('wght', 16); fvar.writeInt32BE(100 * 65536, 20); fvar.writeInt32BE(400 * 65536, 24); fvar.writeInt32BE(900 * 65536, 28); tables.fvar = fvar; }
  const data = Buffer.alloc(12 + Object.keys(tables).length * 16 + Object.values(tables).reduce((sum, b) => sum + Math.ceil(b.length / 4) * 4, 0));
  if (format === 'otf') data.write('OTTO'); else data.writeUInt32BE(0x10000);
  data.writeUInt16BE(Object.keys(tables).length, 4); let start = 12 + Object.keys(tables).length * 16;
  Object.entries(tables).forEach(([name, bytes], index) => { const pos = 12 + index * 16; data.write(name, pos); data.writeUInt32BE(start, pos + 8); data.writeUInt32BE(bytes.length, pos + 12); bytes.copy(data, start); start += Math.ceil(bytes.length / 4) * 4; });
  return data;
}

module.exports={p,a,asset,capture,image,wav,syntheticFont};

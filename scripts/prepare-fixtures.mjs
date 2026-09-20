// Isolated local QA workspace. This directory must never be deployed.
import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('.test-build');await fs.mkdir(root,{recursive:true});
for(const name of ['src','public','scripts','contracts'])await fs.cp(name,path.join(root,name),{recursive:true,force:true});
for(const name of ['package.json','astro.config.mjs','tsconfig.json'])await fs.copyFile(name,path.join(root,name));
try{await fs.symlink(path.resolve('node_modules'),path.join(root,'node_modules'),'dir')}catch{}
await fs.mkdir(path.join(root,'content/entries'),{recursive:true});await fs.copyFile('content/taxonomy.json',path.join(root,'content/taxonomy.json'));
const site=JSON.parse(await fs.readFile('content/site.json','utf8'));site.mediaBaseUrl='http://127.0.0.1:4322/projects/promptbook';site.name='Promptbook · 本地视觉验收';await fs.writeFile(path.join(root,'content/site.json'),JSON.stringify(site));
const template=JSON.parse(await fs.readFile('templates/image-entry.example.json','utf8'));
const images=['01-gallery-desktop.png','02-detail-desktop.png','03-editor-desktop.png','04-gallery-mobile.png'];
for(let i=0;i<images.length;i++){
 const bytes=await fs.readFile('prototype/screenshots/'+images[i]);const entry=structuredClone(template);entry.id=`visual-fixture-${i+1}`;entry.title=`视觉验收 ${i+1} · 布局素材，非模型实测`;entry.prompt.text=`本地测试原文 ${i+1}\n中文🙂 <script>alert(1)</script>\n\`code\`  两个空格\n${'检查长段落和换行。'.repeat(30)}`;entry.category=i%2?'space':'product';entry.generation.modelLabel=i%2?'测试模型 B（非实测）':'测试模型 A（非实测）';entry.tags=['fixture'];entry.createdAt=`2026-09-${16+i}T00:00:00Z`;entry.outputs[0].width=bytes.readUInt32BE(16);entry.outputs[0].height=bytes.readUInt32BE(20);const key=`published/${entry.id}/${'a'.repeat(32)}.png`;const asset={key,mimeType:'image/png',bytes:bytes.length,sha256:null};entry.outputs[0].original=asset;entry.outputs[0].thumbnail=asset;entry.outputs[0].preview=asset;entry.outputs[0].alt='用于布局验收的界面截图，不是模型输出';await fs.mkdir(path.join(root,'public/published',entry.id),{recursive:true});await fs.writeFile(path.join(root,'public',key),bytes);await fs.writeFile(path.join(root,'content/entries',entry.id+'.json'),JSON.stringify(entry,null,2));
}
console.log('Fixture workspace: .test-build (never production content)');

// Keep the downloadable single-file app and reusable module byte-for-byte aligned.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),file=path.join(root,'index.html');
const source=fs.readFileSync(path.join(root,'data/tripin-data.cjs'),'utf8');
assert(!/<\/script/i.test(source),'Module cannot contain an HTML script closing tag');
const html=fs.readFileSync(file,'utf8'),pattern=/<!-- TRIPIN_DATA_START -->[\s\S]*?<!-- TRIPIN_DATA_END -->/g;
const replacement='<!-- TRIPIN_DATA_START -->\n<script id="tripin-data-store">\n'+source+'</script>\n<!-- TRIPIN_DATA_END -->';
assert.equal([...html.matchAll(pattern)].length,1,'Exactly one embedded module is required');
if(process.argv.includes('--check'))assert.equal(html.match(pattern)[0],replacement,'Run node scripts/embed-data.cjs');
else fs.writeFileSync(file,html.replace(pattern,()=>replacement));
console.log('PASS embedded data module '+(process.argv.includes('--check')?'matches':'updated'));

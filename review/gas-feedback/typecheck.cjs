'use strict';
const ts=require('typescript'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tripin-gas-types-'));
const file=path.join(dir,'Code.js');fs.writeFileSync(file,fs.readFileSync(path.join(__dirname,'Code.gs')));
const program=ts.createProgram([file],{allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ES2020,lib:['lib.es2020.d.ts'],strict:false,types:['google-apps-script'],typeRoots:[path.join(__dirname,'node_modules/@types')],skipLibCheck:false});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>dir,getCanonicalFileName:name=>name,getNewLine:()=> '\n'}));process.exitCode=1}else console.log('PASS Apps Script API declaration checks');

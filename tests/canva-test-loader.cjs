/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness compiles isolated server modules. */
// Compile isolated TS modules with existing TypeScript. No runtime mock flags in application code.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
module.exports=function loader(overrides={}) {
 const cache=new Map(),root=path.resolve(__dirname,'..');
 return function load(relative){
  const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
  const compiled={exports:{}};cache.set(file,compiled);
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const localRequire=name=>Object.hasOwn(overrides,name)?overrides[name]:name==='server-only'?{}:name.startsWith('@/')?load('src/'+name.slice(2)+'.ts'):require(name);
  vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(localRequire,compiled,compiled.exports);return compiled.exports;
 };
};

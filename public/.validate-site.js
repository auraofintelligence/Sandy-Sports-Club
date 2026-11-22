const fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('site.js','utf8');
const context={location:{pathname:'/index.html'},document:{querySelector(){return null},querySelectorAll(){return []}}};
vm.runInNewContext(source.slice(0,source.indexOf('const menu='))+';globalThis.pageList=allPages;',context);
const routes=context.pageList.map(([file])=>file);
const files=fs.readdirSync('.').filter(file=>file.endsWith('.html'));
const unique=new Set(routes);
const missing=files.filter(file=>!unique.has(file));
const phantom=routes.filter(file=>!files.includes(file));
if(unique.size!==routes.length||missing.length||phantom.length)throw Error(JSON.stringify({total:routes.length,unique:unique.size,missing,phantom}));
for(const file of files){
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/(?:href|src)="\/(assets\/[^"]+|[^"#?]+\.html)"/g)){
  if(!fs.existsSync(match[1]))throw Error(file+' missing '+match[1]);
 }
}
console.log(routes.length+' unique pages covered; all local HTML and asset references resolve.');

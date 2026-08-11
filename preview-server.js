const http=require("http"),fs=require("fs"),path=require("path");
const root=process.cwd(),port=Number.parseInt(process.env.PORT,10)||4174;
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".txt":"text/plain; charset=utf-8",".md":"text/markdown; charset=utf-8",".png":"image/png",".svg":"image/svg+xml"};
http.createServer((req,res)=>{
  let u=decodeURIComponent(new URL(req.url,"http://x").pathname);
  if(u.startsWith("/MKJ/"))u=u.slice(4);
  if(u==="/"||u==="")u="/index.html";
  else if(u.endsWith("/"))u+="index.html";
  const f=path.normalize(path.join(root,u));
  if(!f.startsWith(path.normalize(root)+path.sep)&&f!==path.normalize(root)){res.writeHead(403);res.end("forbidden");return;}
  fs.readFile(f,(err,data)=>{if(err){res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});res.end("not found");return;}res.writeHead(200,{"Content-Type":mime[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});res.end(data);});
}).listen(port,"127.0.0.1",()=>console.log("PREVIEW_READY "+port));

const express = require("express");
const app = express();

app.use(express.json());

/* CORS */
app.use((req,res,next)=>{
res.setHeader("Access-Control-Allow-Origin","*");
res.setHeader("Access-Control-Allow-Headers","*");
res.setHeader("Access-Control-Allow-Methods","GET,POST,DELETE,OPTIONS");
next();
});

app.options("*",(req,res)=>res.sendStatus(200));

/* BANCO EM MEMÓRIA */
let db = {};

/* ROOT */
app.get("/",(req,res)=>{
res.json({ status:"online", resources:Object.keys(db) });
});

/* LISTAR RESOURCE */
app.get("/:resource",(req,res)=>{
res.json(db[req.params.resource] || []);
});

/* GERAR KEY */
app.post("/:resource",(req,res)=>{

const r = req.params.resource;

if(!db[r]) db[r] = [];

if(db[r].length >= 5000)
return res.json({ error:"Limite de 5000 keys atingido" });

const key =
(req.body.prefix || "KEY") +
"-" +
Math.random().toString(36).substring(2,10).toUpperCase();

const obj = {
id: Date.now(),
key,
type: req.body.type || "default",
used:false,
revoked:false,
device:null,
createdAt:new Date().toISOString()
};

db[r].push(obj);

res.json(obj);
});

/* VALIDAR KEY */
app.post("/:resource/validate",(req,res)=>{

const { key, device } = req.body;
const list = db[req.params.resource];

if(!list) return res.json({ valid:false });

const k = list.find(x=>x.key === key);

if(!k) return res.json({ valid:false });

if(k.revoked) return res.json({ valid:false, reason:"revoked" });

/* PRIMEIRO USO */
if(!k.used){
k.used = true;
k.device = device;
}

/* DEVICE DIFERENTE */
if(k.device !== device)
return res.json({ valid:false, reason:"device_mismatch" });

res.json({ valid:true, data:k });

});

/* REVOGAR KEY */
app.post("/:resource/revoke",(req,res)=>{

const { key } = req.body;
const list = db[req.params.resource];

if(!list) return res.json({ error:"resource inexistente" });

const k = list.find(x=>x.key === key);

if(!k) return res.json({ error:"key inexistente" });

k.revoked = true;

res.json({ success:true });

});

/* RESETAR DEVICE */
app.post("/:resource/reset-device",(req,res)=>{

const { key } = req.body;
const list = db[req.params.resource];

if(!list) return res.json({ error:"resource inexistente" });

const k = list.find(x=>x.key === key);

if(!k) return res.json({ error:"key inexistente" });

k.device = null;
k.used = false;

res.json({ success:true });

});

/* DELETAR KEY */
app.delete("/:resource/:key",(req,res)=>{

const { resource, key } = req.params;

if(!db[resource])
return res.json({ error:"resource inexistente" });

db[resource] = db[resource].filter(k=>k.key !== key);

res.json({ success:true });

});

/* DELETAR TODAS KEYS */
app.delete("/:resource",(req,res)=>{
db[req.params.resource] = [];
res.json({ success:true });
});

module.exports = app;

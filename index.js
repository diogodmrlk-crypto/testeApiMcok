const express = require("express");
const app = express();

app.use(express.json());

/* CORS */
app.use((req,res,next)=>{
res.setHeader("Access-Control-Allow-Origin","*");
res.setHeader("Access-Control-Allow-Headers","*");
res.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS");
next();
});

app.options("*",(req,res)=>res.sendStatus(200));


/* BANCO */
let keys = [];


/* LISTAR KEYS */
app.get("/keys",(req,res)=>{
res.json(keys);
});


/* CRIAR KEY */
app.post("/keys",(req,res)=>{

if(!req.body.key){
return res.status(400).json({error:"Key obrigatória"});
}

const exists = keys.find(k=>k.key === req.body.key);

if(exists){
return res.status(400).json({error:"Key já existe"});
}

const newKey = {
id: Date.now(),
key: req.body.key, // 🔥 USA A KEY DO HTML
type: req.body.type || "default",
username: req.body.username || null,
used:false,
revoked:false,
device:null,
createdAt: req.body.createdAt || Date.now()
};

keys.push(newKey);

res.json(newKey);
});


/* VALIDAR */
app.post("/keys/validate",(req,res)=>{

const { key, device } = req.body;

const k = keys.find(x=>x.key === key);

if(!k) return res.json({ valid:false });

if(k.revoked) return res.json({ valid:false, reason:"revoked" });

if(!k.used){
k.used = true;
k.device = device;
}

if(k.device !== device){
return res.json({ valid:false, reason:"device_mismatch" });
}

res.json({ valid:true, data:k });
});


/* REVOGAR */
app.put("/keys/:key",(req,res)=>{

const k = keys.find(x=>x.key === req.params.key);

if(!k) return res.status(404).json({error:"Key não encontrada"});

Object.assign(k, req.body);

res.json({success:true, key:k});
});


/* DELETAR */
app.delete("/keys/:key",(req,res)=>{

keys = keys.filter(k=>k.key !== req.params.key);

res.json({success:true});
});


module.exports = app;

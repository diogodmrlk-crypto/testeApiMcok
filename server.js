const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

/* ================= DATABASE ================= */

function loadDB(){
 if(!fs.existsSync("./db.json")){
  fs.writeFileSync("./db.json", JSON.stringify({resources:{}},null,2));
 }
 return JSON.parse(fs.readFileSync("./db.json"));
}

function saveDB(data){
 fs.writeFileSync("./db.json", JSON.stringify(data,null,2));
}

/* ================= CRIAR RESOURCE ================= */

app.post("/api/resource/create",(req,res)=>{

 const { name } = req.body;

 const db = loadDB();

 if(db.resources[name]) return res.json({error:"Já existe"});

 db.resources[name] = {
  keys:[]
 };

 saveDB(db);

 res.json({success:true});

});

/* ================= CRIAR KEY ================= */

app.post("/api/resource/:name/create",(req,res)=>{

 const { name } = req.params;
 const { key, expire } = req.body;

 const db = loadDB();
 const resource = db.resources[name];

 if(!resource) return res.json({error:"Resource não existe"});

 if(resource.keys.length >= 5000){
  return res.json({error:"Limite atingido"});
 }

 const newKey = {
  id: uuid(),
  key: key || uuid().slice(0,8),
  used:false,
  device:"",
  expire: expire || 0,
  createdAt: Date.now(),
  activatedAt: 0
 };

 resource.keys.push(newKey);
 saveDB(db);

 res.json(newKey);

});

/* ================= VALIDAR KEY ================= */

app.post("/api/resource/:name/validate",(req,res)=>{

 const { name } = req.params;
 const { key, device } = req.body;

 const db = loadDB();
 const resource = db.resources[name];

 if(!resource) return res.json({valid:false});

 const found = resource.keys.find(k=>k.key === key);

 if(!found) return res.json({valid:false});

 /* Expiração */
 if(found.expire > 0 && found.activatedAt > 0){
  const time = (Date.now() - found.activatedAt) / 60000;
  if(time >= found.expire){
   return res.json({valid:false, reason:"expired"});
  }
 }

 if(!found.used){
  found.used = true;
  found.device = device || "Unknown";
  found.activatedAt = Date.now();
 }

 if(found.device !== device){
  return res.json({valid:false, reason:"device mismatch"});
 }

 saveDB(db);

 res.json({valid:true});

});

/* ================= LISTAR KEYS ================= */

app.get("/api/resource/:name/list",(req,res)=>{

 const db = loadDB();
 const resource = db.resources[req.params.name];

 if(!resource) return res.json([]);

 res.json(resource.keys);

});

/* ================= STATUS ================= */

app.get("/", (req,res)=>{
 res.json({status:"API Online"});
});

/* ================= START ================= */

app.listen(PORT,()=>{
 console.log("API rodando");
});

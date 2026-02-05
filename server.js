const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { v4: uuid } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

function loadDB(){
 return JSON.parse(fs.readFileSync("./db.json"));
}

function saveDB(data){
 fs.writeFileSync("./db.json", JSON.stringify(data,null,2));
}

/* Criar projeto */
app.post("/api/project",(req,res)=>{
 const { name } = req.body;
 const db = loadDB();

 const id = uuid();

 db.projects[id] = {
  name,
  keys:[]
 };

 saveDB(db);
 res.json({id});
});

/* Listar keys */
app.get("/api/key/:id",(req,res)=>{
 const db = loadDB();
 res.json(db.projects[req.params.id]?.keys || []);
});

/* Criar key */
app.post("/api/key/:id",(req,res)=>{
 const db = loadDB();
 const project = db.projects[req.params.id];

 if(!project) return res.json({error:true});

 const key = {
  id: uuid(),
  key: req.body.key,
  used:false,
  device:""
 };

 project.keys.push(key);
 saveDB(db);

 res.json(key);
});

/* Validar key (Luau) */
app.post("/api/validate/:id",(req,res)=>{
 const { key, device } = req.body;

 const db = loadDB();
 const project = db.projects[req.params.id];

 if(!project) return res.json({valid:false});

 const found = project.keys.find(k=>k.key===key);

 if(!found || found.used) return res.json({valid:false});

 found.used = true;
 found.device = device;

 saveDB(db);

 res.json({valid:true});
});

app.listen(3000,()=>console.log("Servidor rodando"));

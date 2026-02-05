const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { v4: uuid } = require("uuid");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= CONFIG ================= */

app.use(express.json());
app.use(cors());

/* Servir arquivos estáticos */
app.use(express.static(path.join(__dirname)));

/* ================= DATABASE ================= */

function loadDB(){
 return JSON.parse(fs.readFileSync("./db.json"));
}

function saveDB(data){
 fs.writeFileSync("./db.json", JSON.stringify(data,null,2));
}

/* ================= ROTAS HTML ================= */

app.get("/", (req,res)=>{
 res.sendFile(path.join(__dirname,"index.html"));
});

app.get("/project", (req,res)=>{
 res.sendFile(path.join(__dirname,"project.html"));
});

/* ================= API PROJETOS ================= */

app.post("/api/project",(req,res)=>{

 const { name } = req.body;
 const db = loadDB();

 const id = uuid();

 db.projects[id] = {
  name,
  keys:[]
 };

 saveDB(db);

 res.json({ id });

});

/* ================= API LISTAR KEYS ================= */

app.get("/api/key/:id",(req,res)=>{

 const db = loadDB();
 const project = db.projects[req.params.id];

 if(!project) return res.json([]);

 res.json(project.keys);

});

/* ================= API CRIAR KEY ================= */

app.post("/api/key/:id",(req,res)=>{

 const db = loadDB();
 const project = db.projects[req.params.id];

 if(!project) return res.json({error:true});

 const key = {
  id: uuid(),
  key: req.body.key,
  used:false,
  device:"",
  createdAt: Date.now()
 };

 project.keys.push(key);
 saveDB(db);

 res.json(key);

});

/* ================= API VALIDAR KEY ================= */

app.post("/api/validate/:id",(req,res)=>{

 const { key, device } = req.body;

 const db = loadDB();
 const project = db.projects[req.params.id];

 if(!project) return res.json({valid:false});

 const found = project.keys.find(k=>k.key===key);

 if(!found) return res.json({valid:false});
 if(found.used) return res.json({valid:false});

 found.used = true;
 found.device = device || "Unknown";

 saveDB(db);

 res.json({valid:true});

});

/* ================= START ================= */

app.listen(PORT,()=>{
 console.log("Servidor rodando na porta " + PORT);
});

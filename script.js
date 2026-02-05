const params = new URLSearchParams(window.location.search);
const project = params.get("id");

function create(){

 fetch("/api/project",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({
   name:document.getElementById("name").value
  })
 })
 .then(r=>r.json())
 .then(d=>{
  location.href="/project?id="+d.id;
 });

}

function createKey(){

 fetch("/api/key/"+project,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({
   key:document.getElementById("key").value
  })
 })
 .then(()=>load());

}

function load(){

 if(!project) return;

 fetch("/api/key/"+project)
 .then(r=>r.json())
 .then(keys=>{

  const list = document.getElementById("list");
  list.innerHTML="";

  keys.forEach(k=>{

   list.innerHTML+=`
    <tr>
     <td>${k.key}</td>
     <td>${k.used ? "Usada" : "Livre"}</td>
     <td>${k.device || "-"}</td>
    </tr>
   `;

  });

 });

}

load();

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get("id");

/* Criar projeto */
async function createProject(){

 const name = document.getElementById("name").value;

 const res = await fetch("/api/project",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({name})
 });

 const data = await res.json();

 window.location = `project.html?id=${data.id}`;
}

/* Criar key */
async function createKey(){

 const key = document.getElementById("key").value;

 await fetch(`/api/key/${projectId}`,{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({key})
 });

 loadKeys();
}

/* Carregar tabela */
async function loadKeys(){

 const res = await fetch(`/api/key/${projectId}`);
 const keys = await res.json();

 const table = document.getElementById("table");

 table.innerHTML = `
 <tr>
  <th>Key</th>
  <th>Usada</th>
 </tr>
 `;

 keys.forEach(k=>{
  table.innerHTML += `
   <tr>
    <td>${k.key}</td>
    <td>${k.used ? "Sim":"Não"}</td>
   </tr>
  `;
 });
}

if(projectId) loadKeys();

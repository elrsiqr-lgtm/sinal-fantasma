// Testa o adaptador Supabase com um cliente simulado (sem rede).
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||'index.html','utf8');
const m=html.match(/function makeSupabaseDb[\s\S]*?\n}\nfunction localUserId/);
if(!m){console.log('adaptador não encontrado');process.exit(1);}
const code=m[0].replace(/function localUserId$/,'');
const store=new Map(),handlers=[];
function fire(ev,row){handlers.forEach(h=>h({eventType:ev,new:ev==='DELETE'?{}:row,old:ev==='DELETE'?{path:row.path}:{}}));}
const sbMock={createClient:()=>({
  from:()=>({
    select(){const q={f:[],eq(c,v){q.f.push(r=>r[c]===v);return q;},like(c,p){const pre=p.replace(/%$/,'');q.f.push(r=>r[c].startsWith(pre));return q;},
      maybeSingle(){const r=[...store.values()].filter(x=>q.f.every(f=>f(x)))[0]||null;return Promise.resolve({data:r,error:null});},
      then(res,rej){return Promise.resolve({data:[...store.values()].filter(x=>q.f.every(f=>f(x))),error:null}).then(res,rej);}};return q;},
    upsert(row){const ex=store.has(row.path);store.set(row.path,row);fire(ex?'UPDATE':'INSERT',row);return Promise.resolve({error:null});},
    delete(){return {eq(c,v){const r=store.get(v);store.delete(v);fire('DELETE',{path:v});return Promise.resolve({error:null});}};}
  }),
  channel(){const ch={on(t,o,h){handlers.push(h);return ch;},subscribe(){return ch;}};return ch;},
  removeChannel(){}
})};
const sb={window:{supabase:sbMock},setInterval,clearInterval,JSON,Promise};
vm.createContext(sb);vm.runInContext(code+';this.make=makeSupabaseDb;',sb);
const db=sb.make('u','k');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,t)=>{if(!c){fails++;console.log('FALHOU:',t);}};
(async()=>{
  ok((await db.doc('games/ABCDE').get()).exists===false,'doc inexistente');
  await db.doc('games/ABCDE').set({phase:'lobby',n:1});
  const s=await db.doc('games/ABCDE').get();ok(s.exists&&s.data().phase==='lobby','set/get');
  await db.doc('games/ABCDE/players/a').set({id:'a',joined:1});
  await db.collection('games/ABCDE/players').doc('b').set({id:'b',joined:2});
  await db.doc('games/ABCDE/roles/a').set({team:'res'});
  const q=await db.collection('games/ABCDE/players').get();ok(q.size===2&&q.docs.length===2,'coleção só traz filhos diretos: '+q.size);
  ok(q.docs.map(d=>d.id).sort().join()==='a,b','ids');
  let docEv=[],colEv=[];
  const u1=db.doc('games/ABCDE').onSnapshot(s=>docEv.push(s.data().phase));
  const u2=db.collection('games/ABCDE/players').onSnapshot(q=>colEv.push(q.size));
  await sleep(30);ok(docEv.length>=1&&colEv[colEv.length-1]===2,'snapshot inicial');
  await db.doc('games/ABCDE').set({phase:'play'});await sleep(30);ok(docEv[docEv.length-1]==='play','doc reage a mudança');
  await db.doc('games/ABCDE/players/c').set({id:'c'});await sleep(30);ok(colEv[colEv.length-1]===3,'coleção reage a novo jogador');
  await db.doc('games/ABCDE/players/c').delete();await sleep(30);ok(colEv[colEv.length-1]===2,'coleção reage a delete');
  const n=docEv.length;u1();await db.doc('games/ABCDE').set({phase:'x'});await sleep(30);ok(docEv.length===n,'cancelar inscrição para de notificar');
  u2();
  console.log(fails?'FALHOU':'ADAPTADOR OK');process.exit(fails?1:0);
})();

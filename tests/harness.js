const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=x=>JSON.parse(JSON.stringify(x));
let failures=0;
process.on('unhandledRejection',e=>{console.log('UNHANDLED',e&&e.stack||e);failures++;});
process.on('uncaughtException',e=>{console.log('UNCAUGHT',e&&e.stack||e);failures++;});
function assert(c,m){if(!c){failures++;console.log('FAIL:',m);throw new Error(m);}}

const SPIES={5:2,6:2,7:3,8:3,9:3,10:4};
const TEAMS={5:[2,3,2,3,3],6:[2,3,4,3,4],7:[2,3,3,4,4],8:[3,4,4,5,5],9:[3,4,4,5,5],10:[3,4,4,5,5]};

function makeDb(){
  const store={};const ls=[];let pending=false;
  const segs=p=>p.split('/');
  function snapDoc(path){const d=store[path];return {id:segs(path).pop(),exists:d!==undefined,data(){return d===undefined?undefined:clone(d);},metadata:{}};}
  function colDocs(path){
    const n=segs(path).length+1,out=[];
    Object.keys(store).sort().forEach(k=>{if(k.startsWith(path+'/')&&segs(k).length===n)out.push({id:segs(k).pop(),exists:true,data(){return clone(store[k]);}});});
    return out;
  }
  function snapCol(path){const docs=colDocs(path);return {docs,size:docs.length,empty:!docs.length};}
  function notify(){
    if(pending)return;pending=true;
    setTimeout(()=>{pending=false;ls.slice().forEach(l=>{if(l.dead)return;try{l.cb(l.type==='doc'?snapDoc(l.path):snapCol(l.path));}catch(e){console.log('LISTENER ERR',e.stack);failures++;}});},0);
  }
  function docRef(path){
    return {id:segs(path).pop(),path,
      get:()=>Promise.resolve(snapDoc(path)),
      set:(d)=>{store[path]=clone(d);notify();return Promise.resolve();},
      update:(d)=>{store[path]=Object.assign(store[path]||{},clone(d));notify();return Promise.resolve();},
      delete:()=>{delete store[path];notify();return Promise.resolve();},
      onSnapshot:(cb)=>{const l={type:'doc',path,cb};ls.push(l);setTimeout(()=>cb(snapDoc(path)),0);return ()=>{l.dead=true;};},
      collection:(sub)=>colRef(path+'/'+sub)};
  }
  function colRef(path){
    return {path,doc:(id)=>docRef(path+'/'+(id||('auto'+Math.random().toString(36).slice(2)))),
      get:()=>Promise.resolve(snapCol(path)),
      onSnapshot:(cb)=>{const l={type:'col',path,cb};ls.push(l);setTimeout(()=>cb(snapCol(path)),0);return ()=>{l.dead=true;};}};
  }
  return {store,db:{doc:docRef,collection:colRef}};
}

function makeClient(uid,db,opts={}){
  const el={innerHTML:'',listeners:{},addEventListener(ev,fn){this.listeners[ev]=fn;}};
  const ls=opts.ls||{};if(!opts.tour&&ls.rd_tour===undefined)ls.rd_tour='1';if(ls.rd_intro===undefined)ls.rd_intro='1';
  const sb={console,setTimeout,clearTimeout,Math,JSON,Promise,Date,
    document:{getElementById:id=>id==='app'?el:null,querySelectorAll:()=>[]},
    localStorage:{getItem:k=>ls[k]===undefined?null:ls[k],setItem:(k,v)=>{ls[k]=String(v);},removeItem:k=>{delete ls[k];}},
    navigator:{},requestAnimationFrame:fn=>setTimeout(fn,5)};
  sb.window=sb;sb.matchMedia=()=>({matches:true});sb.scrollTo=()=>{};
  if(db)sb.claude={use:async n=>n==='db'?db:{id:async()=>uid,can:async()=>true}};
  vm.createContext(sb);vm.runInContext(script,sb);
  if(/data-a="splashGo"/.test(el.innerHTML)&&el.listeners.click)el.listeners.click({target:{closest:()=>({dataset:{a:'splashGo'},disabled:false})}});
  return {uid,el,ls,html:()=>el.innerHTML};
}
function btn(c,a,v){
  const re=/<button\b[^>]*>/g;let m;const h=c.html();
  while((m=re.exec(h))){const t=m[0];if(t.includes('data-a="'+a+'"')&&(v===undefined||t.includes('data-v="'+v+'"')))return !/\sdisabled(\s|>|=)/.test(t);}
  return null;
}
async function click(c,a,o={}){
  const st=btn(c,a,o.v);
  if(st===null)throw new Error('botão '+a+' ausente para '+c.uid+'\n'+c.html().slice(0,400));
  if(st===false)throw new Error('botão '+a+' desativado para '+c.uid);
  const ds={a};if(o.i!==undefined)ds.i=String(o.i);if(o.v!==undefined)ds.v=o.v;
  c.el.listeners.click({target:{closest:()=>({dataset:ds,disabled:false})}});
  await sleep(o.wait||40);
}
function type(c,field,value){c.el.listeners.input({target:{dataset:{[field]:'1'},value}});}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

async function lobby(db,store,n,assassin,tag){
  const ids=Array.from({length:n},(_,i)=>tag+'u'+(i+1));
  const cl=ids.map(u=>makeClient(u,db));
  await sleep(120);
  const names=['Ana','Bia','Caio','Duda','Edu','Fabi','Gus','Hana','Igor','Joao'];
  const h=cl[0];
  await click(h,'setMode',{v:'online'});
  type(h,'oname',names[0]);
  await click(h,'createOnline',{wait:150});
  const mm=h.html().match(/<div class="code">(\w+)<\/div>/);
  assert(mm,'host sem código na sala de espera');
  const code=mm[1];
  assert(btn(h,'oStart')===false,'iniciar deveria estar desativado com 1 jogador');
  // código errado
  const bad=makeClient(tag+'bad',db);await sleep(100);
  await click(bad,'setMode',{v:'online'});type(bad,'oname','X');type(bad,'ocode','ZZZZZ');
  await click(bad,'joinOnline',{wait:100});
  assert(/Nenhum sinal com esse código/.test(bad.html()),'mensagem de código errado');
  for(let k=1;k<n;k++){
    const c=cl[k];
    await click(c,'setMode',{v:'online'});type(c,'oname',names[k]);type(c,'ocode',code.toLowerCase());
    await click(c,'joinOnline',{wait:120});
    assert(c.html().includes('Frequência <b>'+code),'jogador '+k+' não entrou na sala');
    if(k===3)assert(btn(h,'oStart')===false,'iniciar desativado com 4');
  }
  await sleep(100);
  assert(btn(h,'oStart')===true,'iniciar ativo com '+n);
  names.slice(0,n).forEach(nm=>assert(h.html().includes(nm),'nome '+nm+' na lista do host'));
  if(assassin){h.el.listeners.change({target:{id:'oassassin',checked:true}});await sleep(80);assert(store['games/'+code].assassin===true,'assassino ligado no doc');}
  return {cl,code,h};
}

async function playGame(cl,store,code,assassin,label){
  const n=cl.length,byId=Object.fromEntries(cl.map(c=>[c.uid,c]));
  const gk='games/'+code;
  let g=store[gk];
  const T=TEAMS[n];
  // papéis
  const roles=Object.fromEntries(g.players.map(p=>[p.id,store[gk+'/roles/'+p.id]]));
  const spyIds=g.players.filter(p=>roles[p.id].team==='spy').map(p=>p.id);
  assert(spyIds.length===SPIES[n],label+' nº de espiões');
  const cmd=g.players.filter(p=>roles[p.id].special==='comandante'),asn=g.players.filter(p=>roles[p.id].special==='assassino');
  if(assassin){assert(cmd.length===1&&roles[cmd[0].id].team==='res','um comandante da resistência');assert(asn.length===1&&roles[asn[0].id].team==='spy','um assassino espião');}
  else assert(!cmd.length&&!asn.length,'sem especiais no modo básico');
  g.players.forEach(p=>{
    const r=roles[p.id];
    if(r.team==='spy'||r.special==='comandante')assert(JSON.stringify([...r.spies].sort())===JSON.stringify([...spyIds].sort()),'lista de espiões de '+p.id);
    else assert(r.spies.length===0,'resistência comum sem lista');
  });
  // tela de papel
  for(const c of cl){
    if(/data-a="introSkip"/.test(c.html())){await click(c,'introSkip',{wait:50});}
    assert(/Seu papel secreto/.test(c.html()),label+' papel aparece para '+c.uid);
    const r=roles[c.uid];
    const lab=r.special==='comandante'?'Comandante':r.special==='assassino'?'Assassino':r.team==='spy'?'Infiltrado':'Agente Rebelde';
    assert(c.html().includes('<h2>'+lab+'</h2>'),label+' papel correto '+c.uid+' '+lab);
    await click(c,'oHideRole');
    assert(!/Seu papel secreto/.test(c.html()),'papel escondido');
  }
  let reloaded=false,seen={};
  for(let step=0;step<600;step++){
    g=store[gk];seen[g.phase]=(seen[g.phase]||0)+1;
    if(g.phase==='end')break;
    const host=byId[g.hostId];
    if(g.phase==='team'){
      const lid=g.players[g.leader].id,lc=byId[lid],size=T[g.mission];
      const idx=shuffle([...Array(n).keys()]).slice(0,size);
      for(let k=0;k<size;k++){
        assert(btn(lc,'oConfirmTeam')===false,'confirmar desativado antes de completar '+k);
        await click(lc,'oToggle',{i:idx[k]});
      }
      assert(btn(lc,'oConfirmTeam')===true,'confirmar ativo');
      const other=cl.find(c=>c.uid!==lid);
      assert(btn(other,'oConfirmTeam')===null,'só o líder vê o seletor');
      await click(lc,'oConfirmTeam',{wait:200});
    }else if(g.phase==='vote'){
      if(!reloaded&&g.mission===1){ // recarrega um jogador não anfitrião
        reloaded=true;
        const k=cl.findIndex(c=>c.uid!==g.hostId);
        const old=cl[k];cl[k]=makeClient(old.uid,old.db||dbRef,{ls:old.ls});byId[old.uid]=cl[k];
        await sleep(200);
        assert(cl[k].html().includes('Frequência <b>'+code)&&/Votação secreta/.test(cl[k].html()),'retomada após recarregar: '+cl[k].html().slice(0,300));
      }
      for(const c of cl){
        const mine=store[gk+'/intents/'+c.uid];
        if(mine&&mine.phase==='vote'&&mine.key.endsWith('.m'+g.mission+'.a'+g.attempt))continue;
        assert(btn(c,'oPickVote','A')===true,'botão aprovar '+c.uid);
        assert(btn(c,'oConfirmVote')===false,'confirmar voto desativado');
        const v=(g.attempt===4||Math.random()<0.7)?'A':'R';
        await click(c,'oPickVote',{v});
        await click(c,'oConfirmVote',{wait:30});
        assert(/Voto registrado|Resultado da votação/.test(c.html()),'voto registrado '+c.uid);
      }
      await sleep(200);
    }else if(g.phase==='voteResult'){
      const non=cl.find(c=>c.uid!==g.hostId);
      assert(btn(non,'oContinue')===null,'só o anfitrião continua');
      assert(g.vres.ap+g.vres.rj===n,'contagem de votos');
      await click(host,'oContinue',{wait:200});
    }else if(g.phase==='mission'){
      for(const id of g.team){
        const c=byId[id],r=roles[id];
        assert(btn(c,'oPickCard','S')===true,'carta visível para membro');
        if(r.team==='res'){
          await click(c,'oPickCard',{v:'F'});
          assert(/só podem escolher Sucesso/.test(c.html())&&btn(c,'oConfirmCard')===false,'resistência não escolhe fracasso');
          await click(c,'oPickCard',{v:'S'});
        }else{
          await click(c,'oPickCard',{v:Math.random()<0.5?'F':'S'});
        }
        await click(c,'oConfirmCard',{wait:30});
      }
      const nm=cl.find(c=>!g.team.includes(c.uid));
      if(nm)assert(btn(nm,'oPickCard','S')===null,'não-membro sem cartas');
      await sleep(250);
    }else if(g.phase==='missionResult'){
      assert(g.mres.cards.length===g.team.length,'nº de cartas');
      const need=(n>=7&&g.mission===3)?2:1;
      assert(g.mres.ok===(g.mres.fails<need),'regra de falhas');
      // verdict visível depois da animação
      await sleep(150);
      assert(!/id="verdict" hidden/.test(host.html()),'veredito visível após flip');
      await click(host,'oContinue',{wait:200});
    }else if(g.phase==='assassin'){
      const ac=byId[asn[0].id],other=cl.find(c=>c.uid!==asn[0].id);
      assert(btn(other,'oConfirmAssassin')===null,'só o assassino escolhe');
      const pick=Math.floor(Math.random()*n);
      await click(ac,'oPickAssassin',{i:pick});
      await click(ac,'oConfirmAssassin',{wait:250});
    }else{await sleep(100);}
  }
  g=store[gk];
  assert(g.phase==='end','jogo terminou: '+g.phase);
  const s=g.results.filter(r=>r==='S').length,f=g.results.filter(r=>r==='F').length;
  const reason=g.endInfo.reason;
  if(/Cinco equipes/.test(reason))assert(g.endInfo.winner==='spy'&&g.rejects>=5,'fim por 5 rejeições');
  else if(/Três missões foram cumpridas/.test(reason))assert(g.endInfo.winner==='res'&&s===3,'fim 3 sucessos');
  else if(/Três missões fracassaram/.test(reason))assert(g.endInfo.winner==='spy'&&f===3,'fim 3 falhas');
  else assert(assassin&&/Assassino apontou/.test(reason)&&s===3,'fim por assassino: '+reason);
  g.endInfo.roles.forEach(r=>{const o=roles[r.id];assert(o.team===r.team&&(o.special||null)===(r.special||null),'papéis no fim');});
  for(const c of cl)assert(/Quem era quem/.test(c.html())&&/Histórico/.test(c.html()),'tela final '+c.uid);
  console.log(label,'ok ->',g.endInfo.winner,'|',reason,'| fases',JSON.stringify(seen));
  return g;
}
let dbRef=null;

(async()=>{
  // sala A: 5 jogadores, Assassino, duas partidas
  {
    const {store,db}=makeDb();dbRef=db;
    const {cl,code,h}=await lobby(db,store,5,true,'A');
    cl.forEach(c=>c.db=db);
    await click(h,'oStart',{wait:100});await click(h,'storyGo',{wait:300});
    assert(store['games/'+code].phase==='team','partida iniciou');
    // entrada tardia
    const late=makeClient('Alate',db);await sleep(100);
    await click(late,'setMode',{v:'online'});type(late,'oname','Tarde');type(late,'ocode',code);
    await click(late,'joinOnline',{wait:100});
    assert(/já começou/.test(late.html()),'entrada tardia bloqueada');
    await playGame(cl,store,code,true,'Sala A jogo 1');
    await click(h,'oAgain',{wait:300});
    assert(store['games/'+code].phase==='team'&&store['games/'+code].log.length===0,'novo jogo');
    await playGame(cl,store,code,true,'Sala A jogo 2');
  }
  // sala B: 7 jogadores, modo básico
  {
    const {store,db}=makeDb();dbRef=db;
    const {cl,code,h}=await lobby(db,store,7,false,'B');
    cl.forEach(c=>c.db=db);
    await click(h,'oStart',{wait:100});await click(h,'storyGo',{wait:300});
    await playGame(cl,store,code,false,'Sala B jogo 1');
  }
  // modo local, 5 e 8 jogadores
  for(const n of [5,8]){
    const c=makeClient('L',null,{tour:true});await sleep(50);
    // tutorial na primeira visita
    assert(/Como jogar/.test(c.html()),'tutorial aparece na primeira visita');
    await click(c,'tourSkip');
    assert(btn(c,'setMode','local')!==null&&btn(c,'setMode','online')!==null,'tela inicial com as duas escolhas');
    assert(btn(c,'start')===null&&!/class="tabs"/.test(c.html()),'tela inicial sem abas nem configuração');
    await click(c,'setMode',{v:'local'});
    assert(btn(c,'goHome')!==null,'botão Voltar no modo local');
    await click(c,'goHome');assert(btn(c,'setMode','local')!==null,'Voltar leva à escolha');
    await click(c,'setMode',{v:'local'});
    assert(btn(c,'start')===true,'tela do modo local');
    while(+c.html().match(/<div class="num"[^>]*>(\d+)/)[1]<n)await click(c,'inc');
    if(n===5)c.el.listeners.change({target:{id:'assassin',checked:true}});
    await click(c,'start');await click(c,'storyGo');
    let guard=0,done=false;
    while(!done&&guard++<800){
      const h=c.html();
      if(btn(c,'showRole')!==null)await click(c,'showRole');
      else if(btn(c,'nextRole')!==null)await click(c,'nextRole');
      else if(btn(c,'toggleP')!==null){
        let k=0;while(btn(c,'confirmTeam')===false&&k<n){await click(c,'toggleP',{i:k});k++;}
        await click(c,'confirmTeam');
      }
      else if(btn(c,'introSkip')!==null){await click(c,'introSkip');if(btn(c,'introSkip')!==null)await click(c,'introSkip');}
      else if(btn(c,'showVote')!==null)await click(c,'showVote');
      else if(btn(c,'pickVote','A')!==null){await click(c,'pickVote',{v:Math.random()<0.75?'A':'R'});await click(c,'confirmVote');}
      else if(btn(c,'afterVote')!==null)await click(c,'afterVote');
      else if(btn(c,'showMission')!==null)await click(c,'showMission');
      else if(btn(c,'pickCard','S')!==null){
        await click(c,'pickCard',{v:Math.random()<0.5?'F':'S'});
        if(btn(c,'confirmCard')===false)await click(c,'pickCard',{v:'S'});
        await click(c,'confirmCard');
      }
      else if(btn(c,'afterMission')!==null)await click(c,'afterMission');
      else if(btn(c,'pickAssassin')!==null){await click(c,'pickAssassin',{i:0});await click(c,'confirmAssassin');}
      else if(btn(c,'again')!==null)done=true;
      else throw new Error('local travou:\n'+h.slice(0,500));
    }
    assert(done,'local terminou');
    assert(/Quem era quem/.test(c.html()),'fim local');
    console.log('Local',n,'ok ->',(c.html().match(/<h1[^>]*>([^<]+)<\/h1>/)||[])[1]);
  }
  console.log(failures?('FALHAS: '+failures):'TUDO OK');
  process.exit(failures?1:0);
})().catch(e=>{console.log('ERRO',e.stack||e);process.exit(1);});

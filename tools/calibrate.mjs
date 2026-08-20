import * as E from '../js/engine.js';
const rnd=(n)=>Math.floor(Math.random()*n);
const pct=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const mean=(a)=>a.reduce((x,y)=>x+y,0)/a.length;
const allCombos=(L)=>{const o=[];for(const a of L)for(const b of L)for(const c of L)if(a!==b&&b!==c&&a!==c)o.push(a+b+c);return o;};
const ALL=allCombos(E.LETTERS);
/*
 * Each mode's difficulty lives on a different axis, so one rule cannot judge all
 * four. `effort` values are costs (higher = harder) and must grow by a real
 * multiple — a step under 1.25x is inside the run-to-run noise, which is exactly
 * how Classic's Normal and Hard sat tied at 786 vs 867 and looked fine.
 * `rate` values are win-rate percentages, judged by percentage-point drops.
 */
const verdictEffort = (x) => {
  const mono = x.every((v, i) => i === 0 || x[i-1] < v);
  const steps = x.slice(1).map((v, i) => v / x[i]);
  if (!mono) return `NOT MONOTONE ✗ — ${x.join(' , ')}`;
  return (Math.min(...steps) < 1.25 ? 'MONOTONE but WEAK' : 'MONOTONE ↑ ok') +
    ` — steps ${steps.map((v) => v.toFixed(2) + 'x').join(' , ')}`;
};
const verdictRate = (x) => {
  const mono = x.every((v, i) => i === 0 || x[i-1] > v);
  const drops = x.slice(1).map((v, i) => x[i] - v);
  if (!mono) return `NOT MONOTONE ✗ — ${x.join('% , ')}%`;
  return `win rate falls ${x.map((v) => v.toFixed(0) + '%').join(' → ')} (drops of ${drops.map((d) => d.toFixed(0)).join(', ')} points)`;
};

console.log('=== CLASSIC (2 of 8-16 / 3 of 4-8 / all of exactly 3) ===');
const CB={easy:{min:8,max:16,required:2},normal:{min:4,max:8,required:3},hard:{min:3,max:3,required:Infinity}};
const cRes=[];
for(const [lvl,band] of Object.entries(CB)){
  const effort=[],needs=[];
  for(let i=0;i<250;i++){
    const p=E.comboPuzzle(band);
    const need=Math.min(band.required,p.solutions.length); needs.push(need);
    const want=new Set(p.solutions); const order=E.shuffle(ALL.slice());
    let seen=0,hit=0;
    for(const c of order){seen++;if(want.has(c)){hit++;if(hit===need)break;}}
    effort.push(seen);
  }
  cRes.push(pct(effort,0.5));
  console.log(`  ${lvl.padEnd(6)} must find ${mean(needs).toFixed(1)} | examined: median ${String(pct(effort,0.5)).padStart(4)} p90 ${String(pct(effort,0.9)).padStart(4)}`);
}
console.log('  ->', verdictEffort(cRes));

console.log('\n=== SPRINT (fixed run length, no time faucet: >=16/105s, >=8/85s, >=5/70s) ===');
const SB={easy:{minSolutions:16,seconds:105},normal:{minSolutions:8,seconds:85},hard:{minSolutions:5,seconds:70}};
const sRes=[];
for(const [lvl,band] of Object.entries(SB)){
  const effort=[],perRun=[];
  for(let i=0;i<150;i++){
    let tiles,bv,viable,guard=0;
    do{tiles=E.makeTiles();bv=E.combosByValue(tiles);
       viable=[...bv.values()].filter(c=>c.length>=band.minSolutions).length;}while(viable<8&&guard++<300);
    const targets=[...bv.entries()].filter(([v,c])=>c.length>=band.minSolutions&&Math.abs(v)<=150);
    if(targets.length<2) continue;
    for(let k=0;k<3;k++){
      const want=new Set(targets[rnd(targets.length)][1]);
      const order=E.shuffle(ALL.slice()); let seen=0;
      for(const c of order){seen++;if(want.has(c))break;}
      effort.push(seen);
    }
    // a reasoning player is ~8x more efficient than a random scan
    let ms=band.seconds*1000,cleared=0;
    while(ms>0&&cleared<100){
      const want=new Set(targets[rnd(targets.length)][1]);
      const order=E.shuffle(ALL.slice()); let seen=0;
      for(const c of order){seen++;if(want.has(c))break;}
      ms-=(seen/8)*1800; if(ms<=0)break;
      cleared++;   // nothing adds time back: the run length is fixed
    }
    perRun.push(cleared);
  }
  // Sprint has two levers — haystack size and clock — so the honest metric is
  // the combined outcome. Mean, not median: targets-per-run is a small integer
  // and its median quantises too coarsely to compare levels.
  sRes.push(1 / Math.max(0.25, mean(perRun)));
  console.log(`  ${lvl.padEnd(6)} examined per target: median ${String(pct(effort,0.5)).padStart(3)} p90 ${String(pct(effort,0.9)).padStart(4)} | targets per run (reasoning player): mean ${mean(perRun).toFixed(1)} median ${pct(perRun,0.5)} p10 ${pct(perRun,0.1)}`);
}
console.log('  -> (judged on targets cleared per run, inverted)', verdictEffort(sRes));

console.log('\n=== DEDUCE (after: 8 / 6 / 5 guesses, arrow always on) ===');
const marksFor=(s,g)=>[...g].map((l,i)=>s[i]===l?'h':s.includes(l)?'m':'o').join('');
const dRes=[];
for(const [lvl,budget] of Object.entries({easy:8,normal:6,hard:5})){
  let wins=0;const trials=400,used=[];
  for(let i=0;i<trials;i++){
    const p=E.deducePuzzle({}); let cands=ALL.slice(),g=0,won=false;
    while(g<budget){
      const guess=cands[rnd(cands.length)];g++;
      if(guess===p.secret){won=true;break;}
      const m=marksFor(p.secret,guess);
      const gv=E.comboValue(p.tiles,guess); const sign=Math.sign(p.value-gv);
      cands=cands.filter(c=>{
        if(marksFor(c,guess)!==m)return false;
        const cv=E.wholeOrNull(E.comboValue(p.tiles,c));
        if(cv===null)return true;
        return Math.sign(cv-gv)===sign;
      });
      if(!cands.length)cands=ALL.slice();
    }
    if(won){wins++;used.push(g);}
  }
  dRes.push(100*wins/trials);
  console.log(`  ${lvl.padEnd(6)} ${budget} guesses | reference-solver win rate ${(100*wins/trials).toFixed(0)}% | median guesses ${pct(used,0.5)}`);
}
console.log('  ->', verdictRate(dRes), '— easy and normal both sit near the ceiling by design; the budget squeeze is the lever.');

console.log('\n=== LADDER (unchanged: par 3 / 4 / 5) ===');
const lRes=[];
for(const [lvl,par] of Object.entries({easy:3,normal:4,hard:5})){
  const density=[];
  for(let i=0;i<100;i++){
    const p=E.ladderPuzzle({par});
    let frontier=[{v:p.start,used:[]}];
    for(let d=1;d<=par;d++){
      const next=[];
      for(const n of frontier)for(const l of E.LETTERS){
        if(n.used.includes(l))continue;
        const r=E.wholeOrNull(E.apply(n.v,p.tiles[l].op,p.tiles[l].num));
        if(r===null||Math.abs(r)>999)continue;
        next.push({v:r,used:n.used.concat(l)});
      }
      frontier=next;
    }
    const wins=frontier.filter(n=>n.v===p.target).length;
    density.push(frontier.length?wins/frontier.length:0);
  }
  const one_in=Math.round(1/mean(density));
  lRes.push(one_in);
  console.log(`  ${lvl.padEnd(6)} par ${par} | winning route density 1 in ${one_in}`);
}
console.log('  ->', verdictEffort(lRes));

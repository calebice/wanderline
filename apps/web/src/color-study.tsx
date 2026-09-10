import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COLOR_SOURCES, comparisonsFor } from "./color-study-catalog";
import { STUDY_COLORS, WASHES, rgb, partnerColor, washColor, pigmentMix } from "./color-study-model";
import "./color-study.css";

const point = (angle: number, radius: number) => ({x:250 + radius*Math.cos(angle*Math.PI/180),y:250 + radius*Math.sin(angle*Math.PI/180)});
function wedge(index: number, wash: number) {
  const start=index*30-104.3, end=start+28.6, inner=76+wash*29, outer=inner+28;
  const a=point(start,outer),b=point(end,outer),c=point(end,inner),d=point(start,inner);
  return `M${a.x},${a.y} A${outer},${outer} 0 0 1 ${b.x},${b.y} L${c.x},${c.y} A${inner},${inner} 0 0 0 ${d.x},${d.y} Z`;
}
const marks=[0,.25,.5,.75,1];
const ratioLabel=(t:number)=>`${Math.round((1-t)*100)}:${Math.round(t*100)}`;

function Wash({colors, id, sample=false}: {colors:string[];id:string;sample?:boolean}) {
  return <svg className="wc-wash" viewBox={sample?"0 0 220 110":"0 0 600 65"} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={id}>{colors.map((color,i)=><stop key={i} offset={`${i/(colors.length-1)*100}%`} stopColor={color}/>)}</linearGradient></defs>
    <rect x="3" y="5" width={sample?214:594} height={sample?100:55} rx="3" fill={`url(#${id})`} filter="url(#wc-grain)" />
  </svg>;
}

export function ColorStudy() {
  const uid=useId().replace(/:/g,"");
  const [baseIndex,setBaseIndex]=useState(8);
  const [wash,setWash]=useState(2);
  const [pinned,setPinned]=useState({row:0,t:.5});
  const [hover,setHover]=useState<{row:number;t:number}|null>(null);
  const [sourcesOpen,setSourcesOpen]=useState(false);
  const base=STUDY_COLORS[baseIndex];
  const recommendations=useMemo(()=>comparisonsFor(base.id),[base.id]);
  const gradients=useMemo(()=>recommendations.map(p=>Array.from({length:25},(_,i)=>pigmentMix(base.rgb,partnerColor(p),i/24,wash))),[base,recommendations,wash]);
  const active=hover??pinned;
  const partner=recommendations[active.row];
  const sample=pigmentMix(base.rgb,partnerColor(partner),active.t,wash);
  function choose(index:number,strength:number) {setBaseIndex(index);setWash(strength);setPinned({row:0,t:.5});setHover(null);}
  function inspect(row:number,t:number) {setPinned({row,t});setHover(null);}
  return <article className="color-study">
    <svg width="0" height="0" className="wc-defs" aria-hidden="true"><defs>
      <filter id="wc-grain" x="-3%" y="-12%" width="106%" height="124%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".09 .25" numOctaves="3" seed="14" result="grain"/>
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="3" xChannelSelector="R" yChannelSelector="G" result="edge"/>
        <feColorMatrix in="grain" type="saturate" values="0" result="mono"/>
        <feComponentTransfer in="mono" result="soft"><feFuncR type="linear" slope=".22" intercept=".78"/><feFuncG type="linear" slope=".22" intercept=".78"/><feFuncB type="linear" slope=".22" intercept=".78"/></feComponentTransfer>
        <feBlend in="edge" in2="soft" mode="multiply" result="textured"/>
        <feComposite in="textured" in2="edge" operator="in"/>
      </filter>
    </defs></svg>
    <header className="wc-header"><div><p className="eyebrow">Wanderline / The watercolor palette</p><h1>Color Study</h1><p>Choose a color. See what it can become.</p></div><Link to="/">← Explore</Link></header>
    <div className="wc-workspace">
      <section className="wc-wheel-panel" aria-label="Color and wash strength">
        <svg className="wc-wheel" viewBox="0 0 500 500" role="group" aria-label="Watercolor wheel with four wash strengths per hue">
          {STUDY_COLORS.map((color,i)=><g key={color.id}>
            {WASHES.map((name,w)=><path key={name} d={wedge(i,w)} fill={rgb(washColor(color.rgb,w))} filter="url(#wc-grain)" role="button" tabIndex={0}
              aria-label={`${color.name}, ${name.toLowerCase()} wash`} aria-pressed={i===baseIndex&&w===wash}
              onClick={()=>choose(i,w)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose(i,w);}}}
              className={i===baseIndex&&w===wash?"is-selected":""}/>)}
            <text x={point(i*30-90,232).x} y={point(i*30-90,232).y} textAnchor="middle" dominantBaseline="middle" className="wc-hue-label">{color.name}</text>
          </g>)}
          {recommendations.map((p,row)=>{
            const index=STUDY_COLORS.findIndex(c=>c.id===p.hue);
            const at=point(index*30-90,204);
            return <g key={row} className={active.row===row?"wc-marker active":"wc-marker"} aria-hidden="true" pointerEvents="none">
              <circle cx={at.x} cy={at.y} r="10" fill={rgb(partnerColor(p))}/>
              <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central">{row+1}</text>
            </g>;
          })}
          <circle cx="250" cy="250" r="64" fill="#faf8f2"/>
          <text x="250" y="237" textAnchor="middle" className="wc-center-name">{base.name}</text>
          <text x="250" y="264" textAnchor="middle" className="wc-center-wash">{WASHES[wash]} wash</text>
        </svg>
        <p className="wc-wheel-instruction">Choose a hue and a ring. Paler washes sit inside.</p>
        <div className="wc-strengths" role="group" aria-label="Wash strength">{WASHES.map((name,i)=><button key={name} type="button" aria-pressed={wash===i} onClick={()=>{setWash(i);setHover(null);}}><i style={{background:rgb(washColor(base.rgb,i))}}/>{name}</button>)}</div>
        <p className="wc-note">The same wash strength is applied to both colors.</p>
        <div className="wc-partner-key" aria-label="Recommended wheel markers">{recommendations.map((p,i)=><button type="button" key={i} aria-pressed={active.row===i} onClick={()=>inspect(i,.5)}><span>{i+1}</span>{p.name}</button>)}</div>
      </section>
      <section className="wc-comparisons" aria-labelledby="wc-pair-title">
        <div className="wc-section-heading"><h2 id="wc-pair-title">Five ways with {base.name.toLowerCase()}</h2><p>Related hues, a little contrast, and a quieter mix.</p></div>
        <p className="wc-note">Ratios guide exploration; actual paint mixtures vary.</p>
        <div className="wc-inspector" aria-labelledby="wc-inspector-title">
          <Wash sample id={`${uid}-sample`} colors={[sample,sample]}/>
          <div><p className="wc-overline">{hover?"Preview":"Pinned mixture"} · {WASHES[wash]} wash</p><h3 id="wc-inspector-title">{base.name} + {partner.name}</h3>
            <p className="wc-ratio-readout" role="status">{Math.round((1-active.t)*100)}% {base.name} / {Math.round(active.t*100)}% {partner.name}</p>
            <details className="wc-exercise"><summary>Try on paper</summary><p>{partner.guidance}<sup><a href={`#color-source-${partner.source}`} onClick={()=>setSourcesOpen(true)} aria-label={`Source ${partner.source}`}>{partner.source}</a></sup></p></details>
          </div>
        </div>
        <div className="wc-strips">{recommendations.map((p,row)=><section key={p.name} className={active.row===row?"wc-row active":"wc-row"} onPointerLeave={()=>setHover(null)}>
          <header><h3><span>{row+1}</span>{p.name}</h3><span className="wc-kind">{p.kind}</span></header>
          <div className="wc-strip-control">
            <Wash id={`${uid}-strip-${row}`} colors={gradients[row]}/>
            {active.row===row&&<span className="wc-strip-marker" style={{left:`${active.t*100}%`}} aria-hidden="true"/>}
            <input type="range" min="0" max="100" step="1" value={active.row===row?Math.round(active.t*100):50}
              aria-label={`Inspect ${base.name} and ${p.name} ratio`} aria-valuetext={`${base.name} ${ratioLabel(active.row===row?active.t:.5)} ${p.name}`}
              onChange={e=>inspect(row,Number(e.target.value)/100)}
              onFocus={()=>setHover(null)}
              onPointerMove={e=>{if(e.pointerType==="mouse"&&e.buttons===0){const rect=e.currentTarget.getBoundingClientRect();setHover({row,t:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))});}}}
              onPointerDown={()=>setHover(null)}
              onPointerUp={e=>{const rect=e.currentTarget.getBoundingClientRect();if(rect.width)inspect(row,Math.round(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*100)/100);}}
            />
          </div>
          <div className="wc-ratios">{marks.map(t=><button type="button" key={t} onClick={()=>inspect(row,t)} aria-label={`Pin ${base.name} and ${p.name} at ${ratioLabel(t)}`}>{ratioLabel(t)}</button>)}</div>
        </section>)}</div>
        <p className="wc-note">Hover to explore. Click, tap, or use the arrow keys to pin a mixture.</p>
      </section>
    </div>
    <details className="wc-sources" open={sourcesOpen} onToggle={e=>setSourcesOpen(e.currentTarget.open)}>
      <summary>Sources & pigment notes</summary>
      <p>Related and contrasting choices are curated artistic suggestions. Neutralizing partners draw on the references below, with paint-specific qualifications in each exercise. Wheel markers indicate hue families; named earth colors retain their own swatches.</p>
      <p>All swatches are illustrative. Spectral mixing approximates pigment-like blending from screen colors, not measured spectra of your paints. Wash strengths and ratios are visual guides, not water or paint recipes. The shared procedural texture does not predict granulation.</p>
      <ol>{COLOR_SOURCES.map((s,i)=><li key={s.url} id={`color-source-${i+1}`}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ol>
      <a href="https://github.com/rvanwijnen/spectral.js" target="_blank" rel="noreferrer">Spectral.js — illustrative mixing model</a>
    </details>
  </article>;
}

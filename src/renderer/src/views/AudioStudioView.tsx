import { useEffect, useState } from 'react'
import { currentTrack, usePlayer } from '../player'

const freqs = ['32','64','125','250','500','1k','2k','4k','8k','16k']
const presets: Record<string, number[]> = {
  Flat: [0,0,0,0,0,0,0,0,0,0],
  Bass: [7,6,5,3,1,0,0,0,0,0],
  Eletrônica: [5,4,2,0,-1,0,2,3,4,3],
  Rock: [4,3,1,-1,-2,0,2,3,4,3],
  Vocal: [-2,-1,0,2,4,4,3,1,0,-1]
}
function Spectrum() {
  const playing = usePlayer(s=>s.playing)
  const [values,setValues] = useState<number[]>(Array(40).fill(0))
  useEffect(()=>{
    if (!playing) { setValues(Array(40).fill(0)); return }
    const timer = window.setInterval(()=>setValues(usePlayer.getState().spectrum()),90)
    return ()=>window.clearInterval(timer)
  },[playing])
  return <div className="spectrum" aria-label="Visualizador de espectro de áudio">{values.map((v,i)=><span key={i} style={{height:`${Math.max(5,Math.round(v*100))}%`}}/>)}</div>
}
export function AudioStudioView() {
  const gains = usePlayer(s=>s.eqGains)
  const [visualizer,setVisualizer] = useState(()=>localStorage.getItem('openfy-visualizer')!=='off')
  const track = usePlayer(currentTrack)
  const activePreset = Object.entries(presets).find(([,v])=>v.every((n,i)=>n===gains[i]))?.[0] ?? 'Personalizado'
  return <section className="page audio-studio"><div className="discovery-hero"><div className="discovery-eyebrow">OPENFY • AUDIO STUDIO</div><h1>O som do seu jeito.</h1><p>Equalizador de dez bandas, presets e visualização do áudio em tempo real.</p></div>
    <div className="studio-panel"><div className="studio-header"><h2>Equalizador</h2><span>{activePreset}</span></div><div className="preset-row">{Object.entries(presets).map(([name,values])=><button key={name} className={activePreset===name?'selected':''} onClick={()=>usePlayer.getState().setEqGains(values)}>{name}</button>)}</div>
    <div className="eq-sliders">{freqs.map((freq,i)=><label key={freq}><span>{gains[i]>0?'+':''}{gains[i]} dB</span><input aria-label={`${freq} Hz`} type="range" min="-12" max="12" step="1" value={gains[i]} onChange={e=>{const next=[...gains];next[i]=Number(e.target.value);usePlayer.getState().setEqGains(next)}}/><strong>{freq}</strong></label>)}</div>
    <p className="discovery-note">Ajustes salvos neste dispositivo. Para streams de terceiros, as políticas de CORS podem impedir processamento ou visualização do áudio; nesse caso, teste uma faixa local.</p></div>
    <div className="studio-panel"><div className="studio-header"><h2>Visualizador</h2><label className="studio-toggle"><input type="checkbox" checked={visualizer} onChange={e=>{setVisualizer(e.target.checked);localStorage.setItem('openfy-visualizer',e.target.checked?'on':'off')}}/> Ativado</label></div>{visualizer?<Spectrum/>:<p className="empty">Visualizador desativado.</p>}<p className="discovery-note">{track?`Reproduzindo: ${track.title} — ${track.artist}`:'Dê play em uma música para visualizar o espectro.'}</p></div>
  </section>
}

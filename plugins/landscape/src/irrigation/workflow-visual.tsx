const labels = ['Choose area', 'Place devices', 'Connect water', 'Set times']
const instructions = ['Select a lawn or bed, then create a zone.', 'Place heads so their reach overlaps.', 'Join the supply to a valve, then the devices.', 'Choose watering days and minutes for each zone.']

export function WateringWorkflowVisual({ step, onStep, complete }: { step: number; onStep: (step: number) => void; complete: boolean[] }) {
  return <div className="space-y-3">
    <nav aria-label="Watering workflow" className="grid grid-cols-4 gap-1">
      {labels.map((label, i) => <button key={label} type="button" aria-current={step === i ? 'step' : undefined} onClick={() => onStep(i)} className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-center text-[10px] ${step === i ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === i ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{complete[i] ? '✓' : i + 1}</span>{label}
      </button>)}
    </nav>
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/30">
      <svg viewBox="0 0 280 112" role="img" aria-label={instructions[step]} className="w-full text-primary">
        <rect x="18" y="14" width="244" height="84" rx="10" fill="currentColor" opacity=".06" />
        {step === 0 && <>
          <path d="M42 32H152V78H42Z" fill="#73b98a" fillOpacity=".3" stroke="#73b98a" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M184 32Q238 32 238 56Q238 80 184 80Z" fill="#73b98a" fillOpacity=".12" stroke="#73b98a" />
          <path d="M98 49L98 70L104 65L110 77L115 74L109 63L120 63Z" fill="currentColor" />
          <text x="60" y="48" fontSize="10" fill="currentColor">Front lawn</text>
        </>}
        {step === 1 && <>
          {[85, 155, 225].map(x => <g key={x}><circle cx={x} cy="56" r="33" fill="currentColor" opacity=".1" /><circle cx={x} cy="56" r="33" fill="none" stroke="currentColor" strokeDasharray="3 3" /><circle cx={x} cy="56" r="4" fill="currentColor" /><path d={`M${x} 52Q${x + 12} 25 ${x + 27} 42`} fill="none" stroke="currentColor" strokeWidth="2" /></g>)}
        </>}
        {step === 2 && <>
          <path d="M54 56H130H228" stroke="currentColor" strokeWidth="3" fill="none" /><rect x="34" y="36" width="30" height="38" rx="5" fill="currentColor" fillOpacity=".15" stroke="currentColor" /><circle cx="130" cy="56" r="11" fill="var(--background, #20252b)" stroke="currentColor" strokeWidth="2" /><path d="M130 45V32H142" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="228" cy="56" r="5" fill="currentColor" /><path d="M207 44Q228 18 249 44" fill="none" stroke="currentColor" strokeDasharray="3 3" />
          {['Supply', 'Valve', 'Sprinklers'].map((label, i) => <text key={label} x={[49, 130, 228][i]} y="89" textAnchor="middle" fill="currentColor" fontSize="10">{label}</text>)}
        </>}
        {step === 3 && <>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <g key={i}><rect x={35 + i * 31} y="25" width="24" height="24" rx="5" fill="currentColor" opacity={i % 2 === 0 ? '.3' : '.08'} /><text x={47 + i * 31} y="41" textAnchor="middle" fontSize="10" fill="currentColor">{day}</text></g>)}
          <rect x="35" y="65" width="116" height="15" rx="3" fill="currentColor" opacity=".5" /><rect x="155" y="65" width="90" height="15" rx="3" fill="currentColor" opacity=".2" /><text x="42" y="96" fill="currentColor" fontSize="10">Zone 1 · 15 min</text><text x="159" y="96" fill="currentColor" fontSize="10">Zone 2 · 10 min</text>
        </>}
      </svg>
      <div className="space-y-1 px-3 pb-3"><p className="text-sm font-medium">{step + 1}. {labels[step]}</p><p className="text-xs text-muted-foreground">{instructions[step]}</p></div>
    </div>
  </div>
}

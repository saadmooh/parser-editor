import type { PathwayFinish } from '../domain/schema'

const finishColors: Record<PathwayFinish, string> = {
  concrete: '#b8b4a8', brick: '#a96e55', stone: '#a9a394', gravel: '#b2a58d',
  laidStone: '#a9ad9d', concreteSlabs: '#bdbbaa', grassFlagstones: '#a8aca4',
  riverStones: '#b6b4a8', steppingStones: '#c5c5bc',
}

export function PavingFinishThumbnail({ finish }: { finish: PathwayFinish }) {
  const color = finishColors[finish]
  return <svg aria-hidden="true" viewBox="0 0 48 36" className="h-8 w-10 flex-none rounded border border-white/10">
    <rect width="48" height="36" fill={finish === 'grassFlagstones' ? '#58634b' : '#6f6c63'} />
    {finish === 'brick' && <>
      {[0, 12, 24, 36].map((y, row) => <g key={y} fill={color} stroke="#756353" strokeWidth="1.2">
        {[-12, 0, 12, 24, 36, 48].map((x) => <rect key={x} x={x + (row % 2 ? 6 : 0)} y={y} width="12" height="12" rx="1" />)}
      </g>)}
    </>}
    {finish === 'stone' && <g fill={color} stroke="#77766d" strokeWidth="1.4">
      <rect x="1" y="1" width="22" height="16" rx="1" /><rect x="25" y="1" width="22" height="16" rx="1" />
      <rect x="1" y="19" width="22" height="16" rx="1" /><rect x="25" y="19" width="22" height="16" rx="1" />
    </g>}
    {finish === 'concrete' && <g fill={color}>
      <rect width="48" height="36" />
      {[[7, 8], [25, 5], [36, 15], [14, 27], [31, 29]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".7" fill="#99958a" />)}
    </g>}
    {finish === 'concreteSlabs' && <g fill={color} stroke="#77766d" strokeWidth="1.4">
      <rect x="1" y="1" width="22" height="16" /><rect x="25" y="1" width="22" height="16" />
      <rect x="1" y="19" width="22" height="16" /><rect x="25" y="19" width="22" height="16" />
    </g>}
    {finish === 'gravel' && <g fill={color}>
      {[[4, 5, 1.4], [11, 10, 1.8], [18, 4, 1.2], [28, 7, 1.8], [39, 4, 1.2], [6, 20, 1.8], [16, 27, 1.4], [27, 19, 1.8], [38, 28, 1.7], [44, 16, 1.4], [3, 32, 1.1], [22, 14, 1.1], [34, 12, 1.1]].map(([cx, cy, r], index) => <circle key={index} cx={cx} cy={cy} r={r} />)}
    </g>}
    {finish === 'laidStone' && <g fill={color} stroke="#73736b" strokeWidth="1">
      <path d="M2 5 13 2l7 5-2 8-12 2-5-5z" /><path d="m23 3 13 1 5 7-6 7-13-2-2-7z" />
      <path d="m4 20 11-3 8 6-3 10-13 1-6-7z" /><path d="m26 20 12-2 8 6-4 10-14-1-4-7z" />
    </g>}
    {finish === 'grassFlagstones' && <g fill={color} stroke="#667456" strokeWidth="1.2">
      <path d="m2 4 11-2 7 6-3 7-13 1-3-6z" /><path d="m25 2 13 2 6 7-7 6-12-2-3-7z" />
      <path d="m7 20 12-2 7 6-3 10-13 1-5-7z" /><path d="m31 20 10-2 6 7-5 9-11-2-3-7z" />
    </g>}
    {finish === 'riverStones' && <g fill={color} stroke="#858379" strokeWidth=".7">
      {[[5, 6, 4, 2.6], [15, 4, 3.1, 2.2], [25, 6, 4.3, 2.7], [38, 5, 4, 2.8], [9, 14, 4.5, 3], [21, 14, 3.8, 2.7], [34, 15, 5, 3], [4, 25, 4, 3], [16, 25, 5, 3], [29, 26, 4, 3], [41, 26, 4.4, 3], [22, 33, 3, 2]].map(([cx, cy, rx, ry], index) => <ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} />)}
    </g>}
    {finish === 'steppingStones' && <g fill={color} stroke="#858379" strokeWidth="1">
      <rect x="1" y="2" width="10" height="8" rx="3" /><rect x="16" y="5" width="11" height="8" rx="3" />
      <rect x="33" y="2" width="12" height="8" rx="3" /><rect x="6" y="17" width="12" height="9" rx="3" />
      <rect x="25" y="16" width="11" height="9" rx="3" /><rect x="15" y="29" width="13" height="6" rx="3" />
      <rect x="38" y="28" width="9" height="7" rx="3" />
    </g>}
  </svg>
}

export function PathwayModeThumbnail({ kind }: { kind: 'straight' | 'curve' | 'stones' }) {
  return <svg aria-hidden="true" viewBox="0 0 64 42" className="h-8 w-12 flex-none rounded border border-white/10 bg-[#292b2a]">
    {kind === 'straight' && <>
      <path d="M8 34 30 22 55 8" fill="none" stroke="#aaa28c" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 34 30 22 55 8" fill="none" stroke="#d6d0bd" strokeWidth="1" strokeDasharray="2 2" />
    </>}
    {kind === 'curve' && <>
      <path d="M8 34 C18 32 19 11 33 12 S47 30 56 8" fill="none" stroke="#aaa28c" strokeWidth="13" strokeLinecap="round" />
      <path d="M8 34 C18 32 19 11 33 12 S47 30 56 8" fill="none" stroke="#d6d0bd" strokeWidth="1" strokeDasharray="2 2" />
    </>}
    {kind === 'stones' && <g fill="#c4c1b5" stroke="#77786e" strokeWidth="1">
      <ellipse cx="12" cy="32" rx="6" ry="4" /><ellipse cx="25" cy="25" rx="6" ry="4" />
      <ellipse cx="39" cy="18" rx="6" ry="4" /><ellipse cx="53" cy="10" rx="6" ry="4" />
    </g>}
  </svg>
}

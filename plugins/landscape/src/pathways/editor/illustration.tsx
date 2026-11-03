export function PathwayIllustration({ curved = true, paved = false }: { curved?: boolean; paved?: boolean }) {
  const route = curved
    ? 'M 25 170 C 80 170 70 60 130 80 S 205 145 235 45'
    : 'M 25 170 L 100 170 L 100 65 L 235 65'
  return (
    <svg
      viewBox="0 0 260 220"
      role="img"
      aria-label={curved ? 'Curved walkway' : 'Straight walkway'}
      style={{ width: '100%', display: 'block' }}
    >
      <rect width="260" height="220" fill="#e8ece2" />
      <path
        d={route}
        fill="none"
        stroke="#a79982"
        strokeWidth="29"
        strokeLinejoin="round"
      />
      <path
        d={route}
        fill="none"
        stroke="#d5cab5"
        strokeWidth="23"
        strokeLinejoin="round"
      />
      {paved && <path d={route} fill="none" stroke="#8b937d" strokeWidth="29" strokeDasharray="1.5 8" />}
    </svg>
  )
}

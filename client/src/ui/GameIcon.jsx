import { u } from './format'

/**
 * Smooth vector icons for the buttons (drawn here, no icon font): white shapes with a
 * soft dark outline and shadow, so they read on any button colour.
 */

const SHAPES = {
  gear: (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="10.4" y="1.6" width="3.2" height="5" rx="1" transform={`rotate(${i * 45} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="7.2" />
      <circle cx="12" cy="12" r="2.8" fill="rgba(30,20,60,0.85)" stroke="none" />
    </g>
  ),
  sword: (
    <g>
      <path d="M19.8 2.5 L21.5 4.2 L10.5 15.2 L8.8 13.5 Z" />
      <path d="M6.2 13.2 L10.8 17.8 L9.6 19 L5 14.4 Z" />
      <path d="M7.4 17.4 L4.2 20.6 Q3.3 21.5 2.6 20.8 Q2 20.1 2.9 19.3 L6.1 16.1 Z" />
    </g>
  ),
  pick: (
    <g>
      <path d="M3.5 9.5 Q11 2 20.5 6.5 Q13.5 5.5 9.2 10.8 Z" />
      <path d="M8.6 10.2 L10.8 12.4 L4.3 20.8 Q3.4 21.7 2.7 21 Q2 20.3 2.9 19.4 Z" />
    </g>
  ),
  cube: (
    <g>
      <path d="M12 2.5 L21 7.2 L12 11.9 L3 7.2 Z" />
      <path d="M3 8.6 L11.2 13 L11.2 21.8 L3 17.3 Z" fill="rgba(255,255,255,0.78)" />
      <path d="M21 8.6 L12.8 13 L12.8 21.8 L21 17.3 Z" fill="rgba(255,255,255,0.6)" />
    </g>
  ),
  apple: (
    <g>
      <path d="M12 7.5 Q8 4.8 5.2 7.6 Q2.4 11 4.6 16 Q7 21.5 10 20.6 Q12 20 14 20.6 Q17 21.5 19.4 16 Q21.6 11 18.8 7.6 Q16 4.8 12 7.5 Z" />
      <path d="M12 7 Q12.4 3.6 14.6 2.4" fill="none" strokeWidth="1.6" />
      <path d="M13.2 5 Q16.5 2.2 19 3.6 Q16.8 6.6 13.2 5 Z" />
    </g>
  ),
  potion: (
    <g>
      <rect x="9.3" y="2" width="5.4" height="2.6" rx="1" />
      <path d="M10 4.6 L14 4.6 L14 8.6 Q19.5 10.6 19.5 15.4 Q19.5 21.5 12 21.5 Q4.5 21.5 4.5 15.4 Q4.5 10.6 10 8.6 Z" />
      <path d="M6.2 15 Q12 13 17.8 15 Q17.6 19.8 12 19.8 Q6.4 19.8 6.2 15 Z" fill="rgba(255,120,200,0.9)" stroke="none" />
    </g>
  ),
  ball: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="9" r="2.4" fill="rgba(200,230,255,0.9)" stroke="none" />
    </g>
  ),
  bow: (
    <g>
      <path d="M5 3 Q20 6 21 19 L18.6 19 Q17.6 8.6 5 5.4 Z" />
      <path d="M5 4.2 L19.8 19" fill="none" strokeWidth="1.4" />
      <path d="M9 13 L17 5 M17 5 L13.8 5.4 M17 5 L16.6 8.2" fill="none" strokeWidth="1.8" />
    </g>
  ),
  up: <path d="M12 3 L21 13 L15.5 13 L15.5 21 L8.5 21 L8.5 13 L3 13 Z" />,
  down: (
    <g>
      <path d="M4 5 L12 12 L20 5 L20 9 L12 16 L4 9 Z" />
      <path d="M4 12 L12 19 L20 12 L20 15.5 L12 22 L4 15.5 Z" fill="rgba(255,255,255,0.7)" />
    </g>
  ),
  eye: (
    <g>
      <path d="M1.8 12 Q12 2 22.2 12 Q12 22 1.8 12 Z" />
      <circle cx="12" cy="12" r="4" fill="rgba(30,20,60,0.85)" stroke="none" />
      <circle cx="13.4" cy="10.6" r="1.3" fill="#fff" stroke="none" />
    </g>
  ),
}

export default function GameIcon({ name, size = 30, color = '#ffffff' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: u(size), height: u(size), filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.45))', overflow: 'visible' }}
      fill={color}
      stroke="rgba(20,12,40,0.75)"
      strokeWidth="1.1"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {SHAPES[name] || SHAPES.cube}
    </svg>
  )
}

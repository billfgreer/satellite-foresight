import styles from './Header.module.css'

function LogoMark() {
  return (
    <svg className={styles.logoMark} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="72" cy="100" r="45" fill="#FFE000" />
      <circle cx="98" cy="138" r="15" fill="#E8384A" />
      <path d="M18,175 C50,150 90,105 122,68 C140,48 165,35 185,42 C205,50 208,68 195,78 C185,86 172,82 170,72"
        fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
      <polygon points="128,68 96,150 159,150" fill="#FF1870" />
      <ellipse cx="127" cy="151" rx="38" ry="11" fill="#00C8D7" />
      <ellipse cx="127" cy="151" rx="16" ry="5" fill="#FF1870" />
      <circle cx="128" cy="64" r="10" fill="#00C8D7" />
    </svg>
  )
}

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <LogoMark />
        Satellite Foresight
      </div>
      <span className={styles.tagline}>Tasking Transparency</span>
    </header>
  )
}

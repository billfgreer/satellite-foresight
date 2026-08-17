import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoMark} aria-hidden="true" />
        Satellite Foresight
      </div>
      <span className={styles.tagline}>Tasking Transparency</span>
    </header>
  )
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, SignInButton, useUser } from '@clerk/nextjs';
import styles from './NavBar.module.css';

export default function NavBar() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.navLinks}>
          <Link href="/" className={`${styles.navLink} ${pathname === '/' || pathname === '/battle' ? styles.active : ''}`}>
             ⚔️ AI Battler
          </Link>
          <Link href="/history" className={`${styles.navLink} ${pathname === '/history' ? styles.active : ''}`}>
             📜 History
          </Link>
          <Link href="/queue" className={`${styles.navLink} ${pathname === '/queue' ? styles.active : ''}`}>
             ⏳ Queue
          </Link>
        </div>
        <div className={styles.navAuth}>
          {isLoaded && isSignedIn && <UserButton />}
          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal" >
              <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Login</button>
            </SignInButton>
          )}
        </div>
      </div>
    </nav>
  );
}

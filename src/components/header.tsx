import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/logout-button';
import { LanguageSelector } from '@/components/language-selector';
import { MobileNav } from '@/components/mobile-nav';
import { ScrollHeader } from '@/components/scroll-header';
import { t, type Language } from '@/lib/translations';
import { IS_MANAGED } from '@/lib/config';

interface HeaderProps {
  currentPage?: 'home' | 'library' | 'review' | 'mi-sistema' | 'journal';
}

export async function Header({ currentPage }: HeaderProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let lang: Language = 'es';

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('language')
      .eq('id', user.id)
      .single();
    lang = (profile?.language || 'es') as Language;
  }

  return (
    <ScrollHeader>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-sm border border-j-accent flex items-center justify-center j-glow-accent">
              <span className="text-j-accent font-mono text-xs">J</span>
            </div>
            <span className="font-mono text-sm tracking-[0.1em] text-j-text uppercase group-hover:text-j-accent transition-colors">
              Jarre
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              aria-current={currentPage === 'library' ? 'page' : undefined}
              className={`font-mono text-[11px] tracking-[0.15em] uppercase transition-colors ${
                currentPage === 'library'
                  ? 'text-j-accent'
                  : 'text-j-text-secondary hover:text-j-text'
              }`}
            >
              <span className="text-j-accent">01</span><span className="mx-1 text-j-text-tertiary">.</span>
              {t('nav.library', lang)}
            </Link>

            {user ? (
              <>
                {IS_MANAGED && (
                  <Link
                    href="/profile"
                    className="font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-secondary hover:text-j-text transition-colors"
                  >
                    Profile
                  </Link>
                )}
                <LanguageSelector currentLanguage={lang} />
                <LogoutButton label={t('nav.logout', lang)} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-mono text-[11px] tracking-[0.15em] text-j-text-secondary uppercase hover:text-j-text transition-colors"
                >
                  {t('common.login', lang)}
                </Link>
                <Link
                  href="/signup"
                  className="font-mono text-[11px] tracking-[0.15em] bg-j-accent text-j-text-on-accent px-4 py-2 uppercase hover:bg-j-accent-hover transition-colors"
                >
                  {t('common.signup', lang)}
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Navigation */}
          {user ? (
            <MobileNav
              links={[
                { href: '/dashboard', label: `01. ${t('nav.library', lang)}`, active: currentPage === 'library' },
                ...(IS_MANAGED ? [{ href: '/profile', label: 'Profile', active: false }] : []),
              ]}
              isAuthenticated
              logoutLabel={t('nav.logout', lang)}
              currentLanguage={lang}
            />
          ) : (
            <MobileNav
              links={[
                { href: '/dashboard', label: `01. ${t('nav.library', lang)}`, active: currentPage === 'library' },
                { href: '/login', label: t('common.login', lang), active: false },
                { href: '/signup', label: t('common.signup', lang), active: false },
              ]}
              isAuthenticated={false}
              logoutLabel=""
            />
          )}
        </div>
      </div>
    </ScrollHeader>
  );
}

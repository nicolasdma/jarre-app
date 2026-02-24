'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';
import { LanguageSelector } from '@/components/language-selector';

interface NavLink {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}

interface MobileNavProps {
  links: NavLink[];
  isAuthenticated: boolean;
  logoutLabel: string;
  currentLanguage?: 'es' | 'en';
}

export function MobileNav({ links, isAuthenticated, logoutLabel, currentLanguage }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus trap: cycle Tab within menu panel
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Focus first link on open
    const focusableElements = panel.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  const handleOverlayClick = useCallback(() => {
    setIsOpen(false);
    toggleRef.current?.focus();
  }, []);

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col justify-center items-center w-8 h-8 gap-1.5 min-h-[44px]"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span className={`block w-5 h-px bg-j-text transition-all duration-200 ${isOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`} />
        <span className={`block w-5 h-px bg-j-text transition-all duration-200 ${isOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-px bg-j-text transition-all duration-200 ${isOpen ? '-rotate-45 -translate-y-[3.5px]' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Semitransparent overlay — closes menu on click */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />

          {/* Menu panel */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute top-full left-0 right-0 bg-j-bg/95 backdrop-blur-lg border-b border-j-border z-50"
          >
            <nav className="flex flex-col px-4 sm:px-8 py-4 gap-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={link.active ? 'page' : undefined}
                  className={`font-mono text-[11px] tracking-[0.15em] uppercase transition-colors flex items-center gap-2 py-2 min-h-[44px] ${
                    link.active ? 'text-j-accent' : 'text-j-text-secondary'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {isAuthenticated && (
                <div className="border-t border-j-border pt-3 mt-1 flex flex-col gap-3">
                  {currentLanguage && (
                    <div className="flex items-center gap-2 py-2 min-h-[44px]">
                      <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-tertiary">Lang:</span>
                      <LanguageSelector currentLanguage={currentLanguage} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2 min-h-[44px]">
                    <LogoutButton label={logoutLabel} />
                  </div>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

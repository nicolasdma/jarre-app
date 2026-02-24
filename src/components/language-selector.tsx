'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Language = 'es' | 'en';

export function LanguageSelector({ currentLanguage }: { currentLanguage: Language }) {
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const nextLanguage: Language = language === 'es' ? 'en' : 'es';

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextLanguage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update language');
      }

      setLanguage(nextLanguage);
      router.refresh();
    } catch (error) {
      console.error('Error updating language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      aria-label={`Switch language to ${nextLanguage === 'es' ? 'Español' : 'English'}`}
      className={`font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-secondary hover:text-j-text transition-colors ${
        isLoading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {language.toUpperCase()}
    </button>
  );
}

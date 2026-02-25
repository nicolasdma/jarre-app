'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JarreButton } from '@/components/jarre-button';
import { ErrorMessage } from '@/components/error-message';

type Lang = 'es' | 'en';

const AUTH_STRINGS: Record<string, Record<Lang, string>> = {
  createAccount: { es: 'Crea tu cuenta', en: 'Create your account' },
  createAccountSubtitle: { es: 'Comienza tu camino de aprendizaje', en: 'Start your journey to becoming an AI architect' },
  name: { es: 'Nombre', en: 'Name' },
  namePlaceholder: { es: 'Tu nombre', en: 'Your name' },
  email: { es: 'Correo electrónico', en: 'Email' },
  password: { es: 'Contraseña', en: 'Password' },
  minChars: { es: 'Mínimo 6 caracteres', en: 'Minimum 6 characters' },
  creating: { es: 'Creando cuenta...', en: 'Creating account...' },
  create: { es: 'Crear cuenta', en: 'Create account' },
  hasAccount: { es: '¿Ya tienes cuenta?', en: 'Already have an account?' },
  signIn: { es: 'Iniciar sesión', en: 'Sign in' },
  checkEmail: { es: 'Revisa tu correo', en: 'Check your email' },
  confirmationSent: { es: 'Te enviamos un link de confirmación a', en: 'We sent a confirmation link to' },
  clickLink: { es: 'Haz clic en el link de tu correo para activar tu cuenta.', en: 'Click the link in your email to activate your account.' },
};

function detectLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'es';
  const browserLang = navigator.language?.split('-')[0];
  return browserLang === 'en' ? 'en' : 'es';
}

export default function SignupPage() {
  const router = useRouter();
  const language = useMemo(detectLanguage, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const s = (key: string) => AUTH_STRINGS[key]?.[language] ?? AUTH_STRINGS[key]?.en ?? key;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          language,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-j-bg px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{s('checkEmail')}</CardTitle>
            <CardDescription>
              {s('confirmationSent')} <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-j-text-secondary">
              {s('clickLink')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-j-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{s('createAccount')}</CardTitle>
          <CardDescription>{s('createAccountSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{s('name')}</Label>
              <Input
                id="displayName"
                type="text"
                placeholder={s('namePlaceholder')}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{s('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{s('password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-j-text-tertiary hover:text-j-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-j-text-tertiary">{s('minChars')}</p>
            </div>

            {error && <ErrorMessage message={error} variant="inline" />}

            <JarreButton type="submit" className="w-full" disabled={loading}>
              {loading ? s('creating') : s('create')}
            </JarreButton>
          </form>

          <p className="mt-4 text-center text-sm text-j-text-secondary">
            {s('hasAccount')}{' '}
            <Link href="/login" className="font-medium text-j-text hover:underline">
              {s('signIn')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

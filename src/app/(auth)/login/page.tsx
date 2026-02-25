'use client';

import { Suspense, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  welcomeBack: { es: 'Bienvenido de nuevo', en: 'Welcome back' },
  signInSubtitle: { es: 'Inicia sesión para continuar aprendiendo', en: 'Sign in to continue your learning journey' },
  email: { es: 'Correo electrónico', en: 'Email' },
  password: { es: 'Contraseña', en: 'Password' },
  signingIn: { es: 'Iniciando sesión...', en: 'Signing in...' },
  signIn: { es: 'Iniciar sesión', en: 'Sign in' },
  noAccount: { es: '¿No tienes cuenta?', en: "Don't have an account?" },
  signUp: { es: 'Registrarse', en: 'Sign up' },
  forgotPassword: { es: '¿Olvidaste tu contraseña?', en: 'Forgot your password?' },
  loading: { es: 'Cargando...', en: 'Loading...' },
};

function detectLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'es';
  const browserLang = navigator.language?.split('-')[0];
  return browserLang === 'en' ? 'en' : 'es';
}

function sanitizeRedirect(redirect: string | null): string {
  if (!redirect) return '/';
  // Only allow relative paths, block protocol-based redirects
  if (!redirect.startsWith('/') || redirect.includes('://')) return '/';
  return redirect;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = sanitizeRedirect(searchParams.get('redirect'));
  const language = useMemo(detectLanguage, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const s = (key: string) => AUTH_STRINGS[key]?.[language] ?? AUTH_STRINGS[key]?.en ?? key;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-j-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{s('welcomeBack')}</CardTitle>
          <CardDescription>{s('signInSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{s('password')}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-j-text-tertiary hover:text-j-accent transition-colors"
                >
                  {s('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            {error && <ErrorMessage message={error} variant="inline" />}

            <JarreButton type="submit" className="w-full" disabled={loading}>
              {loading ? s('signingIn') : s('signIn')}
            </JarreButton>
          </form>

          <p className="mt-4 text-center text-sm text-j-text-secondary">
            {s('noAccount')}{' '}
            <Link href="/signup" className="font-medium text-j-text hover:underline">
              {s('signUp')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-j-bg">
        <p className="text-j-text-tertiary">{AUTH_STRINGS.loading.es}</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

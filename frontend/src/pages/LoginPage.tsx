import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { ThemeSwitcher } from '@/components/chrms/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/chrms/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Chrome, Github, Loader2 } from 'lucide-react';
import { ChiroLogo } from '@/components/chrms/ChiroLogo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithSSO, logout, authMode, lastError } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.ok) {
        toast({
          title: "Login Successful",
          description: "Welcome to CHRMS.",
        });
        navigate('/dashboard');
      } else {
        toast({
          title: "Login Failed",
          description:
            "error" in result ? result.error : "Login failed",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred during login.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = async (provider: string) => {
    setIsLoading(true);
    try {
      const result = await loginWithSSO(provider);
      if (result.ok) {
        toast({
          title: "SSO Login Successful",
          description: `Logged in with ${provider}`,
        });
        navigate('/dashboard');
      } else {
        toast({
          title: "SSO unavailable",
          description:
            "error" in result ? result.error : "SSO is not available.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "SSO Login Failed",
        description: "Failed to authenticate with SSO provider.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authMode === 'keycloak') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <ChiroLogo size={88} className="mx-auto" />
          <div>
            <CardTitle>Chiro City Housing &amp; Rental Management</CardTitle>
            <CardDescription className="mt-2">Use your Chiro Auth account to access CHRMS.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastError && <p role="alert" className="text-destructive">{lastError}</p>}
          <Button className="w-full" disabled={isLoading} onClick={() => handleSSOLogin('Chiro Auth')}>Sign in with Chiro Auth</Button>
          <Button variant="outline" className="w-full" onClick={logout}>Sign out / switch account</Button>
          <p className="text-sm text-muted-foreground">Your administrator must grant access to CHRMS.</p>
        </CardContent>
      </Card>
    </div>
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-cyan-50 dark:from-background dark:via-background dark:to-background flex items-center justify-center p-4 relative" data-id="0v4to7nyx" data-path="src/pages/LoginPage.tsx">
      <div className="absolute top-4 end-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-md space-y-8" data-id="hjwo2jiph" data-path="src/pages/LoginPage.tsx">
        <div className="text-center" data-id="oq8qgjhxk" data-path="src/pages/LoginPage.tsx">
          <ChiroLogo size={96} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">{t('app.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('login.subtitle')}
          </p>
        </div>

        <Card className="shadow-lg" data-id="nn7m6b787" data-path="src/pages/LoginPage.tsx">
          <CardHeader data-id="p34dd2tkz" data-path="src/pages/LoginPage.tsx">
            <CardTitle data-id="q4zut3pka" data-path="src/pages/LoginPage.tsx">{t('login.signIn')}</CardTitle>
            <CardDescription>
              {t('login.cardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6" data-id="1mt5nb4b9" data-path="src/pages/LoginPage.tsx">
            <form onSubmit={handleLogin} className="space-y-4" data-id="1x51ohzy6" data-path="src/pages/LoginPage.tsx">
              <div className="space-y-2" data-id="oc9bic79t" data-path="src/pages/LoginPage.tsx">
                <Label htmlFor="email" data-id="ak6ipegz9" data-path="src/pages/LoginPage.tsx">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required data-id="8xsfc7dqu" data-path="src/pages/LoginPage.tsx" />

              </div>

              <div className="space-y-2" data-id="gwo3x3x9j" data-path="src/pages/LoginPage.tsx">
                <Label htmlFor="password" data-id="rp93tcyml" data-path="src/pages/LoginPage.tsx">{t('login.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required data-id="rmlfit5na" data-path="src/pages/LoginPage.tsx" />

              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                disabled={isLoading} data-id="dgejjhlyd" data-path="src/pages/LoginPage.tsx">

                {isLoading ?
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" data-id="634u1we1q" data-path="src/pages/LoginPage.tsx" />
                    {t('login.signingIn')}
                  </> :

                t('login.signIn')
                }
              </Button>
            </form>

            <div className="relative" data-id="39vr6tka9" data-path="src/pages/LoginPage.tsx">
              <div className="absolute inset-0 flex items-center" data-id="jy0eh57o0" data-path="src/pages/LoginPage.tsx">
                <Separator data-id="3lxc7w1s9" data-path="src/pages/LoginPage.tsx" />
              </div>
              <div className="relative flex justify-center text-xs uppercase" data-id="uh8p4nfjs" data-path="src/pages/LoginPage.tsx">
                <span className="bg-background px-2 text-muted-foreground" data-id="taiifdb6t" data-path="src/pages/LoginPage.tsx">{t('login.orContinue')}</span>
              </div>
            </div>

            {/* SSO Options */}
            <div className="grid grid-cols-2 gap-3" data-id="ax7stvxh3" data-path="src/pages/LoginPage.tsx">
              <Button
                variant="outline"
                onClick={() => handleSSOLogin('Google')}
                disabled={isLoading}
                className="w-full" data-id="6e89gyfmb" data-path="src/pages/LoginPage.tsx">

                <Chrome className="mr-2 h-4 w-4" data-id="vjje5dx6h" data-path="src/pages/LoginPage.tsx" />
                Google
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSSOLogin('Microsoft')}
                disabled={isLoading}
                className="w-full" data-id="yt8gxoeao" data-path="src/pages/LoginPage.tsx">

                <Github className="mr-2 h-4 w-4" data-id="rry97zjba" data-path="src/pages/LoginPage.tsx" />
                Microsoft
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground" data-id="qq3kgxghm" data-path="src/pages/LoginPage.tsx">
              <p data-id="0s4kaouu2" data-path="src/pages/LoginPage.tsx">{t('login.noAccount')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="text-center text-xs text-muted-foreground">
          <p>{t('login.footer')}</p>
          <p>React Â· NestJS API</p>
        </div>
      </div>
    </div>);

};

export default LoginPage;
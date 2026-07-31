import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { Card } from '@/components/ui/kit';
import { getSession } from '@/lib/auth';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === 'cashier' ? '/pos' : session.role === 'platform_admin' ? '/admin' : '/dashboard');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-3xl font-bold text-brand">Localy</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">Вход в демонстрационный кабинет</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Выберите роль — права и навигация изменятся автоматически.
          </p>
        </div>
        <Card className="p-6">
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}

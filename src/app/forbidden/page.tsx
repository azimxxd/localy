import Link from 'next/link';
import { logoutAction } from '@/app/login/actions';
import { Button, Card, btnClass } from '@/components/ui/kit';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <Card className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase text-danger">Доступ ограничен</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">У этой роли нет доступа к разделу</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Вернитесь в свой рабочий раздел или войдите под другой демонстрационной ролью.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard" className={btnClass('secondary')}>
            В кабинет
          </Link>
          <form action={logoutAction}>
            <Button type="submit">Сменить роль</Button>
          </form>
        </div>
      </Card>
    </main>
  );
}

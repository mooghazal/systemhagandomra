'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@hagamra/shared/components/ui/Button';
import { Field, Input } from '@hagamra/shared/components/ui/Field';
import { authService } from '@hagamra/shared/services';

const schema = z.object({
  email: z.string().min(1, 'البريد الإلكتروني مطلوب').email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type LoginForm = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFailure(null);

    try {
      await authService.login(email, password);

      // Only paths from this app, never an absolute URL: a `next` parameter
      // pointing somewhere else would turn the login into an open redirect.
      const next = params.get('next');
      const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

      // refresh() re-runs the server layout so the new session is picked up.
      router.replace(destination);
      router.refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'تعذّر تسجيل الدخول.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {failure && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-base)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{failure}</span>
        </div>
      )}

      <Field label="البريد الإلكتروني" required error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <Mail
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id={id}
              type="email"
              autoComplete="username"
              dir="ltr"
              placeholder="admin@example.com"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              // The icon sits at the wrapper's inline-end, which is the left
              // in this RTL form. This input is dir="ltr" so its own logical
              // start is also the left — hence ps, not pe, or the text would
              // run underneath the icon.
              className="ps-10 text-start"
              {...register('email')}
            />
          </div>
        )}
      </Field>

      <Field label="كلمة المرور" required error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <Lock
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className="pe-10"
              {...register('password')}
            />
          </div>
        )}
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        تسجيل الدخول
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">ح</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">نظام إدارة الحج والعمرة</p>
        </div>

        <div className="rounded-[var(--radius-base)] border border-border-subtle bg-surface p-6 shadow-sm">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          الدخول متاح للمصرّح لهم فقط
        </p>
      </div>
    </main>
  );
}

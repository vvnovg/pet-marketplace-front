# Спецификация фронтенда: Phase 2 — Auth flows

- **Дата:** 2026-07-20
- **Опирается на:** `docs/superpowers/specs/2026-07-20-pet-marketplace-frontend-design.md` (мастер-спека), Phase 1 (фундамент, смержен в `main`, commit `13fa543`).
- **Назначение:** поток аутентификации — регистрация, верификация email, логин, восстановление/сброс пароля, клиентская сессия, ролевой guard admin-зоны и клиентская обработка 401.

---

## 1. Цель и границы

### 1.1. Цель
Полностью рабочий auth-поток поверх существующего REST API бэка (`/auth/*` + `/users/me`): пользователь регистрируется → верифицирует email → логинится → попадает в защищённую зону по роли; может выйти, восстановить и сбросить пароль. Сессия driven клиентом (TanStack Query `/users/me`), guard middleware проверяет роль для admin-зоны.

### 1.2. В рамках
- 3 новых серверных Next-роута: `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password` (Phase 1 уже имеет login/register/refresh/logout).
- 5 auth-страниц в route group `(auth)`: `/login`, `/register`, `/verify-email-info`, `/verify-email`, `/forgot-password`, `/reset-password`.
- Клиентская сессия: `SessionProvider` (`useQuery(["session"]) → getCurrentUser()`), auth-aware `UserMenu` (вместо stub Phase 1), logout-поток.
- Ролевой редирект после логина: `callbackUrl` → иначе по роли (`ADMIN`/`MODERATOR` → `/admin`, прочие → `/dashboard`).
- Middleware: для `/(admin)/**` — загрузка `/users/me` и проверка `role ∈ {ADMIN, MODERATOR}`.
- Клиентская обработка 401 (после неудачного refresh в прокси): очистка сессии + редирект на `/login`.
- Тонкие placeholder-страницы `/dashboard` и `/admin` (только чтобы редиректы/роли были проверяемы e2e; реальный контент — фазы 3+).
- zod-схемы, зеркалящие Bean Validation бэка; i18n-ключи `Auth.*`.

### 1.3. Вне рамок
- Реальные dashboard-страницы (профиль, мои объявления, бронирования, чат, избранное, подписки) — фазы 3–7.
- Реальная admin-панель (users/listings/reviews pending, статистика) — фаза 8.
- Редактирование профиля, аватар, `PUT /users/me` — фаза 4.
- Endpoint `resend-verification` (нет на бэке) — не реализуем.
- OAuth2 — вне рамок (мастер-спека §1.3).

### 1.4. Критерии приёмки
- `register` (валидные данные) → 201 → редирект на `/verify-email-info`.
- `/verify-email-info` dev-помощник: вставка токена → `/api/auth/verify-email` → успех → редирект `/login?verified=1`; невалидный/просроченный → inline-ошибка.
- `/login` (верифицированный пользователь) → успех → редирект по `callbackUrl` или по роли.
- `ADMIN`/`MODERATOR` после логина → `/admin`; `BUYER`/`SELLER` → `/dashboard`.
- `/(admin)/**` без доступа (не-админ или без сессии) → редирект `/${locale}/login?callbackUrl=...`.
- `/(dashboard)/**` без cookie → редирект на логин (уже работало в Phase 1).
- Клиентский 401 (refresh в прокси не удался) → сессия сброшена, редирект `/login?callbackUrl=...`.
- `logout` → cookie очищены, сессия сброшена, редирект `/`.
- `forgot-password` → всегда успех-сообщение (не раскрывает существование аккаунта).
- `reset-password` (валидный токен) → успех → `/login?reset=1`; невалидный → inline-ошибка.
- RU/EN-локализация всех форм и сообщений валидации.
- Валидации форм совпадают с Bean Validation бэка (см. §4).

---

## 2. Бэкенд-контракт (подтверждён из клона `/Users/vvnovg/pet-marketplace`)

`AuthController` (`/auth`):
| Endpoint | Тело/Query | Ответ | Валидация |
|---|---|---|---|
| `POST /auth/register` | `{email,password,phone?,firstName?,lastName?}` | 201 `void` / 400 / 409 | email `@Email` ≤255; password ≥8; phone ≤20; firstName/lastName ≤100 |
| `POST /auth/login` | `{email,password}` → `TokenResponse` | 200 / 401 | email `@Email` ≤255; password ≥8 |
| `POST /auth/refresh` | `{refreshToken}` → `TokenResponse` | 200 / 401 | refreshToken `@NotBlank` |
| `POST /auth/logout` | `{refreshToken}` | 200 | refreshToken `@NotBlank` |
| `POST /auth/verify-email` | query `token` | 200 / 400 | — |
| `POST /auth/forgot-password` | `{email}` | 200 (всегда) | email `@Email` ≤255 |
| `POST /auth/reset-password` | `{token,newPassword}` | 200 / 400 | token `@NotBlank`; newPassword ≥8 |

`Role` enum (бэк): `BUYER, SELLER, ADMIN, MODERATOR` (MODERATOR присутствует, в отличие от замечания мастер-спеки §12).

`UserProfileResponse` (поле `role`, `verified`, `active`, `email`, `firstName`, `lastName`, `avatarUrl`, `rating`, `totalReviews`, ...). Тип `UserProfile` в `src/types/api.ts` — проверить соответствие (см. §7 задача «Аудит типов»).

Примечание: при `MAIL_ENABLED=false` (дефолт) бэк не шлёт письмо; токен верификации и reset-токен лежат в Redis. Фронт не зависит от факта отправки письма.

---

## 3. Архитектура (дельта к Phase 1)

### 3.1. Серверные роуты (`src/app/api/auth/*`)
Три новых тонких прокси-хендлера, **не** выставляющих cookie (только login/register/refresh выставляют/ротируют/чистят cookie из Phase 1). Паттерн ошибки — явный `new NextResponse(body, { status, headers: { "content-type": "application/problem+json" } })` (как в существующем `login/route.ts`), **не** `parseProblem` (бросает → 500).

- `POST /api/auth/verify-email` — body-less; читает `token` из `new URL(req.url).searchParams`, форвардит `POST ${API_BASE}/auth/verify-email?token=...`. 200 → `{ ok: true }`; 400 → problem+json как есть.
- `POST /api/auth/forgot-password` — форвардит тело `{email}`. Всегда 200 → `{ ok: true }` (бэк скрывает существование).
- `POST /api/auth/reset-password` — форвардит тело `{token, newPassword}`. 200 → `{ ok: true }`; 400 → problem+json.

### 3.2. Страницы (`src/app/[locale]/(auth)/`)
Route group `(auth)` — без отдельного layout; общий wrapper `AuthCard` (центрированная карточка) — доменный компонент `src/app/[locale]/(auth)/auth-card.tsx` (server-компонент-обёртка, чисто вёрстка).

- **`/login`** (клиент) — `react-hook-form` + zod `loginSchema`. Submit → `loginViaApi(email,password)` (существующий, POST `/api/auth/login`, выставляет cookie) → затем `getCurrentUser()` через `/api/proxy/users/me` для решения о редиректе → `redirectAfterLogin(user, callbackUrl)`. Ошибки: 401 (неверные данные/не верифицирован) → общая toast/inline; `violations` → на поля. Ссылки на `/forgot-password`, `/register`. Query-флаги `?verified=1` / `?reset=1` показывают success-баннер.
- **`/register`** (клиент) — zod `registerSchema`. Submit → `POST /api/auth/register` (через новый helper `registerViaApi`). 201 → `redirect("/${locale}/verify-email-info")`; 409 → field-error на email; 400/violations → на поля.
- **`/verify-email-info`** (клиент) — success-блок «✓ Аккаунт создан, проверьте почту» + **dev-помощник** (рендерится только при `process.env.NODE_ENV !== "production"`): поле «вставить токен из Redis» + кнопка → `POST /api/auth/verify-email?token=...` → успех `redirect("/${locale}/login?verified=1")` / 400 → inline-ошибка. Ссылка «назад к регистрации».
- **`/verify-email`** (клиент) — читает `?token=` из `useSearchParams()`; на mount `useEffect` → `POST /api/auth/verify-email?token=...`. Состояния: loading (spinner) → success (ссылка на login) / error (невалидный/просроченный, ссылка на `/register`, т.к. resend-эндпоинта нет).
- **`/forgot-password`** (клиент) — zod `forgotSchema` (email). Submit → `POST /api/auth/forgot-password` → всегда success-состояние «если аккаунт существует, письмо отправлено».
- **`/reset-password`** (клиент) — читает `?token=`; zod `resetSchema` (`newPassword` ≥8 + confirm). Submit → `POST /api/auth/reset-password` → успех `redirect("/${locale}/login?reset=1")` / 400 → inline (невалидный/просроченный токен).

### 3.3. Сессия (клиент)
- **`SessionProvider`** (`src/components/auth/SessionProvider.tsx`, `"use client"`) — оборачивает детей в `Providers` (или вставляется внутрь него). `useQuery({ queryKey: ["session"], queryFn: () => getCurrentUser(), retry: false, staleTime: 5min })`. Контекст: `{ user: UserProfile | null, status, isLoading }`.
- **`useSession`** (`src/components/auth/useSession.ts`) — хук-обёртка над контекстом.
- **`UserMenu`** (rewrite `src/components/layout/UserMenu.tsx`) — при `user` → аватар/инициалы + email-дропдаун (ссылки на dashboard по роли, профиль, logout); без `user` → текущее поведение (ссылки login/register). Logout → `logoutViaApi()` → `queryClient.removeQueries({ queryKey: ["session"] })` → `router.replace("/")`.
- **Клиентская 401-обработка** — глобально: при `ApiError.status === 401` из query/mutation (прокси уже попытался refresh и вернул 401) → `queryClient.setQueryData(["session"], null)` + `router.replace("/${locale}/login?callbackUrl=" + encodeURIComponent(pathname))`. Реализуется через ref-флаг в `SessionProvider` (один редирект, без цикла). Не применяется к самому запросу `/users/me` сессии (иначе цикл).

### 3.4. Middleware (`src/middleware.ts`)
Расширение Phase 1 (guard presence-cookie для `/dashboard` + `/admin`):
- Для `/(admin)/**` после проверки presence-cookie: `fetch(${API_BASE}/users/me, { headers: { authorization: "Bearer <pmp_access из cookie>" } })`. 200 + `role ∈ {ADMIN, MODERATOR}` → пропустить; иначе (401/403/non-admin) → редирект `/${locale}/login?callbackUrl=...`.
- Замечание: middleware работает в edge/Node и не может использовать cookie-ротирующий прокси `/api/proxy/...` (это Next route handler, не доступен из middleware напрямую). Поэтому stale-access-but-valid-refresh здесь не обновится (редко); первая реальная загрузка admin-страницы через RSC обновит токен через прокси. Бэкенд-403 остаётся источником истины.

### 3.5. Редиректы (`src/lib/auth/redirects.ts`)
- `redirectAfterLogin(user, callbackUrl, locale)`:
  - если `callbackUrl` присутствует и это same-origin путь (начинается с `/`, не external) → вернуть его.
  - иначе: `user.role ∈ {ADMIN, MODERATOR}` → `/${locale}/admin`; иначе `/${locale}/dashboard`.
- `safeCallbackUrl(raw, locale)`: санитизация (отброс external/`//`/`javascript:`/`data:`, дефолт — роль-based).

### 3.6. Placeholder-страницы
- `src/app/[locale]/(dashboard)/dashboard/page.tsx` (клиент) — «Добро пожаловать, {email}» + список ссылок по роли (Профиль, Мои объявления [SELLER], Бронировки, Сообщения, Избранное, Подписки). Ссылки ведут на placeholder-роуты или показывают «coming in Phase N» (не реализуем реальные роуты).
- `src/app/[locale]/(admin)/admin/page.tsx` (клиент) — «Admin» + ссылки Users / Pending listings / Pending reviews / Statistics (Phase 8).
- Оба под guard middleware (Phase 1 уже защищает `/dashboard`, `/admin` по presence-cookie; Phase 2 добавляет role-check для `/admin`).

### 3.7. Валидация (`src/lib/validation/auth-schemas.ts`)
zod-схемы, сообщения из i18n (плагин `zod`/ручной `mapError`):
- `loginSchema`: `email` (z.string().email(), ≤255), `password` (≥8).
- `registerSchema`: `email` (email, ≤255), `password` (≥8), `phone` (опц., ≤20), `firstName` (опц., ≤100), `lastName` (опц., ≤100).
- `forgotSchema`: `email`.
- `resetSchema`: `newPassword` (≥8), `confirm` (равен newPassword).
Сообщения — ключи из `messages/{ru,en}.json` namespace `Validation.*`.

### 3.8. Endpoints (`src/lib/api/endpoints/auth.ts`)
Расширить существующий файл: `registerViaApi(body)`, `verifyEmailViaApi(token)`, `forgotPasswordViaApi(email)`, `resetPasswordViaApi(token, newPassword)`. Все вызывают наши `/api/auth/*` (не прокси). `loginViaApi`/`logoutViaApi` уже есть.

---

## 4. Формы и валидация (детально)

Зеркало Bean Validation бэка (§2):
| Форма | Поля | Правила |
|---|---|---|
| login | email, password | email valid ≤255; password ≥8 |
| register | email, password, phone?, firstName?, lastName? | email valid ≤255; password ≥8; phone ≤20; firstName/lastName ≤100 |
| forgot-password | email | email valid ≤255 |
| reset-password | newPassword, confirm | newPassword ≥8; confirm === newPassword; token из URL (не в форме) |
| verify-email-info | token | непустая строка (token из Redis) |

Серверная ошибка `violations[]` (RFC 9457) → `form.setError(field, { message })`. Поле `password` в register/login — общая ошибка (бэк не возвращает field-level для невалидных кредов, только 401).

---

## 5. i18n

Namespace `Auth.*` в `messages/{ru,en}.json`:
- `Auth.login.{title, email, password, submit, registerLink, forgotLink, verifiedBanner, resetBanner, invalidCredentials}`
- `Auth.register.{title, email, password, phone, firstName, lastName, submit, loginLink, success}`
- `Auth.verifyEmailInfo.{title, success, devHelperLabel, devHelperButton, devHelperError, invalidToken}`
- `Auth.verifyEmail.{loading, success, error, backToRegister}`
- `Auth.forgotPassword.{title, email, submit, success}`
- `Auth.resetPassword.{title, newPassword, confirm, submit, success, error, mismatch}`
- `Auth.userMenu.{dashboard, profile, admin, logout}`
- `Validation.{emailInvalid, passwordMin, required, tooLong, mismatch}` — общие сообщения валидации.
- `Dashboard.welcome`, `Admin.title` — для placeholder.

---

## 6. Безопасность

- Токены только в httpOnly cookie (Phase 1). Новые auth-роуты verify/forgot/reset не манипулируют cookie.
- `safeCallbackUrl` отбрасывает external/`javascript:`/`data:`/`//` — защита от open-redirect через `callbackUrl`.
- Прокси уже стрипает `Set-Cookie` и не форвардит client `Authorization` (Phase 1 fix-wave).
- `forgot-password` не раскрывает существование аккаунта (UI-сообщение одинаковое; бэк тоже 200 всегда).
- Роли проверяются и на клиенте (UI-меню, скрытие admin-ссылок), и на сервере (middleware + бэкенд 403).
- `verify-email`/`reset-password` принимают токен только из URL query (не из тела/не из localStorage).

---

## 7. Тестирование

### 7.1. Vitest + MSW (unit/компоненты)
- `auth-schemas.test.ts` — валидные/невалидные кейсы для каждой схемы (границы: password 7/8, email-формат, длины).
- `redirects.test.ts` — `redirectAfterLogin`: callbackUrl external → роль-based; admin → /admin; buyer → /dashboard; `safeCallbackUrl` отбрасывает `//evil.com`, `javascript:`.
- `login-page.test.ts` (RTL+MSW) — submit успех → редирект по роли; 401 → ошибка; violations на поля; query-флаги баннеры.
- `register-page.test.ts` — 201 → редирект `/verify-email-info`; 409 → field-error email; validation.
- `verify-email-info.test.ts` — dev-помощник: успех → `/login?verified=1`; 400 → inline-ошибка.
- `verify-email-page.test.ts` — mount с token → success; без token → error; невалидный → error.
- `forgot-password.test.ts` — всегда success-состояние.
- `reset-password.test.ts` — успех → `/login?reset=1`; 400 → error; confirm-mismatch.
- `session-provider.test.ts` — loading/user/null-переходы; retry:false.
- `user-menu.test.ts` — auth-aware рендер (logged-in: email/dropdown/logout; logged-out: login/register links); logout → invalidate + redirect.
- `client-401.test.ts` — mutation возвращает ApiError 401 → session null + redirect.
- `middleware.test.ts` (или unit helper) — admin: ADMIN/MODERATOR pass; BUYER → redirect; 401 → redirect.
- route-handler тесты для verify-email/forgot-password/reset-password (MSW на `${API_BASE}/auth/*`).

### 7.2. Playwright e2e (hermetic через MSW route interception на уровне `/api/auth/*` + `/api/proxy/users/me`, либо против stand)
1. register → `/verify-email-info` → dev-вставка токена → `/login?verified=1` → login (BUYER) → `/dashboard`.
2. login ADMIN → `/admin`.
3. не-админ заходит `/admin` → редирект `/login`.
4. logout → `/`, UserMenu снова показывает login/register.
5. `forgot-password` → success-состояние; `reset-password` (валидный токен) → `/login?reset=1`.

---

## 8. Файлы (предпросмотр)

```
src/app/api/auth/verify-email/route.ts               (new)
src/app/api/auth/forgot-password/route.ts            (new)
src/app/api/auth/reset-password/route.ts             (new)
src/app/[locale]/(auth)/auth-card.tsx                (new, shared wrapper)
src/app/[locale]/(auth)/login/page.tsx               (new, client)
src/app/[locale]/(auth)/register/page.tsx            (new, client)
src/app/[locale]/(auth)/verify-email-info/page.tsx  (new, client)
src/app/[locale]/(auth)/verify-email/page.tsx        (new, client)
src/app/[locale]/(auth)/forgot-password/page.tsx     (new, client)
src/app/[locale]/(auth)/reset-password/page.tsx      (new, client)
src/app/[locale]/(dashboard)/dashboard/page.tsx     (new, thin placeholder)
src/app/[locale]/(admin)/admin/page.tsx             (new, thin placeholder)
src/components/auth/SessionProvider.tsx              (new)
src/components/auth/useSession.ts                    (new)
src/components/layout/UserMenu.tsx                   (rewrite)
src/lib/auth/redirects.ts                            (new)
src/lib/validation/auth-schemas.ts                   (new)
src/lib/api/endpoints/auth.ts                        (extend)
src/middleware.ts                                    (extend: admin role check)
src/messages/ru.json + en.json                       (Auth.*, Validation.*, Dashboard.*, Admin.*)
src/types/api.ts                                     (аудит UserProfile под UserProfileResponse, при необходимости)
src/tests/...                                        (new)
e2e/auth.spec.ts                                     (new)
```

---

## 9. Зависимости от Phase 1 (использует как есть)

- `src/lib/auth/cookies.ts` — `getAuthCookies`, `setAuthCookies`, `clearAuthCookies`.
- `src/lib/api/proxy-handler.ts` — 401-refresh, header-санитизация (fix-wave).
- `src/lib/api/client.ts` — `apiGet` (для `/users/me`).
- `src/lib/api/endpoints/users.ts` — `getCurrentUser`.
- `src/lib/api/endpoints/auth.ts` — `loginViaApi`, `logoutViaApi` (расширяем).
- `src/components/layout/Providers.tsx` — QueryClientProvider (вкладываем SessionProvider).
- `src/middleware.ts` — presence-guard (расширяем role-check).
- `src/i18n.ts` — `Link`, `useRouter`, `usePathname`.

---

## 10. Риски и митигации

| Риск | Митигация |
|---|---|
| Middleware не может ротировать cookie (нет прокси) → stale-access на admin-роут | Принять; бэк 403 — истина; первая RSC-загрузка обновит токен. Документировать. |
| Open-redirect через `callbackUrl` | `safeCallbackUrl` отбрасывает external/`javascript:`/`data:`/`//`. |
| Клиентский 401-цикл (сессия /users/me сама 401 → редирект на login → снова /users/me) | ref-флаг one-shot в SessionProvider; /users/me сессии не триггерит logout-редирект, просто `user: null`. |
| dev-помощник verify-email утёчет в прод | Гейт `process.env.NODE_ENV !== "production"`. |
| Расхождение `UserProfile` типа с реальным DTO | Задача-аудит в начале Phase 2; правим `src/types/api.ts` при необходимости. |
| Роль `MODERATOR` была «отсутствует» в мастер-спеке, но есть в бэке | Включаем в admin-guard `{ADMIN, MODERATOR}`; мастер-спека §12 устарела. |
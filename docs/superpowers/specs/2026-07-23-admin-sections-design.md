# Admin-панель: разделы users / pending listings / pending reviews / statistics — дизайн

**Дата:** 2026-07-23
**Цель:** реализовать четыре раздела админ-панели, которые сейчас являются заглушками-ссылками на `admin/page.tsx` и отдают 404 (`/ru/admin/users`, `/ru/admin/listings/pending`, `/ru/admin/reviews/pending`, `/ru/admin/statistics`).

## Контекст и проблема

`src/app/[locale]/(admin)/admin/page.tsx` — единственный файл группы `(admin)`; содержит навигацию со ссылками на `/admin/users`, `/admin/listings/pending`, `/admin/reviews/pending`, `/admin/statistics` и заглушку `{t("comingSoon")}`. Подстраниц не существует → 404 на любой ссылке. Middleware admin-guard (проверка `role ∈ {ADMIN, MODERATOR}`) работает корректно (иначе был бы редирект на `/login`, а не 404) — проблема именно в отсутствии роутов.

Бэкенд реализован в `/Users/vvnovg/pet-marketplace` (`AdminController` + DTO). Контракт зафиксирован ниже.

## Бэкенд-контракт (источник: `pet-marketplace` Spring-код)

Все эндпоинты под `/api/v1`, защищены `@PreAuthorize("hasAnyRole('ADMIN', 'MODERATOR')")`. Фронт обращается через `/api/proxy/admin/*` (прокси подставляет `Authorization` из `pmp_access`-cookie и пробрасывает `Accept-Language`).

| Метод | Путь | Query | Тело | Ответ |
|---|---|---|---|---|
| GET | `/admin/users` | `role`, `active`, `verified`, `search`, `page`, `size` | — | `Page<AdminUserResponse>` |
| PUT | `/admin/users/{id}/status` | — | `UserStatusUpdateRequest` | `AdminUserResponse` |
| PUT | `/admin/users/{id}/role` | — | `UserRoleUpdateRequest` | `AdminUserResponse` |
| GET | `/admin/listings/pending` | `page`, `size` (+ `Accept-Language`) | — | `Page<ListingResponse>` |
| PUT | `/admin/listings/{id}/moderate` | — (+ `Accept-Language`) | `ListingModerateRequest` | `ListingResponse` |
| GET | `/admin/reviews/pending` | `page`, `size` | — | `Page<ReviewResponse>` |
| PUT | `/admin/reviews/{id}/moderate` | — | `ReviewModerateRequest` | `ReviewResponse` |
| GET | `/admin/statistics` | — | — | `AdminStatisticsResponse` |

**DTO-формы (записи бэкенда):**

- `AdminUserResponse`: `id:UUID, email:String, phone:String?, firstName:String?, lastName:String?, avatarUrl:String?, role:Role, verified:boolean, active:boolean, bio:String?, country:String?, city:String?, address:String?, latitude:BigDecimal?, longitude:BigDecimal?, rating:BigDecimal?, totalReviews:Integer?, createdAt:Instant, updatedAt:Instant`.
- `UserStatusUpdateRequest`: `{ active:Boolean (NotNull), reason:String? }`.
- `UserRoleUpdateRequest`: `{ role:Role (NotNull) }`.
- `ListingModerateRequest`: `{ status:ListingStatus (NotNull), reason:String? }`. Бэкенд принимает **только `ACTIVE` или `REJECTED`** (иначе `ValidationException`); модерировать можно только листинги в `PENDING_MODERATION` или `REJECTED`.
- `ReviewModerateRequest`: `{ status:ReviewStatus (NotNull), reason:String? }`. Разрешённые исходы модерации — `APPROVED` или `REJECTED`.
- `AdminStatisticsResponse`: `totalUsers:long, activeUsers:long, listingsByStatus:Map<ListingStatus,Long>, bookingsByStatus:Map<BookingStatus,Long>, reviewsByStatus:Map<ReviewStatus,Long>, listingsCreatedToday:long, listingsCreatedThisWeek:long, listingsCreatedThisMonth:long`.
- `Role` enum: `BUYER, SELLER, ADMIN, MODERATOR` (MODERATOR присутствует в бэке).
- Формат `Page<T>` (Spring Data): `{ content, totalElements, totalPages, number, size, first, last, empty }`.

**Замечание:** мастер-спека `2026-07-20-pet-marketplace-frontend-design.md` §13 указывала `GET /admin/users → AdminUserResponse[]` и `GET /admin/reviews/pending → ReviewResponse[]` (массивы). Фактически бэкенд отдаёт `Page<T>` — дизайн ориентируется на бэкенд.

## Архитектура и роутинг

Новые роуты (все `"use client"`, под существующим middleware admin-guard — доп. защита не нужна):
```
src/app/[locale]/(admin)/admin/users/page.tsx
src/app/[locale]/(admin)/admin/listings/pending/page.tsx
src/app/[locale]/(admin)/admin/reviews/pending/page.tsx
src/app/[locale]/(admin)/admin/statistics/page.tsx
```
`admin/page.tsx` остаётся landing-навигацией; заглушка `{t("comingSoon")}` убирается. Группа `(admin)` без отдельного layout-файла (обёртку даёт `[locale]/layout.tsx`).

Все данные — через `/api/proxy/admin/*`. Новые route-хендлеры не нужны.

**Единственное изменение общего кода:** `src/lib/api/client.ts` — добавить опциональное поле `headers?: Record<string,string>` в `ClientOpts`, проксировать в `fetch`. Нужно для `Accept-Language` на `listings/pending` и `moderateListing`.

## Типы и API-эндпоинты

Дополнение `src/types/api.ts`:
```ts
export interface AdminUser {
  id: UUID; email: string; phone: string | null;
  firstName: string | null; lastName: string | null; avatarUrl: string | null;
  role: Role; verified: boolean; active: boolean;
  bio: string | null; country: string | null; city: string | null; address: string | null;
  latitude: Money | null; longitude: Money | null;
  rating: Money | null; totalReviews: number | null;
  createdAt: IsoInstant; updatedAt: IsoInstant;
}

export interface AdminStatistics {
  totalUsers: number; activeUsers: number;
  listingsByStatus: Partial<Record<ListingStatus, number>>;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  reviewsByStatus: Partial<Record<ReviewStatus, number>>;
  listingsCreatedToday: number;
  listingsCreatedThisWeek: number;
  listingsCreatedThisMonth: number;
}

export interface UserStatusUpdate { active: boolean; reason?: string; }
export interface UserRoleUpdate { role: Role; }
export interface ListingModerate { status: "ACTIVE" | "REJECTED"; reason?: string; }
export interface ReviewModerate { status: "APPROVED" | "REJECTED"; reason?: string; }
```
Типы запросов модерации сужают enum до разрешённых бэкендом значений — compile-time гарантия.

Новый `src/lib/api/endpoints/admin.ts` (по образцу `users.ts`):
```ts
getAdminUsers(params, opts)          → Page<AdminUser>   // GET admin/users, query skip-null
updateUserStatus(id, body)           → AdminUser         // PUT admin/users/{id}/status
updateUserRole(id, body)             → AdminUser         // PUT admin/users/{id}/role
getPendingListings(page, size, locale) → Page<Listing>  // GET admin/listings/pending + Accept-Language
moderateListing(id, body, locale)    → Listing           // PUT admin/listings/{id}/moderate + Accept-Language
getPendingReviews(page, size)        → Page<Review>      // GET admin/reviews/pending
moderateReview(id, body)             → Review            // PUT admin/reviews/{id}/moderate
getStatistics(opts)                  → AdminStatistics   // GET admin/statistics
```
Query собирается через `URLSearchParams` с пропуском `null`/`undefined`.

## Переиспользуемые UI-примитивы

Hand-authored shadcn v3 (Tailwind 3.4 + `tailwindcss-animate`), в стиле `button.tsx`/`card.tsx`.

`src/components/ui/`:
- `badge.tsx` — `cva`-вариантный `<span>` (default/secondary/destructive/outline/success/warning), без зависимости.
- `dialog.tsx` — на **`@radix-ui/react-dialog`** (новая зависимость, добавляется в `package.json`), hand-authored. Переиспользуется на 3 страницах модерации + смена роли.
- `select.tsx` — **нативный `<select>`** в shadcn-стиле (без новой radix-зависимости). Для фильтра роли и смены роли пользователя.

`src/components/admin/`:
- `DataTable<T>` — generic-таблица: колонки `{ header, cell(row) }`, `emptyState`, skel-загрузка. Без внешней lib.
- `Pagination` — prev/next + номер + размер страницы (10/20/50), из `Page<T>`.
- `StatusBadge` — маппинг enum→badge-вариант+label через i18n (`Admin.status.*`).
- `ConfirmModerationDialog` — диалог approve/reject с опциональным полем `reason` (textarea); для reject `reason` обязателен; клиентский предел `reason ≤ 1000`.
- `EmptyState` — заглушка «нет данных».

## Страница `/admin/users`

`useQuery(["admin","users",filters])` → `getAdminUsers`. Фильтры в URL searchParams (`search`, `role`, `active`, `page`, `size`); чтение через `window.location.search` (+ test-only Promise-fallback) по паттерну auth-страниц (Next 15 client не получает searchParams-проп). Ввод → debounce 300ms → обновление URL → рефетч. Кнопка «сбросить фильтры».

Колонки: пользователь (аватар-инициалы + имя + email), роль (`StatusBadge`), verified, active, totalReviews, createdAt (дата), действия.

Действия:
- Смена роли — `<select>` (BUYER/SELLER/MODERATOR/ADMIN) → `useMutation(updateUserRole)` → `qc.invalidateQueries(["admin","users"])` + тост. **Self-guard:** на своей строке (`user.id === session.user.id`) select disabled + tooltip «нельзя менять свою роль».
- Block/Unblock — кнопка-переключатель → `ConfirmModerationDialog` (для block `reason` обязателен; для unblock опционален) → `useMutation(updateUserStatus)`. Self-guard: на своей строке disabled. На ADMIN-строке — предупреждение «вы блокируете администратора».
- `active=false`-строка визуально приглушена.

Пагинация — `<Pagination>`. Ошибки: `EmptyState`/ретрий на загрузку; мутации — sonner-тост из `ApiError.detail`/`violations`.

## Страница `/admin/listings/pending`

`useQuery(["admin","listings","pending",{page,size,locale}])` → `getPendingListings(page, size, locale)`. `locale` из `useLocale()` → `Accept-Language: ru|en` для локализованных `categoryName`/`breedName`.

Список карточками (описание/фото — таблица тесна): главное изображение, заголовок, продавец (имя/email), категория→порода, цена, локация, `status`-бейдж, дата создания, превью `description`. Карточки под `PENDING_MODERATION` (или `REJECTED` — бэкенд допускает повторную модерацию).

Действия: «Одобрить» (confirm-диалог «Точно одобрить?» → `moderateListing({status:"ACTIVE"})`) и «Отклонить» (`ConfirmModerationDialog` с обязательным `reason` → `moderateListing({status:"REJECTED",reason})`). `useMutation` с `Accept-Language` → `qc.invalidateQueries(["admin","listings","pending"])` + тост. Ссылка на полный листинг — только если каталог `/listings/{id}` реализован к моменту имплементации (проверить; иначе убрать).

Пагинация — `<Pagination>`.

## Страница `/admin/reviews/pending`

`useQuery(["admin","reviews","pending",{page,size}])` → `getPendingReviews(page, size)`.

Карточки: автор (аватар-инициалы + имя), получатель (имя), booking (`#короткий-id`), `rating` (звёзды 1–5, hand-authored), `comment`, `status`-бейдж (`PENDING`), дата создания.

Действия: «Одобрить» (confirm-диалог → `moderateReview({status:"APPROVED"})`) и «Отклонить» (`ConfirmModerationDialog` с обязательным `reason` → `moderateReview({status:"REJECTED",reason})`). `useMutation` → `qc.invalidateQueries(["admin","reviews","pending"])` + тост.

Пагинация — `<Pagination>`.

## Страница `/admin/statistics`

`useQuery(["admin","statistics"])` → `getStatistics()`, `staleTime: 60s`, кнопка «обновить».

KPI-плитки (скаляры): totalUsers, activeUsers, listingsCreatedToday/ThisWeek/ThisMonth — адаптивная сетка. Подписи через i18n.

Графики **recharts** (новая зависимость): три горизонтальных `BarChart` (layout="vertical") — `listingsByStatus`, `bookingsByStatus`, `reviewsByStatus`; метки статусов по Y, количества по X; нули показываются. При реализации графиков — **dataviz-навык** для палитры/доступности/единообразия тёмной-светлой темы. Пустое состояние, если все 0.

Локализация меток: enum-ключи статусов → i18n (`Admin.status.*`).

## i18n

Все строки — в оба `messages/ru.json` + `en.json` и в key-list `messages.test.ts`. Новые неймспейсы:
- `Admin.users.*`, `Admin.pendingListings.*`, `Admin.pendingReviews.*`, `Admin.statistics.*`, `Admin.common.*`, `Admin.status.*` (enum→label для `ListingStatus`/`BookingStatus`/`ReviewStatus`/`Role`).

## Обработка ошибок

- 403 → тост «недостаточно прав» + скрытие действия (мутации).
- 404 на защищённой странице → `EmptyState`.
- `violations[]` мутаций → тост с деталями (валидация `reason`).
- Сетевые → тост с кнопкой «повторить».

## Тестирование

Vitest + RTL + MSW (MSW перехватывает `/api/proxy/admin/*`; `server.close()` в `afterEach`):
- `src/tests/admin-users-page.test.tsx` — рендер таблицы, фильтры (debounce), смена роли, block/unblock (dialog + reason), self-guard (своя строка — disabled), маппинг `violations` → тост.
- `src/tests/admin-listings-pending.test.tsx` — карточки, approve/reject (reason обязателен для reject), `Accept-Language` в MSW-хендлере, пагинация.
- `src/tests/admin-reviews-pending.test.tsx` — карточки, approve/reject, рейтинг-звёзды, пагинация.
- `src/tests/admin-statistics.test.tsx` — KPI-плитки рендерят значения, recharts-бары (smoke), empty-state при нулях.
- `src/tests/admin-endpoints.test.ts` — `endpoints/admin.ts` строит корректные URL+query (skip-null) и тела запросов.
- Расширение `src/tests/messages.test.ts` — все новые ключи.
- Playwright e2e `e2e/admin.spec.ts` — модерация pending-объявления (мастер-спека §11 путь 6); `page.route`-стабы на `/api/auth/*` + `/api/proxy/users/me` + `/api/proxy/admin/*` (set-cookie через response-заголовок).

## Новые зависимости

- `@radix-ui/react-dialog` (dialog-примитив).
- `recharts` (графики статистики).

## Pre-merge гейт

`pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test`.

## Неуточнённые при имплементации вопросы

- Наличие публичного роута `/listings/{id}` на момент имплементации (влияет на ссылку с карточки модерации) — проверить, иначе убрать ссылку.
# Спецификация фронтенда: PetMarketplace

- **Дата:** 2026-07-20
- **Бэкенд:** `pet-marketplace` (локальный клон `/Users/vvnovg/pet-marketplace`, ветка `main` / `feat/kafka-animal-info`), Spring Boot 4, Java 26, REST `/api/v1`.
- **Назначение:** веб-клиент маркетплейса животных (покупатель, продавец, модератор/админ) поверх существующего REST API.

---

## 1. Цели и границы

### 1.1. Цель
Полноценный веб-фронтенд на React, покрывающий **все** роли и модули бэкенда: auth, пользователей/профили, объявления (CRUD + фото), категории/породы, поиск/фильтры, бронирования, чат, отзывы, избранное, подписки и админ-панель (модерация, пользователи, статистика).

### 1.2. В рамках
- SPA/SSR-гибрид на Next.js App Router с локализацией RU/EN.
- Покрытие всех endpoint'ов из `SPECIFICATION.md` §7, реализованных в бэкенде (10 модулей, контроллеры существуют).
- Тесты: Vitest (unit/компоненты) + Playwright (e2e по ключевым потокам).

### 1.3. Вне рамок
- Мобильные нативные приложения.
- WebSocket/Realtime-сервер на бэке (чат — polling по REST; абстракция транспорта заложена для будущей замены).
- OAuth2-логин (на втором этапе бэка).
- Email-рассылки как UI-функция (фронт лишь отображает статусы подписок/уведомлений).

### 1.4. Критерии приёмки
- Незарегистрированный пользователь может искать/открывать карточки объявлений (SSR, индексируется).
- Пользователь проходит register → verify-email → login, видит дашборд.
- Продавец создаёт объявление с фото до 10 шт., отправляет на модерацию.
- Покупатель добавляет в избранное, бронирует, открывает чат, пишет сообщение, оставляет отзыв после завершённой сделки.
- Модератор/админ видит pending-объявления/отзывы, модерит, меняет роли/статусы пользователей, видит статистику.
- RU/EN-переключатель работает на всех экранах; категории/породы локализованы.
- 401 → silent refresh; истёкший refresh → разлогин с редиректом на `/login`.
- Все валидации форм совпадают с Bean Validation бэкенда.

---

## 2. Технологический стек

| Компонент | Технология |
|-----------|------------|
| Фреймворк | Next.js 15 (App Router), React 19 |
| Язык | TypeScript (strict) |
| Стилизация | Tailwind CSS |
| UI-компоненты | shadcn/ui (Radix primitives) |
| i18n | next-intl, локаль в URL `/[locale]` (ru/en) |
| Серверный стейт | TanStack Query v5 (клиентские мутации/кеш) |
| Формы | react-hook-form + zod |
| Иконки | lucide-react |
| Тосты/уведомления | sonner |
| Изображения | next/image (remotePatterns) + прокси-роут |
| Тесты | Vitest + React Testing Library + MSW; Playwright (e2e) |
| Линт/формат | ESLint (next/core-web-vitals), Prettier |
| Сборка | Next.js (turbopack опц.) |
| Тайпинги API | ручные `types/` + опционально `openapi-typescript` из `http://localhost:8080/api/v1/v3/api-docs` |

### 2.1. Среда
- `NEXT_PUBLIC_API_BASE` — базовый URL бэкенда (по умолчанию `http://localhost:8080/api/v1`).
- Node >= 20. Дев-сервер Next на `:3000`. Бэкенд поднимается отдельно (`docker-compose up -d && gradle bootRun`).

---

## 3. Архитектура приложения

### 3.1. Слои
- **Routing (App Router):** `app/[locale]/` с route groups по ролям/зонам:
  - `(public)` — `/` (каталог), `/listings/[id]` (карточка), `/users/[id]` (профиль продавца), `/users/[id]/listings`.
  - `(auth)` — `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`.
  - `(dashboard)` — `/dashboard/profile`, `/dashboard/listings` (мои), `/dashboard/listings/new`, `/dashboard/listings/[id]/edit`, `/dashboard/bookings`, `/dashboard/messages`, `/dashboard/messages/[userId]`, `/dashboard/favorites`, `/dashboard/subscriptions`, `/dashboard/reviews`.
  - `(admin)` — `/admin/users`, `/admin/listings/pending`, `/admin/reviews/pending`, `/admin/statistics`.
- **API-клиент** (`lib/api/`): единая точка доступа к бэкенду, всегда через серверный прокси (см. §6).
- **Server Components (RSC):** каталог, карточка, публичный профиль, страницы админа-списков — серверный fetch с forwarding cookie; SEO + быстрый first paint.
- **Client Components:** формы, мутации, чат, дашборд-вкладки, фильтры с состоянием.
- **Server state:** TanStack Query для мутаций и кеша в клиентских компонентах; ключи по ресурсу.
- **UI (shadcn/ui):** переиспользуемые примитивы в `components/ui/`; доменные компоненты в `components/{layout,listings,chat,bookings,...}`.

### 3.2. Структура каталогов
```
src/
  app/
    [locale]/
      (public)/ ...
      (auth)/ ...
      (dashboard)/ ...
      (admin)/ ...
      layout.tsx
      not-found.tsx
    api/
      proxy/[...path]/route.ts     # универсальный прокси к бэкенду
      auth/{login,register,refresh,logout}/route.ts  # выставляют/чистят cookie
      img/route.ts                  # прокси изображений (опц.)
    globals.css
    layout.tsx
  middleware.ts                     # guard защищённых зон (один файл, src root)
  lib/
    api/client.ts                    # fetch-обёртка поверх /api/proxy
    api/endpoints/{auth,listings,...}.ts
    auth/session.ts                  # чтение текущего пользователя
    i18n/ ...
    utils/ ...
  components/
    ui/         # shadcn primitives
    layout/     # Header, Footer, LocaleSwitch, UserMenu
    listings/ chat/ bookings/ reviews/ admin/ forms/ shared/
  types/
    api.ts      # TS-типы, отражающие DTO бэкенда
  messages/
    ru.json en.json
  middleware.ts
  next.config.ts
  tailwind.config.ts
  vitest.config.ts
  playwright.config.ts
```

### 3.3. Поток данных (пример: карточка объявления)
1. RSC `app/[locale]/(public)/listings/[id]/page.tsx` — серверный `fetch('/api/proxy/listings/<id>')` с forwarding access-cookie (если есть) — иначе публичный доступ.
2. Прокси подставляет `Authorization: Bearer`, при 401 делает refresh, возвращает JSON.
3. RSC рендерит галерею, атрибуты, продавца, кнопки.
4. Клиентские кнопки («В избранное», «Забронировать», «Написать») используют TanStack Query mutations через тот же `client.ts`.

---

## 4. Аутентификация и сессия

### 4.1. Модель
- Access token (15 мин) + refresh token (7 дней, ротация при каждом refresh) — оба в **httpOnly, Secure, SameSite=Lax** cookie, выставляются серверными Next-роутами (не видны JS).
- Регистрация создаёт `BUYER` с `is_verified=false`; login запрещён до verify-email (поведение бэка).

### 4.2. Роуты Next (серверные)
- `POST /api/auth/register` → проксирует `POST /auth/register` бэка (без cookie).
- `POST /api/auth/verify-email` → `POST /auth/verify-email?token=...` бэка.
- `POST /api/auth/login` → `POST /auth/login`, кладёт access/refresh в cookie.
- `POST /api/auth/refresh` → `POST /auth/refresh`, ротирует cookie.
- `POST /api/auth/logout` → `POST /auth/logout`, чистит cookie.
- `POST /api/auth/forgot-password`, `/reset-password` — проксируют бэк.

### 4.3. Универсальный прокси `/api/proxy/[...path]`
- Читает access-cookie, ставит `Authorization: Bearer <access>`, форвардит в `${NEXT_PUBLIC_API_BASE}/<path>`.
- На 401 → вызывает `/api/auth/refresh` (ротация cookie) и повторяет запрос 1 раз; при неудаче — возвращает 401 клиенту (тот разлогинивается).
- Не принимает путь, начинающийся с `auth/` (auth-роуты идут через отдельные хендлеры).
- Пробрасывает метод, query, тело, `Content-Type` (включая `multipart/form-data` для фото/аватара), стрипает `Set-Cookie` из ответа бэка.

### 4.4. Клиентский session
- `lib/auth/session.ts` — `getCurrentUser()` через серверный `/api/proxy/users/me` (RSC) или TanStack Query `/users/me` (клиент).
- `middleware.ts` — guard: для `/(dashboard)/**` требует access-cookie; для `/(admin)/**` дополнительно загружает профиль и проверяет `role in {ADMIN, MODERATOR}`. Без доступ — редирект на `/[locale]/login?callbackUrl=...`.

### 4.5. Ролевые ограничения UI
- Пункты меню дашборда по роли (SELLER видит «Мои объявления»/«Создать», BUYER — «Избранное»/«Бронирования», ADMIN/MODERATOR — «Админ»).
- Клиентские проверки дублируются серверными (бэкенд — источник истины).

---

## 5. Локализация

- `next-intl` с плагином Next; локаль — первый сегмент URL (`/ru`, `/en`), default `ru`.
- Сообщения UI в `messages/{ru,en}.json`; ключи неймспейсированы по экранам.
- Переключатель `LocaleSwitch` в Header; выбор сохраняется в cookie `NEXT_LOCALE`.
- **Локализуемые данные бэкенда:** `categories.name_ru`/`name_en` и `breeds.name_ru`/`name_en`. Фронт выбирает поле по активной локали. В DTO бэкенда `CategoryWithBreedsResponse.name` — единое поле (см. §12 замечание); на фронте используется helper `localizedCategory(cat, locale)`.
- Числа/валюты/даты — `Intl.NumberFormat`/`Intl.DateTimeFormat` с активной локалью.
- Валидационные сообщения форм — из messages, синхронизированы с Bean Validation бэка.

---

## 6. API-клиент и типы

### 6.1. `lib/api/client.ts`
Типизированная fetch-обёртка:
- Базовый URL `/api/proxy`.
- Методы: `get/post/put/delete/upload` (multipart).
- Парсинг ошибок: Spring `application/problem+json` (RFC 9457) → `ApiError { status, title, detail, violations?: [{field, message}] }`.
- Timeout, retry отсутствует (кроме встроенного 401-refresh в прокси).

### 6.2. Типы (`types/api.ts`)
Зеркало record-классов бэкенда (см. §13). UUID — `string`, `Instant` — `string` (ISO), `BigDecimal` — `number | string` (деньги — строка во избежание потери точности, формат в UI).

### 6.3. Endpoint-модули
`lib/api/endpoints/<module>.ts` — по одному на домен: `auth`, `users`, `listings`, `categories`, `bookings`, `messages`, `reviews`, `favorites`, `subscriptions`, `admin`. Каждый экспортирует функции, возвращающие промис с типизированным ответом.

---

## 7. Экраны и потоки

### 7.1. Каталог `/` (public, SSR)
- Фильтры (sidebar): категория, порода (зависит от категории), город, цена min/max, пол, возраст min/max, сортировка (`createdAt`/`price`/`rating`, asc/desc).
- Параметры из URL (`useSearchParams`) → `ListingSearchRequest` (page/size). Sharable URL.
- Список карточек `ListingMiniResponse` (фото, title, price, city, status-badge). Пагинация Spring `Page` (`content`, `totalPages`, `totalElements`) — кнопками или infinite scroll.
- SSR-данные через серверный fetch; фильтры — клиентский компонент с `router.replace` при изменении.
- Категории/породы тянутся из `/categories` (дерево `CategoryWithBreedsResponse`).

### 7.2. Карточка объявления `/listings/[id]` (public, SSR)
- `ListingResponse`: галерея (главное фото + остальные), title, цена, атрибуты (пол, возраст, окрас, вес, здоровье, вакцинация, документы), локация, продавец `PublicProfileResponse` (рейтинг, отзывы), просмотры.
- Действия (клиентские, требуют auth): «В избранное»/«Убрать» (`POST/DELETE /listings/{id}/favorite`), «Забронировать» (модалка → `POST /listings/{id}/book` с message), «Написать продавцу» (создать/открыть диалог → `POST /messages` с `listingId`).
- Бейдж статуса (`ACTIVE`/`RESERVED`/`SOLD`/...) с локализацией.
- Похожие/другие объявления продавца (опц.).

### 7.3. Создание/редактирование объявления (dashboard, клиент)
- Мастер-форма → `ListingCreateRequest`:
  - `categoryId` (select из `/categories`), `breedId` (select, зависит от категории), `title`, `description`, `price` + `currency` (3 символа), `gender` (MALE/FEMALE), `ageMonths` (≥0), `color`, `weightKg`, `healthInfo`, `hasVaccination`, `hasDocuments`, `locationCountry`, `locationCity`.
  - zod-схема зеркалит `@NotBlank/@Size/@Positive/@Min`.
- Загрузка фото: `POST /listings/{id}/images` multipart, до 10 шт., валидация типа (image/*) и размера ≤5 МБ на клиенте; предпросмотр, drag-reorder, удаление (`DELETE /listings/{id}/images/{imageId}`).
- Сохранение в `DRAFT` или отправка на модерацию (`ListingStatusUpdateRequest` → `PENDING_MODERATION`).
- Редактирование существующих (`PUT /listings/{id}`).

### 7.4. Бронирования `/dashboard/bookings` (dashboard, клиент)
- `GET /bookings` (текущий пользователь как buyer и seller).
- Табы «Как покупатель» / «Как продавец».
- Карточка брони `BookingResponse`: объявление, стороны, статус `BookingStatus`, message, даты.
- Действия: confirm/cancel/complete (`PUT /bookings/{id}/{confirm|cancel|complete}`). Кнопки по роли и статусу.

### 7.5. Чат `/dashboard/messages` + `/dashboard/messages/[userId]` (dashboard, клиент)
- Список диалогов `GET /messages` → `ConversationResponse[]` (partner, lastMessage, unreadCount).
- Тред `GET /messages/{userId}` → `MessageResponse[]`; отправка `POST /messages` (`receiverId`, `listingId?`, `content`); отметка прочитанным `PUT /messages/{id}/read`.
- **Polling** каждые 5–10 c (активный диалог чаще), обновление списка диалогов и unread. Абстракция `MessageTransport` (интерфейс `subscribe/listen`) — точка будущей замены на WS/SSE без переписывания UI.
- Вложение к сообщению (опц.): upload через прокси, `attachmentUrl`.
- Скролл вниз, индикатор «прочитано», локализация относительного времени.

### 7.6. Профиль `/dashboard/profile` (dashboard, клиент)
- `GET /users/me` → `UserProfileResponse` (email, phone, name, avatar, role, verified, bio, локация, координаты, rating, totalReviews).
- Редактирование `PUT /users/me` (`ProfileUpdateRequest`: bio, country, city, address, lat/long с валидацией диапазонов −90..90 / −180..180).
- Аватар `POST /users/me/avatar` multipart.
- История: мои объявления (`/users/{id}/listings`), отзывы обо мне (`/users/{id}/reviews`).

### 7.7. Избранное `/dashboard/favorites`
- `GET /favorites` → `FavoriteResponse[]` (вложен `ListingMiniResponse`). Удаление из избранного.

### 7.8. Отзывы
- Список о пользователе `GET /reviews/{userId}` (публично, на профиле).
- Создание после завершённой сделки `POST /reviews` (`ReviewCreateRequest`: bookingId, rating 1–5, comment). UI — звёзды + textarea.
- Покупатель может оставить отзыв о продавце по `bookingId` со статусом `COMPLETED`.

### 7.9. Подписки `/dashboard/subscriptions`
- `GET /subscriptions`, `POST /subscriptions` (`SubscriptionCreateRequest` — фильтры поиска в JSON), `DELETE /subscriptions/{id}`.
- UI: создать подписку из текущих фильтров каталога («Сохранить этот поиск»), список активных, переключатель `is_active`.

### 7.10. Админ-панель `/admin/*` (admin, SSR-списки + клиент-действия)
- Пользователи `GET /admin/users` — таблица (`AdminUserResponse`), действия: `PUT /admin/users/{id}/status` (block/unblock), `PUT /admin/users/{id}/role`.
- Модерация объявлений `GET /admin/listings/pending` → `PUT /admin/listings/{id}/moderate` (`ListingModerateRequest`: approve/reject/changes).
- Модерация отзывов `GET /admin/reviews/pending` → `PUT /admin/reviews/{id}/moderate` (`ReviewModerateRequest`).
- Статистика `GET /admin/statistics` → `AdminStatisticsResponse` (плитки/графики через §chart-нормы; при отсутствии данных — заглушки).

---

## 8. Формы и валидация

- react-hook-form + zod; одна zod-схема на форму, сообщения из i18n.
- Правила, зеркалящие бэк:
  - Register/Login: `email` (valid), `password` (min 8), `phone` (max 20), `firstName`/`lastName` (max 100).
  - ListingCreate: `title` (≤255), `description` (≤4000), `price` (>0), `currency` (3), `ageMonths` (≥0), `color` (≤100), `weightKg` (>0), `healthInfo` (≤2000), локация (≤100).
  - ProfileUpdate: `bio` ≤2000, country/city ≤100, address ≤255, lat −90..90, long −180..180.
  - ReviewCreate: `rating` 1..5, `comment` ≤2000.
  - Message: `content` ≤2000, `receiverId` обязателен.
  - Booking: `message` ≤2000.
- Серверная ошибка валидации (`violations[]`) маппится на поля формы (`setError`).

---

## 9. Обработка ошибок

- Единый `ApiError` из ProblemDetail: `status`, `title`, `detail`, `violations`.
- Глобальный обработчик в Query (`onError`) — sonner-тост для нетизмов; field-level ошибки идут в форму.
- 401 → silent refresh (в прокси) или разлогин + редирект `/login`.
- 403 → тост «недостаточно прав» + скрытие действия.
- 404 на публичных страницах — `not-found.tsx`; на защищённых — пустое состояние.
- Сетевые ошибки/timeout — ретрай не делаем (кроме refresh); тост с кнопкой «повторить».

---

## 10. Безопасность

- Токены только в httpOnly cookie (никогда в localStorage/JS).
- Прокси — единственная точка проброса `Authorization`; `auth/*` изолирован.
- CSP (next.config) — `default-src 'self'`, `img-src` включает бэкенд/MinIO/прокси.
- Загрузка файлов — проверка MIME и размера на клиенте (дубль серверной валидации).
- XSS: React экранирует по умолчанию; `dangerouslySetInnerHTML` не используется.
- CSRF: cookie `SameSite=Lax` + state-changing запросы только через same-origin `/api/proxy` (не cross-origin к бэку напрямую).
- Роли проверяются и на клиенте (UI), и на сервере (middleware + бэкенд).
- Логи/ошибки не содержат токенов и паролей.

---

## 11. Тестирование

- **Vitest + RTL:** юниты (`lib/api`, `utils`, zod-схемы, i18n-helpers) и компоненты (формы, карточки, фильтры). Покрытие ключевых потоков мутаций.
- **MSW:** перехват запросов к `/api/proxy/*` с фикстурами из реальных DTO.
- **Playwright (e2e):** критические пути:
  1. register → verify-email (mock-токен) → login → дашборд.
  2. Поиск → карточка → в избранное → бронирование.
  3. Создание объявления с фото → отправка на модерацию.
  4. Чат: отправка сообщения + polling обновления.
  5. Завершение сделки → отзыв.
  6. Админ: модерация pending-объявления.
- Цель покрытия unit/компонент — ≥70% (как у бэка).

---

## 12. Известные расхождения со спецификацией бэкенда

- `SPECIFICATION.md` описывает `categories.name_ru`/`name_en`, но реализованный DTO `CategoryWithBreedsResponse` содержит единое `name` + `slug`. Фронт работает с тем, что отдаёт бэк (единое `name`); при будущей двуязычной доработке DTO — переключение на `name_<locale>` уже заложено в helper.
- `Role` enum на бэке: `BUYER, SELLER, ADMIN` (в коде; `MODERATOR` упоминается в спеке, но в enum отсутствует). UI готовит админ-доступ для `ADMIN`; `MODERATOR` добавляется в guard по мере появления.
- Чат realtime — polling (см. §7.5), WebSocket на бэке отсутствует.

---

## 13. Маппинг API ↔ типы фронтенда

| Метод (бэк, под `/api/v1`) | Тело/Ответ | Фронт-тип |
|---|---|---|
| `POST /auth/register` | `RegisterRequest{email,password,phone?,firstName?,lastName?}` | `RegisterInput` |
| `POST /auth/login` | `LoginRequest` → `TokenResponse{accessToken,refreshToken,tokenType,expiresIn}` | `LoginInput`, `TokenResponse` |
| `POST /auth/refresh` | `RefreshRequest{refreshToken}` → `TokenResponse` | — (прокси) |
| `POST /auth/verify-email` | query `token` | — |
| `POST /auth/forgot-password` / `reset-password` | `ForgotPasswordRequest{email}`, `PasswordResetRequest{token,newPassword}` | — |
| `GET /users/me` | → `UserProfileResponse` | `UserProfile` |
| `PUT /users/me` | `ProfileUpdateRequest` → `UserProfileResponse` | `ProfileUpdate` |
| `POST /users/me/avatar` | multipart → `UserProfileResponse` | — |
| `GET /users/{id}` | → `PublicProfileResponse` | `PublicProfile` |
| `GET /users/{id}/listings` | `Page<ListingResponse>` | `Page<Listing>` |
| `GET /users/{id}/reviews` | `Page<ReviewResponse>` | `Page<Review>` |
| `GET /listings` | `ListingSearchRequest` (query) → `Page<ListingResponse>` | `ListingSearch`, `Page<Listing>` |
| `GET /listings/{id}` | → `ListingResponse` | `Listing` |
| `POST /listings` | `ListingCreateRequest` → `ListingResponse` | `ListingCreate` |
| `PUT /listings/{id}` | `ListingCreateRequest` | `ListingCreate` |
| `DELETE /listings/{id}` | — | — |
| `POST /listings/{id}/images` | multipart → `ListingImageResponse` | — |
| `DELETE /listings/{id}/images/{imageId}` | — | — |
| `POST /listings/{id}/favorite` / `DELETE` | — | — |
| `POST /listings/{id}/book` | `BookingCreateRequest{listingId,message?}` | `BookingCreate` |
| `GET /categories` | → `CategoryWithBreedsResponse[]` | `CategoryWithBreeds` |
| `GET /categories/{id}/breeds` | → `BreedResponse[]` | `Breed[]` |
| `GET /bookings` | → `BookingResponse[]` | `Booking[]` |
| `PUT /bookings/{id}/{confirm,cancel,complete}` | `BookingStatusUpdateRequest` | — |
| `GET /messages` | → `ConversationResponse[]` | `Conversation[]` |
| `GET /messages/{userId}` | → `MessageResponse[]` | `Message[]` |
| `POST /messages` | `MessageSendRequest{receiverId,listingId?,content?}` | `MessageSend` |
| `PUT /messages/{id}/read` | — | — |
| `POST /reviews` | `ReviewCreateRequest{bookingId,rating,comment?}` | `ReviewCreate` |
| `GET /reviews/{userId}` | → `ReviewResponse[]` | `Review[]` |
| `GET /favorites` | → `FavoriteResponse[]` | `Favorite[]` |
| `GET /subscriptions` / `POST` / `DELETE/{id}` | `SubscriptionCreateRequest`/`SubscriptionResponse` | `SubscriptionCreate`, `Subscription` |
| `GET /admin/users` | → `AdminUserResponse[]` | `AdminUser[]` |
| `PUT /admin/users/{id}/status` | `UserStatusUpdateRequest` | — |
| `PUT /admin/users/{id}/role` | `UserRoleUpdateRequest` | — |
| `GET /admin/listings/pending` | → `Page<ListingResponse>` | `Page<Listing>` |
| `PUT /admin/listings/{id}/moderate` | `ListingModerateRequest` | — |
| `GET /admin/reviews/pending` | → `ReviewResponse[]` | `Review[]` |
| `PUT /admin/reviews/{id}/moderate` | `ReviewModerateRequest` | — |
| `GET /admin/statistics` | → `AdminStatisticsResponse` | `AdminStatistics` |

### 13.1. Справочник enum (значения бэкенда)
- `Role`: `BUYER`, `SELLER`, `ADMIN` (`MODERATOR` — плановый).
- `ListingStatus`: `DRAFT`, `PENDING_MODERATION`, `ACTIVE`, `RESERVED`, `SOLD`, `ARCHIVED`, `REJECTED`.
- `ListingGender`: `MALE`, `FEMALE`.
- `BookingStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.
- `ReviewStatus`: `PENDING`, `APPROVED`, `REJECTED`.

### 13.2. Формат ответа `Page<T>` (Spring Data)
`{ content: T[], pageable, totalElements, totalPages, number, size, first, last, empty }`. Фронт использует `content`, `totalPages`, `number`, `totalElements`.

---

## 14. План реализации (этапы)

1. **Каркас:** инициализация Next.js + Tailwind + shadcn/ui + next-intl; layout/Header/Footer/LocaleSwitch; прокси-роут + `client.ts` + типы; middleware-guard; `not-found`.
2. **Auth:** login/register/verify-email/forgot/reset (серверные роуты cookie + формы + zod); `/users/me`-сессия; редиректы; 401-refresh.
3. **Каталог + карточка:** категории/породы, фильтры (URL-state), SSR-список, SSR-карточка, бейджи статусов.
4. **Профиль + мои объявления:** `UserProfileResponse`, `ProfileUpdate`, аватар; CRUD объявлений + загрузка фото; статус-переходы.
5. **Избранное + бронирования:** favorites, booking-потоки (confirm/cancel/complete).
6. **Чат:** диалоги + тред + polling + `MessageTransport`-абстракция + вложения.
7. **Отзывы + подписки:** создание отзывов после сделки, публичные отзывы; подписки из фильтров.
8. **Админ-панель:** users/listings/reviews pending, moderate, статистика.
9. **Тесты и полировка:** Vitest + MSW + Playwright; тосты/ошибки/empty-состояния; a11y; perf (next/image, RSC).

---

## 15. Риски

| Риск | Митигация |
|---|---|
| Polling нагружает бэкенд | Адаптивный интервал, пауза на неактивной вкладке (`visibilitychange`). |
| CSRF/утечка токенов | httpOnly + SameSite + same-origin прокси. |
| Расхождение DTO со старой спекой | Работа по фактическим DTO (§12), helper локализации готов к двуязычию. |
| Денежные значения | BigDecimal → строка в типах, форматирование в UI через Intl. |
| Загрузка больших фото | Клиентская проверка ≤5 МБ, ленивый рендер, next/image. |
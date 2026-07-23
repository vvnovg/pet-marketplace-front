# Каталог (public listings + detail + favorites + booking) — дизайн

**Дата:** 2026-07-24
**Цель:** реализовать публичный каталог животных: страницу-сетку с полными фильтрами, страницу деталей листинга с auth-gated действиями (favorites/booking), страницу «Избранное», и превратить `/` в лендинг. Header-ссылка «Каталог» → `/catalog`.

## Контекст

Сейчас `src/app/[locale]/page.tsx` — заглушка (`t("Home.welcome")`); Header уже содержит ссылку «Каталог» → `/`, ведущую на эту заглушку. Публичных роутов листингов/деталей/избранного нет. Бэкенд (`/Users/vvnovg/pet-marketplace`) отдаёт публичные эндпоинты `GET /listings` (search), `GET /listings/{id}`, `GET /categories`, `GET /categories/{id}/breeds` и auth-эндпоинты `GET/POST/DELETE /favorites[/{listingId}]`, `POST /listings/{id}/book`. Контракт зафиксирован ниже.

## Бэкенд-контракт (источник: `pet-marketplace` Spring-код)

Все под `/api/v1`. Клиент идёт через `/api/proxy/*` (публичные доходят и без cookie — прокси форвардит без `Authorization`, если `pmp_access` отсутствует; auth-эндпоинты требуют `pmp_access`). `Accept-Language` проксируется (proxy форвардит заголовки минус `cookie`/`authorization`; `client.ts` `headers`-опция ставит `accept-language`).

| Метод | Путь | Query/Body | Auth | Ответ |
|---|---|---|---|---|
| GET | `/listings` | `ListingSearchRequest` (query) + `Accept-Language` | — | `Page<ListingResponse>` |
| GET | `/listings/{id}` | `Accept-Language` | — | `ListingResponse` (404 if not found/not ACTIVE) |
| GET | `/categories` | `Accept-Language` | — | `List<CategoryResponse>` |
| GET | `/categories/{id}/breeds` | `Accept-Language` | — | `CategoryWithBreedsResponse` |
| GET | `/favorites` | — | yes | `List<FavoriteResponse>` |
| POST | `/favorites/{listingId}` | — | yes | 201 |
| DELETE | `/favorites/{listingId}` | — | yes | 204 |
| POST | `/listings/{id}/book` | `?message=` (optional) | yes | 201 `BookingResponse` (400 if not active/already exists) |

**DTO-формы (записи бэкенда):**
- `ListingSearchRequest`: `categoryId:UUID?, breedId:UUID?, city:String?, minPrice:BigDecimal?, maxPrice:BigDecimal?, gender:ListingGender?, minAge:Integer?, maxAge:Integer?, sortBy:String="createdAt", sortDirection:String="DESC", page:Integer=0, size:Integer=20`.
- **Сортировка (бэкенд-вайтлист):** `sortBy` принимается только из `{createdAt, price, viewsCount, sellerRating}`; любое иное значение бэкенд молча заменяет на `createdAt`. Итоговый `Sort` всегда дополняется `createdAt DESC` как вторичным ключом. Каталог выставляет ровно эти 5 опций.
- `ListingResponse`: `id, seller:PublicProfileResponse, categoryId, categoryName, breedId, breedName, title, description, price:BigDecimal, currency, gender:ListingGender, ageMonths:Integer, color, weightKg:BigDecimal, healthInfo, hasVaccination:Boolean, hasDocuments:Boolean, locationCountry, locationCity, status:ListingStatus, viewsCount:Integer, images:List<ListingImageResponse>, createdAt, updatedAt`.
- `ListingImageResponse`: `id, url, orderIndex, isMain:Boolean`.
- `PublicProfileResponse`: `id, firstName, lastName, avatarUrl, bio, country, city, rating:BigDecimal, totalReviews:Integer, role`.
- `CategoryResponse`: `id, name, slug, children:List<CategoryResponse>, breeds:List<BreedResponse>` (рекурсивное дерево).
- `CategoryWithBreedsResponse`: `id, name, slug, breeds:List<BreedResponse>`.
- `BreedResponse`: `id, name`.
- `FavoriteResponse`: `id, listing:ListingMiniResponse, createdAt`.
- `ListingMiniResponse`: `id, title, price, currency, locationCity, mainImageUrl, status` (≈ фронтовый `ListingMini`).
- `BookingResponse`: `id, listing:BookingListingResponse, buyer:PublicProfileResponse, seller:PublicProfileResponse, status:BookingStatus, message, createdAt, updatedAt`.
- `BookingListingResponse`: `id, title, price, currency, mainImageUrl, status`.
- `BookingStatus`: `PENDING, CONFIRMED, CANCELLED, COMPLETED`.
- `ListingStatus`: `DRAFT, PENDING_MODERATION, ACTIVE, RESERVED, SOLD, ARCHIVED, REJECTED`.
- `ListingGender`: `MALE, FEMALE`.
- `Page<T>` (Spring Data): `{ content, totalElements, totalPages, number, size, first, last, empty }`.

## Архитектура и роутинг

`src/app/[locale]/layout.tsx` — единственный layout, рендерит `<Header/>` + `<main>` + `<Footer/>` + `<Toaster/>` глобально для всех страниц; route-группы `(auth)`/`(admin)`/`(dashboard)` без своих layout-файлов (чисто организационные). Каталог наследует Header/Footer. Новая группа не нужна.

Новые роуты (все `"use client"`):
```
src/app/[locale]/catalog/page.tsx          — сетка + фильтры (публичный)
src/app/[locale]/listings/[id]/page.tsx    — детали (публичный) — id через useParams()
src/app/[locale]/favorites/page.tsx       — избранное (auth, presence-guard)
src/app/[locale]/page.tsx                  — лендинг (перезапись заглушки)
```
`src/components/layout/Header.tsx` — ссылку «Каталог» с `/` на `/catalog`.
`src/middleware.ts` — добавить `/favorites` в `PROTECTED` (presence-guard, без role-проверки — как `/dashboard`).

Все данные — через `/api/proxy/*`. Новые route-хендлеры не нужны.

**Единственное изменение общего кода:** вынести `Pagination`/`EmptyState`/`StatusBadge` из `src/components/admin/` в `src/components/shared/` и поправить импорты в 4 админ-страницах + тестах (refactor). `client.ts` не меняется (`headers`-опция уже есть).

## Типы и API-эндпоинты

Дополнение `src/types/api.ts`:
```ts
export interface Category {
  id: UUID; name: string; slug: string;
  children: Category[]; breeds: Breed[];
}
export interface Favorite { id: UUID; listing: ListingMini; createdAt: IsoInstant; }
export interface BookingListing { id: UUID; title: string; price: Money; currency: string; mainImageUrl: string | null; status: ListingStatus; }
export interface Booking {
  id: UUID; listing: BookingListing; buyer: PublicProfile; seller: PublicProfile;
  status: BookingStatus; message: string | null; createdAt: IsoInstant; updatedAt: IsoInstant;
}
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export interface ListingSearchParams {
  categoryId?: string | null; breedId?: string | null; city?: string | null;
  minPrice?: number | null; maxPrice?: number | null;
  gender?: ListingGender | null; minAge?: number | null; maxAge?: number | null;
  sortBy?: string; sortDirection?: "ASC" | "DESC"; page?: number; size?: number;
}
```
`CategoryWithBreeds` уже есть. `ListingMini` проверить соответствие `ListingMiniResponse` (`mainImageUrl`).

Новый `src/lib/api/endpoints/catalog.ts` (по образцу `users.ts`; `withQuery` skip-null/пусто из `admin.ts`):
- `getCategories(locale)` → `Category[]`
- `getBreeds(categoryId, locale)` → `CategoryWithBreeds`
- `searchListings(params: ListingSearchParams, locale)` → `Page<Listing>`
- `getListing(id, locale)` → `Listing`
- `listFavorites()` → `Favorite[]`
- `addFavorite(listingId)` / `removeFavorite(listingId)`
- `bookListing(listingId, message?)` → `Booking`

## Переиспользуемые компоненты

**Новые `src/components/catalog/`:**
- `ListingCard.tsx` — карточка сетки: главное изображение (`images.find(i=>i.isMain) ?? images[0] ?? null`, fallback-плейсхолдер), заголовок, цена+валюта, локация, бейджи пола/возраста, `StatusBadge` статуса. Обёрнут в локаль-aware `Link` → `/listings/{id}`. Используется в каталоге и `/favorites`.
- `FiltersPanel.tsx` — панель фильтров (адаптив): категория (`<select>` из `getCategories`), порода (`<select>` — `getBreeds(categoryId)` при выборе категории; disabled пока категория не выбрана), город (`<input>`), цена min/max (`<input type=number>`), пол (`<select>` MALE/FEMALE/все), возраст min/max мес (`<input type=number>`), кнопка «Сбросить». Управляемая форма → debounce → `onFiltersChange`.
- `ImageGallery.tsx` — галерея деталей: главное изображение + миниатюры (клик переключает), состояние `activeIndex`. Hand-authored.
- `BookingDialog.tsx` — на `@radix-ui/react-dialog` (примитив установлен): textarea опционального `message` (≤1000), confirm → `bookListing`.
- `FavoriteButton.tsx` — toggle-кнопка (сердце filled/outline): залогинен → `addFavorite`/`removeFavorite` + optimistic `qc.setQueryData(["favorites"], ...)` (откат при ошибке); гость → `router.replace("/login?callbackUrl=...")`. Состояние «в избранном» из query `["favorites"]` по `listingId`.

**Общие (из `src/components/shared/` после refactor):** `Pagination`, `EmptyState`, `StatusBadge` (enum→вариант+label через `Status.*`).

## Страница `/catalog`

`useQuery(["catalog","search",filters,locale])` → `searchListings(filters, locale)`. Фильтры в URL searchParams; чтение через `window.location.search` (+ test-only Promise-fallback) по паттерну auth-страниц (Next 15 client не получает searchParams-проп). Ввод города/цены/возраста → debounce 300ms (`useDebouncedValue` из `shared/`) → обновление URL (`window.history.replaceState`) → рефетч. Категория/порода/пол/sort → мгновенно. `useQuery(["catalog","categories",locale])` → `getCategories` для фильтра; `useQuery(["catalog","breeds",categoryId,locale], {enabled:!!categoryId})` → `getBreeds`.

Сетка адаптивная (grid `grid-cols-1 sm:2 lg:3`). Заголовок + `resultsCount`. Сортировка: `sortBy`+`sortDirection` (новые `createdAt DESC` / цена↑ `price ASC` / цена↓ `price DESC` / популярные `viewsCount DESC` / по рейтингу продавца `sellerRating DESC`). Пагинация — `<Pagination>`. Ошибки/пусто — `<EmptyState>`.

## Страница `/listings/[id]`

`id = useParams().id`. `useQuery(["listing",id,locale])` → `getListing(id, locale)`. Загрузка → skeleton; 404/error → `EmptyState` (`Listing.notFound`/`loadError`); ок → детали:
- `ImageGallery` (главное + миниатюры)
- заголовок, цена+валюта, `StatusBadge`
- локация (город/страна), бейджи: пол (`Status.MALE/FEMALE`), возраст (мес), цвет, вес, `hasVaccination`/`hasDocuments` (✓/✗/— для null), `healthInfo`, `viewsCount`, дата создания
- категория→порода
- продавец: аватар-инициалы + имя + город + рейтинг + всего отзывов (из `seller: PublicProfile`)
- действия: `FavoriteButton`, «Забронировать» → `BookingDialog`
- `FavoriteButton`/booking — auth-gated (гость → redirect `/login?callbackUrl=<raw pathname>`)

## Страница `/favorites` (auth, presence-guard)

`useQuery(["favorites"])` → `listFavorites()` (через прокси, bearer из cookie). Сетка `ListingCard` из `favorite.listing`. Пусто → `EmptyState` (`Favorites.empty`). 401 (guest sneaks past middleware) → глобальный 401-эффект redirect `/login`. `FavoriteButton` на карточке удаляет из избранного + optimistic.

## Страница `/` (лендинг)

Минимальный лендинг: приветствие (`Home.welcome`/`subtitle`) + CTA-кнопка «Перейти в каталог» → `/catalog`. Без Featured-блока (чистое разделение).

## i18n

Все строки — в оба `messages/ru.json` + `en.json` + в key-list `messages.test.ts`. Новые неймспейсы:
- `Catalog.*` — title, фильтры (category, breed, breedPlaceholder, city, cityPlaceholder, priceMin, priceMax, gender, genderAny, ageMin, ageMax, ageUnit, reset, sortBy, sort.{newest,priceAsc,priceDesc,popular,sellerRating}), resultsCount, empty, loadError, retry.
- `Listing.*` — seller, location, age, ageUnit, gender, color, weight, healthInfo, hasVaccination, hasDocuments, views, posted, breed, category, notFound, loadError, addToFavorites, removeFromFavorites, loginToFav, book, bookingMessage, bookingMessagePlaceholder, bookingSubmit, bookingCancel, bookingSuccess, bookingError, bookingAlreadyExists.
- `Favorites.*` — title, empty, loginRequired, loadError, retry.
- `Home.*` — welcome, subtitle, goToCatalog (расширить существующий `welcome`).
- `Status.*` — добавить MALE, FEMALE, DRAFT, RESERVED, SOLD, ARCHIVED (если отсутствуют; проверить при имплементации). PENDING/CONFIRMED/CANCELLED/COMPLETED уже есть.

## Обработка ошибок

- Загрузка (catalog/detail/favorites): `isError` → `EmptyState(loadError)` + «повторить» (`refetch`); пустой результат → `EmptyState(empty)`.
- Мутации (favorite/book): sonner-тост из `ApiError.detail`/`violations`. `bookListing` 400 → тост (`bookingAlreadyExists`/`bookingError`); 401 на мутации — глобальный 401-эффект SessionProvider redirect `/login` (не дублировать).
- `noUncheckedIndexedAccess`: `images[0]` через `?.`/truthy-guard; главное изображение `images.find(i=>i.isMain) ?? images[0] ?? null`.

## Auth-gating

- Каталог/детали — публичные; гость видит всё, но `FavoriteButton` и «Забронировать» для гостя → `router.replace("/login?callbackUrl=" + safeCallbackUrl(pathname))`.
- `/favorites` — middleware presence-guard (добавить в `PROTECTED`).
- Optimistic-favorites: `FavoriteButton` после мутации `qc.setQueryData(["favorites"], ...)` (добавить/удалить элемент); откат при ошибке.

## Тестирование

Vitest + RTL + MSW (MSW перехватывает `/api/proxy/listings*`, `/api/proxy/categories*`, `/api/proxy/favorites*`; `server.close()` в `afterEach`):
- `src/tests/catalog-endpoints.test.ts` — URL+query (skip-null/пусто) + `Accept-Language` + тела.
- `src/tests/catalog-page.test.tsx` — сетка, фильтры (debounce), смена категории подгружает породы, сброс, пагинация, empty-state, sort меняет query.
- `src/tests/listing-detail-page.test.tsx` — детали/галерея/продавец, 404→EmptyState, FavoriteButton toggle (залогинен/гость→redirect), BookingDialog (submit→bookListing, 400 already-exists→тост).
- `src/tests/favorites-page.test.tsx` — сетка избранного, пусто, login-required.
- Расширение `src/tests/messages.test.ts` — все новые ключи.
- Playwright e2e `e2e/catalog.spec.ts` — гость открывает каталог, фильтрует по категории, открывает детали (`page.route`-стабы на `/api/proxy/listings*`, `/api/proxy/categories*`; каталог публичный — middleware не делает server-side fetch, поэтому e2e-тестируем, в отличие от админ-guard). favorites/booking-действия в e2e не покрываю (нужна реальная auth-сессия; UI покрыт витестом).

## Pre-merge гейт

`pnpm test && pnpm tsc --noEmit && pnpm build && pnpm exec playwright test`.

## Новые зависимости

Нет (все примитивы уже установлены: `@radix-ui/react-dialog`, recharts не нужен для каталога).
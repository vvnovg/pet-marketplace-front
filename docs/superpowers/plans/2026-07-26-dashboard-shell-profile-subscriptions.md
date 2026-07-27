# Личный кабинет (часть 1): каркас, профиль, подписки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить страницу-заглушку `/[locale]/dashboard` в работающий раздел с боковой навигацией, обзорной страницей, редактированием профиля и управлением подписками на поиск.

**Architecture:** Route-группа `(dashboard)` получает клиентский `layout.tsx` с компонентом `DashboardNav`. Каждая страница — клиентский компонент на TanStack Query поверх тонких модулей-эндпоинтов в `src/lib/api/endpoints/`. Чистая логика (описание фильтров подписки, сборка query-string, преобразование фильтров каталога) вынесена в `src/lib/subscriptions/filters.ts` и покрыта unit-тестами отдельно от JSX. В бэкенде правится один DTO и один метод сервиса, чтобы `PUT /users/me` принимал имя, фамилию и телефон.

**Tech Stack:** Next.js 15 (App Router, client components), React 19, next-intl 4, TanStack Query 5, react-hook-form 7 + zod 3, Tailwind, Radix (Dialog), sonner, Vitest + RTL + MSW, Playwright. Бэкенд — Spring Boot 4, Java 26, MapStruct, Bean Validation.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-26-dashboard-shell-profile-subscriptions-design.md`.
- Два репозитория: фронтенд `/Users/vvnovg/pet-marketplace-front` (ветка `feat/dashboard-shell-profile-subscriptions`), бэкенд `/Users/vvnovg/pet-marketplace` (ветка `claude/pet-shop-dashboard-features-34eacf`). Коммиты делаются в том репозитории, файлы которого менялись.
- Все пути в `Link href` из `@/i18n` — **без** префикса локали (`/dashboard/profile`, а не `/ru/dashboard/profile`). `usePathname()` из `@/i18n` тоже возвращает путь без локали.
- Никаких новых зависимостей. Всё, что нужно, уже в `package.json`.
- Все новые i18n-ключи добавляются в `ru.json` **и** `en.json` и перечисляются в массиве `keys` файла `src/tests/messages.test.ts`.
- Бизнес-ошибки на клиенте: `ApiError` с непустым `violations[]` раскладывается через `form.setError`; остальные `ApiError` — `toast.error(...)` с `e.detail`; 401 не перехватывается локально (его ловит `SessionProvider`).
- Пустая строка в необязательном текстовом поле отправляется на бэкенд как `null`.
- Java-команды в бэкенде: системный `gradle` (не `./gradlew`), JDK 26. `gradle test` требует запущенного Docker.
- Фронтенд-команды: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm exec playwright test`.
- Денежные поля (`BigDecimal`) бэкенд сериализует как JSON-числа, но в `src/types/api.ts` для них исторически используется псевдоним `Money = string`. Новый код не должен полагаться на строковость: при выводе в разметку значение приводится через `String(v)`.

---

### Task 1: Бэкенд — `PUT /users/me` принимает имя, фамилию и телефон

**Files:**
- Modify: `/Users/vvnovg/pet-marketplace/src/main/java/com/petmarketplace/application/user/dto/ProfileUpdateRequest.java`
- Modify: `/Users/vvnovg/pet-marketplace/src/main/java/com/petmarketplace/application/user/service/ProfileService.java:51-56`
- Test: `/Users/vvnovg/pet-marketplace/src/test/java/com/petmarketplace/application/user/controller/UserControllerTest.java`

**Interfaces:**
- Consumes: ничего.
- Produces: `PUT /users/me` дополнительно принимает поля `firstName`, `lastName`, `phone` и возвращает их в `UserProfileResponse`. Порядок компонентов рекорда: `(bio, country, city, address, latitude, longitude, firstName, lastName, phone)` — новые поля добавлены **в конец**, чтобы существующие позиционные вызовы правились механически.

Три новых поля живут в сущности `User`, а не `Profile` (у `Profile` их нет), поэтому MapStruct-маппер `updateProfileFromRequest` их проигнорирует (`unmappedSourcePolicy` по умолчанию `IGNORE`) — присваивание пишем руками в сервисе.

- [ ] **Step 1: Написать падающие тесты**

Открыть `src/test/java/com/petmarketplace/application/user/controller/UserControllerTest.java`. Сначала обновить четыре существующих позиционных вызова конструктора (строки 38, 49, 53, 62), дописав `, null, null, null` перед закрывающей скобкой:

```java
    @Test
    void updateProfilePersistsFields() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        ResponseEntity<String> res = putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        "new bio", "Russia", "Samara", "street", null, null, null, null, null), buyer);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(parse(res).get("bio").asText()).isEqualTo("new bio");
        assertThat(parse(res).get("city").asText()).isEqualTo("Samara");
    }

    @Test
    void updateProfileValidationRejectsOutOfRangeLatitude() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        assertThat(putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        null, null, null, null, new BigDecimal("-91"), null, null, null, null), buyer)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        null, null, null, null, null, new BigDecimal("181"), null, null, null), buyer)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateProfileValidationRejectsTooLongBio() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        assertThat(putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        "x".repeat(2001), null, null, null, null, null, null, null, null), buyer)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
```

Затем дописать два новых теста сразу после `updateProfileValidationRejectsTooLongBio`:

```java
    @Test
    void updateProfilePersistsIdentityFields() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        ResponseEntity<String> res = putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        null, null, null, null, null, null, "Ivan", "Petrov", "+79990000000"), buyer);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = parse(res);
        assertThat(body.get("firstName").asText()).isEqualTo("Ivan");
        assertThat(body.get("lastName").asText()).isEqualTo("Petrov");
        assertThat(body.get("phone").asText()).isEqualTo("+79990000000");

        JsonNode reread = parse(getStatus("/users/me", buyer));
        assertThat(reread.get("firstName").asText()).isEqualTo("Ivan");
        assertThat(reread.get("lastName").asText()).isEqualTo("Petrov");
        assertThat(reread.get("phone").asText()).isEqualTo("+79990000000");
    }

    @Test
    void updateProfileValidationRejectsTooLongPhone() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        assertThat(putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        null, null, null, null, null, null, null, null, "x".repeat(21)), buyer)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateProfileValidationRejectsTooLongFirstName() {
        var buyer = createUniqueUser(com.petmarketplace.domain.user.entity.Role.BUYER);
        assertThat(putStatus("/users/me",
                new com.petmarketplace.application.user.dto.ProfileUpdateRequest(
                        null, null, null, null, null, null, "x".repeat(101), null, null), buyer)
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Из `/Users/vvnovg/pet-marketplace`:

```bash
gradle test --tests "com.petmarketplace.application.user.controller.UserControllerTest"
```

Ожидается: ошибка **компиляции** — `constructor ProfileUpdateRequest cannot be applied to given types`, так как рекорд ещё принимает 6 компонентов, а вызовы передают 9.

- [ ] **Step 3: Добавить поля в DTO**

Заменить содержимое `src/main/java/com/petmarketplace/application/user/dto/ProfileUpdateRequest.java` целиком:

```java
package com.petmarketplace.application.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProfileUpdateRequest(
        @Size(max = 2000)
        String bio,

        @Size(max = 100)
        String country,

        @Size(max = 100)
        String city,

        @Size(max = 255)
        String address,

        @DecimalMin(value = "-90.0")
        @DecimalMax(value = "90.0")
        BigDecimal latitude,

        @DecimalMin(value = "-180.0")
        @DecimalMax(value = "180.0")
        BigDecimal longitude,

        @Size(max = 100)
        String firstName,

        @Size(max = 100)
        String lastName,

        @Size(max = 20)
        String phone
) {
}
```

- [ ] **Step 4: Сохранять новые поля в сервисе**

В `src/main/java/com/petmarketplace/application/user/service/ProfileService.java` заменить метод `updateCurrentProfile`:

```java
    public UserProfileResponse updateCurrentProfile(ProfileUpdateRequest request) {
        User user = currentUser();
        Profile profile = findOrCreateProfile(user);
        profileMapper.updateProfileFromRequest(request, profile);
        // firstName/lastName/phone живут в User, а не в Profile, поэтому маппер их
        // не трогает — присваиваем явно. Семантика PUT: null затирает поле.
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setPhone(request.phone());
        userRepository.save(user);
        return profileMapper.toUserProfileResponse(profileRepository.save(profile), user);
    }
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

```bash
gradle test --tests "com.petmarketplace.application.user.controller.UserControllerTest"
```

Ожидается: BUILD SUCCESSFUL, все тесты класса зелёные.

- [ ] **Step 6: Прогнать весь бэкенд-сьют**

```bash
gradle test
```

Ожидается: BUILD SUCCESSFUL. Если сообщается «0 tests», Testcontainers не видит Docker — см. раздел Common Commands в `CLAUDE.md`.

- [ ] **Step 7: Коммит**

```bash
cd /Users/vvnovg/pet-marketplace && git add src/main/java/com/petmarketplace/application/user/dto/ProfileUpdateRequest.java src/main/java/com/petmarketplace/application/user/service/ProfileService.java src/test/java/com/petmarketplace/application/user/controller/UserControllerTest.java && git commit -m "feat(user): allow updating first name, last name and phone via PUT /users/me"
```

---

### Task 2: Типы и i18n-ключи

**Files:**
- Modify: `src/types/api.ts` (блок `Subscription`)
- Modify: `src/messages/ru.json`
- Modify: `src/messages/en.json`
- Test: `src/tests/messages.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `SubscriptionFilters` — `{ categoryId: UUID | null; breedId: UUID | null; city: string | null; minPrice: Money | null; maxPrice: Money | null; gender: ListingGender | null; minAge: number | null; maxAge: number | null; hasVaccination: boolean | null; hasDocuments: boolean | null }`
  - `Subscription` — `{ id: UUID; filters: SubscriptionFilters; active: boolean; createdAt: IsoInstant }` (поле `isActive` удалено — бэкенд отдаёт `active`)
  - `SubscriptionCreate` — все поля `SubscriptionFilters`, но `minPrice`/`maxPrice` типа `number | null`, все поля опциональные
  - `ProfileUpdate` — `{ firstName: string | null; lastName: string | null; phone: string | null; bio: string | null; country: string | null; city: string | null; address: string | null }`
  - Секции сообщений `Dashboard.*` и `Catalog.saveSearch*`

- [ ] **Step 1: Написать падающий тест на ключи сообщений**

В `src/tests/messages.test.ts` добавить в конец массива `keys` (после строки с `"Favorites.retry",`):

```ts
    "Dashboard.overview", "Dashboard.navLabel", "Dashboard.comingSoon",
    "Dashboard.cards.profile", "Dashboard.cards.myListings", "Dashboard.cards.bookings",
    "Dashboard.cards.messages", "Dashboard.cards.favorites", "Dashboard.cards.subscriptions",
    "Dashboard.ratingLine",
    "Dashboard.profilePage.title", "Dashboard.profilePage.avatarTitle", "Dashboard.profilePage.avatarUpload",
    "Dashboard.profilePage.avatarTooLarge", "Dashboard.profilePage.avatarSaved",
    "Dashboard.profilePage.firstName", "Dashboard.profilePage.lastName", "Dashboard.profilePage.phone",
    "Dashboard.profilePage.bio", "Dashboard.profilePage.country", "Dashboard.profilePage.city",
    "Dashboard.profilePage.address", "Dashboard.profilePage.save", "Dashboard.profilePage.saved",
    "Dashboard.profilePage.error",
    "Dashboard.subscriptionsPage.title", "Dashboard.subscriptionsPage.empty",
    "Dashboard.subscriptionsPage.create", "Dashboard.subscriptionsPage.createTitle",
    "Dashboard.subscriptionsPage.createSubmit", "Dashboard.subscriptionsPage.cancel",
    "Dashboard.subscriptionsPage.created", "Dashboard.subscriptionsPage.deleted",
    "Dashboard.subscriptionsPage.delete", "Dashboard.subscriptionsPage.deleteTitle",
    "Dashboard.subscriptionsPage.deleteDesc", "Dashboard.subscriptionsPage.openInCatalog",
    "Dashboard.subscriptionsPage.createdAt", "Dashboard.subscriptionsPage.needFilter",
    "Dashboard.subscriptionsPage.unknownRef", "Dashboard.subscriptionsPage.loadError",
    "Dashboard.subscriptionsPage.retry", "Dashboard.subscriptionsPage.error",
    "Dashboard.subscriptionsPage.filterCity", "Dashboard.subscriptionsPage.filterPrice",
    "Dashboard.subscriptionsPage.filterAge", "Dashboard.subscriptionsPage.filterVaccination",
    "Dashboard.subscriptionsPage.filterDocuments",
    "Dashboard.subscriptionsPage.rangeBetween", "Dashboard.subscriptionsPage.rangeFrom",
    "Dashboard.subscriptionsPage.rangeTo",
    "Catalog.saveSearch", "Catalog.saveSearchDone", "Catalog.saveSearchError",
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

```bash
cd /Users/vvnovg/pet-marketplace-front && pnpm test -- src/tests/messages.test.ts
```

Ожидается: FAIL — десятки кейсов `ru has Dashboard.overview` и т. д. с `expected undefined to be 'string'`.

- [ ] **Step 3: Добавить русские сообщения**

В `src/messages/ru.json` заменить секцию `"Dashboard"` целиком:

```json
  "Dashboard": {
    "welcome": "Добро пожаловать, {email}",
    "overview": "Обзор",
    "profile": "Профиль",
    "myListings": "Мои объявления",
    "bookings": "Бронирования",
    "messages": "Сообщения",
    "favorites": "Избранное",
    "subscriptions": "Подписки",
    "navLabel": "Разделы личного кабинета",
    "comingSoon": "Раздел в разработке",
    "ratingLine": "Рейтинг {rating} · отзывов: {count}",
    "cards": {
      "profile": "Личные данные, контакты и аватар",
      "myListings": "Публикация и редактирование объявлений",
      "bookings": "Заявки на покупку и их статусы",
      "messages": "Переписка с покупателями и продавцами",
      "favorites": "Сохранённые объявления",
      "subscriptions": "Сохранённые поисковые фильтры"
    },
    "profilePage": {
      "title": "Профиль",
      "avatarTitle": "Аватар",
      "avatarUpload": "Загрузить",
      "avatarTooLarge": "Файл больше 5 МБ",
      "avatarSaved": "Аватар обновлён",
      "firstName": "Имя",
      "lastName": "Фамилия",
      "phone": "Телефон",
      "bio": "О себе",
      "country": "Страна",
      "city": "Город",
      "address": "Адрес",
      "save": "Сохранить",
      "saved": "Профиль сохранён",
      "error": "Не удалось сохранить: {detail}"
    },
    "subscriptionsPage": {
      "title": "Подписки",
      "empty": "Сохранённых поисков пока нет",
      "create": "Новая подписка",
      "createTitle": "Новая подписка",
      "createSubmit": "Сохранить",
      "cancel": "Отмена",
      "created": "Подписка сохранена",
      "deleted": "Подписка удалена",
      "delete": "Удалить",
      "deleteTitle": "Удалить подписку?",
      "deleteDesc": "Сохранённый поиск будет удалён безвозвратно.",
      "openInCatalog": "Открыть в каталоге",
      "createdAt": "Создана {date}",
      "needFilter": "Задайте хотя бы один фильтр",
      "unknownRef": "—",
      "loadError": "Не удалось загрузить подписки",
      "retry": "Повторить",
      "error": "Ошибка: {detail}",
      "filterCity": "Город: {value}",
      "filterPrice": "Цена: {value}",
      "filterAge": "Возраст: {value} мес",
      "filterVaccination": "С прививками",
      "filterDocuments": "С документами",
      "rangeBetween": "{min} — {max}",
      "rangeFrom": "от {min}",
      "rangeTo": "до {max}"
    }
  },
```

Затем в том же файле в секцию `"Catalog"` добавить три ключа после `"retry"`:

```json
    "saveSearch": "Сохранить поиск",
    "saveSearchDone": "Поиск сохранён в подписках",
    "saveSearchError": "Не удалось сохранить поиск: {detail}"
```

- [ ] **Step 4: Добавить английские сообщения**

В `src/messages/en.json` заменить секцию `"Dashboard"` целиком:

```json
  "Dashboard": {
    "welcome": "Welcome, {email}",
    "overview": "Overview",
    "profile": "Profile",
    "myListings": "My listings",
    "bookings": "Bookings",
    "messages": "Messages",
    "favorites": "Favorites",
    "subscriptions": "Subscriptions",
    "navLabel": "Dashboard sections",
    "comingSoon": "This section is under development",
    "ratingLine": "Rating {rating} · reviews: {count}",
    "cards": {
      "profile": "Personal details, contacts and avatar",
      "myListings": "Publish and edit your listings",
      "bookings": "Purchase requests and their statuses",
      "messages": "Chats with buyers and sellers",
      "favorites": "Saved listings",
      "subscriptions": "Saved search filters"
    },
    "profilePage": {
      "title": "Profile",
      "avatarTitle": "Avatar",
      "avatarUpload": "Upload",
      "avatarTooLarge": "File is larger than 5 MB",
      "avatarSaved": "Avatar updated",
      "firstName": "First name",
      "lastName": "Last name",
      "phone": "Phone",
      "bio": "About",
      "country": "Country",
      "city": "City",
      "address": "Address",
      "save": "Save",
      "saved": "Profile saved",
      "error": "Could not save: {detail}"
    },
    "subscriptionsPage": {
      "title": "Subscriptions",
      "empty": "No saved searches yet",
      "create": "New subscription",
      "createTitle": "New subscription",
      "createSubmit": "Save",
      "cancel": "Cancel",
      "created": "Subscription saved",
      "deleted": "Subscription deleted",
      "delete": "Delete",
      "deleteTitle": "Delete subscription?",
      "deleteDesc": "The saved search will be permanently removed.",
      "openInCatalog": "Open in catalog",
      "createdAt": "Created {date}",
      "needFilter": "Set at least one filter",
      "unknownRef": "—",
      "loadError": "Could not load subscriptions",
      "retry": "Retry",
      "error": "Error: {detail}",
      "filterCity": "City: {value}",
      "filterPrice": "Price: {value}",
      "filterAge": "Age: {value} mo",
      "filterVaccination": "Vaccinated",
      "filterDocuments": "With documents",
      "rangeBetween": "{min} — {max}",
      "rangeFrom": "from {min}",
      "rangeTo": "up to {max}"
    }
  },
```

И в секцию `"Catalog"` файла `en.json` после `"retry"`:

```json
    "saveSearch": "Save search",
    "saveSearchDone": "Search saved to subscriptions",
    "saveSearchError": "Could not save search: {detail}"
```

- [ ] **Step 5: Запустить тест сообщений и убедиться, что он проходит**

```bash
pnpm test -- src/tests/messages.test.ts
```

Ожидается: PASS, все кейсы зелёные.

- [ ] **Step 6: Обновить типы**

В `src/types/api.ts` заменить блок

```ts
export interface Subscription {
  id: UUID;
  filters: Record<string, unknown>;
  isActive: boolean;
  createdAt: IsoInstant;
}
```

на:

```ts
export interface SubscriptionFilters {
  categoryId: UUID | null;
  breedId: UUID | null;
  city: string | null;
  minPrice: Money | null;
  maxPrice: Money | null;
  gender: ListingGender | null;
  minAge: number | null;
  maxAge: number | null;
  hasVaccination: boolean | null;
  hasDocuments: boolean | null;
}

export interface Subscription {
  id: UUID;
  filters: SubscriptionFilters;
  active: boolean;
  createdAt: IsoInstant;
}

export interface SubscriptionCreate {
  categoryId?: string | null;
  breedId?: string | null;
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  gender?: ListingGender | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasVaccination?: boolean | null;
  hasDocuments?: boolean | null;
}

export interface ProfileUpdate {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
}
```

- [ ] **Step 7: Проверить типы и весь сьют**

```bash
pnpm exec tsc --noEmit && pnpm test
```

Ожидается: обе команды успешны. `isActive` нигде не использовался, поэтому переименование ничего не ломает.

- [ ] **Step 8: Коммит**

```bash
git add src/types/api.ts src/messages/ru.json src/messages/en.json src/tests/messages.test.ts && git commit -m "feat(dashboard): add subscription/profile types and i18n keys"
```

---

### Task 3: Модули API — профиль, подписки, диалоги

**Files:**
- Create: `src/lib/api/endpoints/profile.ts`
- Create: `src/lib/api/endpoints/subscriptions.ts`
- Create: `src/lib/api/endpoints/messages.ts`
- Test: `src/tests/profile-endpoints.test.ts`
- Test: `src/tests/subscriptions-endpoints.test.ts`
- Test: `src/tests/messages-endpoints.test.ts`

**Interfaces:**
- Consumes: `ProfileUpdate`, `Subscription`, `SubscriptionCreate`, `UserProfile`, `Conversation` из `@/types/api` (Task 2); `apiGet/apiPut/apiPost/apiDelete/apiUpload/ClientOpts` из `@/lib/api/client`.
- Produces:
  - `updateProfile(body: ProfileUpdate, opts?: ClientOpts): Promise<UserProfile>`
  - `uploadAvatar(file: File | Blob, opts?: ClientOpts): Promise<UserProfile>`
  - `listSubscriptions(opts?: ClientOpts): Promise<Subscription[]>`
  - `createSubscription(body: SubscriptionCreate, opts?: ClientOpts): Promise<Subscription>`
  - `deleteSubscription(id: string, opts?: ClientOpts): Promise<void>`
  - `getConversations(opts?: ClientOpts): Promise<Conversation[]>`

- [ ] **Step 1: Написать падающие тесты для профиля**

Создать `src/tests/profile-endpoints.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { updateProfile, uploadAvatar } from "@/lib/api/endpoints/profile";
import { ApiError } from "@/lib/api/errors";

type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
let failNext = false;

const server = setupServer(
  http.put("*/api/proxy/users/me", async ({ request }) => {
    calls.push({ method: "PUT", url: request.url, body: await request.json() });
    if (failNext) {
      return HttpResponse.json(
        { status: 400, title: "Validation failed", detail: "bad", violations: [{ field: "phone", message: "too long" }] },
        { status: 400 },
      );
    }
    return HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER" });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; failNext = false; server.resetHandlers(); });
afterAll(() => server.close());

const last = (): Call => calls[calls.length - 1]!;

describe("profile endpoints", () => {
  it("updateProfile PUTs to users/me with the full body", async () => {
    await updateProfile(
      { firstName: "Ivan", lastName: null, phone: null, bio: null, country: null, city: "Samara", address: null },
      { baseUrl: "http://t" },
    );
    expect(last().method).toBe("PUT");
    expect(last().url).toBe("http://t/api/proxy/users/me");
    expect(last().body).toMatchObject({ firstName: "Ivan", lastName: null, city: "Samara" });
  });

  it("updateProfile surfaces violations as ApiError", async () => {
    failNext = true;
    await expect(
      updateProfile(
        { firstName: null, lastName: null, phone: "x", bio: null, country: null, city: null, address: null },
        { baseUrl: "http://t" },
      ),
    ).rejects.toMatchObject({ status: 400, violations: [{ field: "phone", message: "too long" }] });
    await expect(
      updateProfile(
        { firstName: null, lastName: null, phone: "x", bio: null, country: null, city: null, address: null },
        { baseUrl: "http://t" },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("uploadAvatar POSTs multipart with the 'file' field", async () => {
    // jsdom's fetch/Request cannot serialize a jsdom File's bytes through a real
    // multipart body in this environment: verified empirically that the actual bytes
    // on the wire come out as the literal string "undefined" (size 9) regardless of
    // what was uploaded, once the FormData crosses into `new Request()`/undici. So
    // this stubs fetch to inspect the FormData apiUpload builds *before* that broken
    // serialization step, where `entry instanceof Blob` and `.size`/`.text()` are
    // still accurate.
    const file = new File(["x"], "a.png", { type: "image/png" });
    const state: { captured: { method: string; url: string; body: { size: number; text: string } | null } | null } = {
      captured: null,
    };
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const entry = init?.body instanceof FormData ? init.body.get("file") : null;
      state.captured = {
        method: init?.method ?? "GET",
        url: String(input),
        body: entry instanceof Blob ? { size: entry.size, text: await entry.text() } : null,
      };
      return new Response(JSON.stringify({ id: "u1", avatarUrl: "/a.png" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      await uploadAvatar(file, { baseUrl: "http://t" });
    } finally {
      vi.stubGlobal("fetch", realFetch);
    }
    expect(state.captured?.method).toBe("POST");
    expect(state.captured?.url).toBe("http://t/api/proxy/users/me/avatar");
    expect(state.captured?.body).toEqual({ size: 1, text: "x" });
  });
});
```

Примечание: во втором кейсе `failNext` сбрасывается только в `afterEach`, поэтому оба `await expect(...)` внутри одного `it` видят один и тот же 400 — это намеренно.

Отступление от исходного плана (обнаружено при реализации): исходная версия этого теста регистрировала MSW-хендлер `http.post("*/api/proxy/users/me/avatar", ...)` и проверяла `fd.get("file") instanceof File`. Это невозможно в jsdom — байты jsdom `File` не переживают сериализацию `fetch`/`new Request()` в multipart-тело в этом окружении (на "проводе" оказывается буквальная строка `"undefined"` независимо от загруженного файла). Тест переписан так, чтобы подменять `globalThis.fetch` и разбирать `FormData`, которую строит `apiUpload`, до этого шага сериализации — там `entry instanceof Blob` и `.size`/`.text()` ещё корректны.

- [ ] **Step 2: Написать падающие тесты для подписок и диалогов**

Создать `src/tests/subscriptions-endpoints.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { listSubscriptions, createSubscription, deleteSubscription } from "@/lib/api/endpoints/subscriptions";

type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
const server = setupServer(
  http.get("*/api/proxy/subscriptions", ({ request }) => {
    calls.push({ method: "GET", url: request.url, body: null });
    return HttpResponse.json([]);
  }),
  http.post("*/api/proxy/subscriptions", async ({ request }) => {
    calls.push({ method: "POST", url: request.url, body: await request.json() });
    return HttpResponse.json({ id: "s1", filters: {}, active: true, createdAt: "2026-01-01T00:00:00Z" });
  }),
  http.delete("*/api/proxy/subscriptions/:id", ({ request, params }) => {
    calls.push({ method: "DELETE", url: `subscriptions/${params.id}`, body: null });
    return new HttpResponse(null, { status: 204 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const last = (): Call => calls[calls.length - 1]!;

describe("subscription endpoints", () => {
  it("listSubscriptions GETs subscriptions", async () => {
    await expect(listSubscriptions({ baseUrl: "http://t" })).resolves.toEqual([]);
    expect(last().method).toBe("GET");
    expect(last().url).toBe("http://t/api/proxy/subscriptions");
  });

  it("createSubscription POSTs the filter body", async () => {
    const created = await createSubscription({ city: "Samara", minPrice: 100 }, { baseUrl: "http://t" });
    expect(created.id).toBe("s1");
    expect(last().method).toBe("POST");
    expect(last().body).toMatchObject({ city: "Samara", minPrice: 100 });
  });

  it("deleteSubscription DELETEs by id", async () => {
    await deleteSubscription("s7", { baseUrl: "http://t" });
    expect(last().method).toBe("DELETE");
    expect(last().url).toBe("subscriptions/s7");
  });
});
```

Создать `src/tests/messages-endpoints.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getConversations } from "@/lib/api/endpoints/messages";

let lastUrl = "";
const server = setupServer(
  http.get("*/api/proxy/messages", ({ request }) => {
    lastUrl = request.url;
    return HttpResponse.json([{ partner: { id: "p1" }, lastMessage: null, unreadCount: 3 }]);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { lastUrl = ""; server.resetHandlers(); });
afterAll(() => server.close());

describe("message endpoints", () => {
  it("getConversations GETs messages and returns unread counts", async () => {
    const res = await getConversations({ baseUrl: "http://t" });
    expect(lastUrl).toBe("http://t/api/proxy/messages");
    expect(res[0]!.unreadCount).toBe(3);
  });
});
```

- [ ] **Step 3: Запустить тесты и убедиться, что они падают**

```bash
pnpm test -- src/tests/profile-endpoints.test.ts src/tests/subscriptions-endpoints.test.ts src/tests/messages-endpoints.test.ts
```

Ожидается: FAIL с `Failed to resolve import "@/lib/api/endpoints/profile"` (и аналогично для двух других модулей).

- [ ] **Step 4: Написать модули**

Создать `src/lib/api/endpoints/profile.ts`:

```ts
import { apiPut, apiUpload, type ClientOpts } from "@/lib/api/client";
import type { ProfileUpdate, UserProfile } from "@/types/api";

export function updateProfile(body: ProfileUpdate, opts: ClientOpts = {}): Promise<UserProfile> {
  return apiPut<UserProfile>("users/me", body, opts);
}

export function uploadAvatar(file: File | Blob, opts: ClientOpts = {}): Promise<UserProfile> {
  return apiUpload<UserProfile>("users/me/avatar", file, "file", opts);
}
```

Создать `src/lib/api/endpoints/subscriptions.ts`:

```ts
import { apiGet, apiPost, apiDelete, type ClientOpts } from "@/lib/api/client";
import type { Subscription, SubscriptionCreate } from "@/types/api";

export function listSubscriptions(opts: ClientOpts = {}): Promise<Subscription[]> {
  return apiGet<Subscription[]>("subscriptions", opts);
}

export function createSubscription(body: SubscriptionCreate, opts: ClientOpts = {}): Promise<Subscription> {
  return apiPost<Subscription>("subscriptions", body, opts);
}

export function deleteSubscription(id: string, opts: ClientOpts = {}): Promise<void> {
  return apiDelete(`subscriptions/${id}`, opts);
}
```

Создать `src/lib/api/endpoints/messages.ts`:

```ts
import { apiGet, type ClientOpts } from "@/lib/api/client";
import type { Conversation } from "@/types/api";

export function getConversations(opts: ClientOpts = {}): Promise<Conversation[]> {
  return apiGet<Conversation[]>("messages", opts);
}
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

```bash
pnpm test -- src/tests/profile-endpoints.test.ts src/tests/subscriptions-endpoints.test.ts src/tests/messages-endpoints.test.ts
```

Ожидается: PASS, 7 кейсов.

- [ ] **Step 6: Коммит**

```bash
git add src/lib/api/endpoints/profile.ts src/lib/api/endpoints/subscriptions.ts src/lib/api/endpoints/messages.ts src/tests/profile-endpoints.test.ts src/tests/subscriptions-endpoints.test.ts src/tests/messages-endpoints.test.ts && git commit -m "feat(dashboard): add profile, subscription and conversation API modules"
```

---

### Task 4: Каркас кабинета — навигация, layout, страницы-заглушки

**Files:**
- Create: `src/components/dashboard/DashboardNav.tsx`
- Create: `src/app/[locale]/(dashboard)/layout.tsx`
- Create: `src/app/[locale]/(dashboard)/dashboard/listings/page.tsx`
- Create: `src/app/[locale]/(dashboard)/dashboard/bookings/page.tsx`
- Create: `src/app/[locale]/(dashboard)/dashboard/messages/page.tsx`
- Test: `src/tests/dashboard-nav.test.tsx`

**Interfaces:**
- Consumes: `useSession()` из `@/components/auth/useSession`; `Link`, `usePathname` из `@/i18n`; `cn` из `@/lib/utils/cn`; `EmptyState` из `@/components/shared/EmptyState`; ключи `Dashboard.*` (Task 2).
- Produces:
  - `DashboardNav()` — React-компонент без пропсов
  - `DASHBOARD_NAV: NavItem[]`, где `NavItem = { href: string; labelKey: string; roles?: Role[] }`
  - `isNavItemActive(href: string, pathname: string): boolean` — чистая функция

- [ ] **Step 1: Написать падающий тест навигации**

Создать `src/tests/dashboard-nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import { DashboardNav, isNavItemActive } from "@/components/dashboard/DashboardNav";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

const h = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("@/i18n", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => h.pathname,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderNav = (user: UserProfile) =>
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <DashboardNav />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("isNavItemActive", () => {
  it("matches /dashboard exactly, not by prefix", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard", "/dashboard/profile")).toBe(false);
  });
  it("matches nested routes by prefix", () => {
    expect(isNavItemActive("/dashboard/profile", "/dashboard/profile")).toBe(true);
    expect(isNavItemActive("/dashboard/listings", "/dashboard/listings/42")).toBe(true);
    expect(isNavItemActive("/dashboard/listings", "/dashboard/listings-archive")).toBe(false);
  });
});

describe("DashboardNav", () => {
  it("hides My listings for BUYER", () => {
    h.pathname = "/dashboard";
    renderNav(base);
    expect(screen.queryByRole("link", { name: "Мои объявления" })).not.toBeInTheDocument();
  });

  it("shows My listings for SELLER and ADMIN", () => {
    h.pathname = "/dashboard";
    const { unmount } = renderNav({ ...base, role: "SELLER" });
    expect(screen.getByRole("link", { name: "Мои объявления" })).toBeInTheDocument();
    unmount();
    renderNav({ ...base, role: "ADMIN" });
    expect(screen.getByRole("link", { name: "Мои объявления" })).toBeInTheDocument();
  });

  it("marks the current section with aria-current", () => {
    h.pathname = "/dashboard/subscriptions";
    renderNav(base);
    expect(screen.getByRole("link", { name: "Подписки" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Обзор" })).not.toHaveAttribute("aria-current");
  });

  it("links to bare paths without a locale prefix", () => {
    h.pathname = "/dashboard";
    renderNav(base);
    expect(screen.getByRole("link", { name: "Избранное" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute("href", "/dashboard/profile");
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

```bash
pnpm test -- src/tests/dashboard-nav.test.tsx
```

Ожидается: FAIL с `Failed to resolve import "@/components/dashboard/DashboardNav"`.

- [ ] **Step 3: Написать DashboardNav**

Создать `src/components/dashboard/DashboardNav.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n";
import { useSession } from "@/components/auth/useSession";
import { cn } from "@/lib/utils/cn";
import type { Role } from "@/types/api";

export interface NavItem {
  href: string;
  labelKey: string;
  roles?: Role[];
}

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "overview" },
  { href: "/dashboard/profile", labelKey: "profile" },
  { href: "/dashboard/listings", labelKey: "myListings", roles: ["SELLER", "ADMIN"] },
  { href: "/dashboard/bookings", labelKey: "bookings" },
  { href: "/dashboard/messages", labelKey: "messages" },
  { href: "/favorites", labelKey: "favorites" },
  { href: "/dashboard/subscriptions", labelKey: "subscriptions" },
];

/**
 * `/dashboard` совпадает только точно, иначе обзор подсвечивался бы на всех
 * вложенных страницах. Для остальных пунктов — точное совпадение или префикс с
 * разделителем `/`, чтобы `/dashboard/listings` не совпадал с `/dashboard/listings-archive`.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const { user } = useSession();

  const items = DASHBOARD_NAV.filter((i) => !i.roles || (user != null && i.roles.includes(user.role)));

  return (
    <nav aria-label={t("navLabel")} className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {items.map((i) => {
          const active = isNavItemActive(i.href, pathname);
          return (
            <li key={i.href} className="shrink-0 md:shrink">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded px-3 py-2 text-sm hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                {t(i.labelKey as never)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

```bash
pnpm test -- src/tests/dashboard-nav.test.tsx
```

Ожидается: PASS, 6 кейсов.

- [ ] **Step 5: Добавить layout и страницы-заглушки**

Создать `src/app/[locale]/(dashboard)/layout.tsx`:

```tsx
"use client";

import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <DashboardNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

Создать `src/app/[locale]/(dashboard)/dashboard/listings/page.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DashboardListingsPage() {
  const t = useTranslations("Dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("myListings")}</h1>
      <EmptyState>{t("comingSoon")}</EmptyState>
    </div>
  );
}
```

Создать `src/app/[locale]/(dashboard)/dashboard/bookings/page.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DashboardBookingsPage() {
  const t = useTranslations("Dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("bookings")}</h1>
      <EmptyState>{t("comingSoon")}</EmptyState>
    </div>
  );
}
```

Создать `src/app/[locale]/(dashboard)/dashboard/messages/page.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DashboardMessagesPage() {
  const t = useTranslations("Dashboard");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("messages")}</h1>
      <EmptyState>{t("comingSoon")}</EmptyState>
    </div>
  );
}
```

- [ ] **Step 6: Проверить типы и сборку**

```bash
pnpm exec tsc --noEmit && pnpm build
```

Ожидается: обе команды успешны, в выводе `next build` появляются маршруты `/[locale]/dashboard/listings`, `/[locale]/dashboard/bookings`, `/[locale]/dashboard/messages`.

- [ ] **Step 7: Коммит**

```bash
git add "src/components/dashboard/DashboardNav.tsx" "src/app/[locale]/(dashboard)" src/tests/dashboard-nav.test.tsx && git commit -m "feat(dashboard): add sidebar navigation, layout and section placeholders"
```

---

### Task 5: Обзорная страница `/dashboard`

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/page.tsx` (полная замена)
- Delete: `src/tests/dashboard-placeholders.test.tsx`
- Create: `src/tests/dashboard-overview.test.tsx`
- Create: `src/tests/admin-placeholder.test.tsx`

**Interfaces:**
- Consumes: `listFavorites` из `@/lib/api/endpoints/catalog`; `getConversations` из `@/lib/api/endpoints/messages` (Task 3); `StatusBadge` из `@/components/shared/StatusBadge`; `Card` из `@/components/ui/card`; ключи `Dashboard.cards.*`, `Dashboard.ratingLine` (Task 2).
- Produces: страница `/dashboard`. Ключи react-query: `["favorites"]` (переиспользует кэш страницы `/favorites`) и `["messages", "conversations"]`.

Удаляемый `dashboard-placeholders.test.tsx` проверял ещё и заголовок админки — эта проверка переносится в новый `admin-placeholder.test.tsx`, чтобы покрытие не потерялось.

- [ ] **Step 1: Написать падающий тест обзора**

Создать `src/tests/dashboard-overview.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import DashboardPage from "@/app/[locale]/(dashboard)/dashboard/page";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard",
}));

let favoritesFails = false;
const server = setupServer(
  http.get("*/api/proxy/favorites", () =>
    favoritesFails
      ? HttpResponse.json({ status: 500, title: "Error", detail: "boom" }, { status: 500 })
      : HttpResponse.json([
          { id: "f1", listing: { id: "l1" }, createdAt: "t" },
          { id: "f2", listing: { id: "l2" }, createdAt: "t" },
        ]),
  ),
  http.get("*/api/proxy/messages", () =>
    HttpResponse.json([
      { partner: { id: "p1" }, lastMessage: null, unreadCount: 2 },
      { partner: { id: "p2" }, lastMessage: null, unreadCount: 3 },
    ]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { favoritesFails = false; server.resetHandlers(); });
afterAll(() => server.close());

const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderPage = (user: UserProfile) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <DashboardPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("Dashboard overview", () => {
  it("greets the user and shows the role badge", async () => {
    renderPage(base);
    expect(screen.getByText(/Добро пожаловать, a@b.co/)).toBeInTheDocument();
    expect(await screen.findByText("Покупатель")).toBeInTheDocument();
  });

  it("shows the full name when it is set", () => {
    renderPage({ ...base, firstName: "Иван", lastName: "Петров" });
    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
  });

  it("shows favorite and unread counters", async () => {
    renderPage(base);
    expect(await screen.findByTestId("count-favorites")).toHaveTextContent("2");
    expect(await screen.findByTestId("count-messages")).toHaveTextContent("5");
  });

  it("drops the counter when its query fails but keeps the card", async () => {
    favoritesFails = true;
    renderPage(base);
    expect(await screen.findByTestId("count-messages")).toHaveTextContent("5");
    expect(screen.queryByTestId("count-favorites")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Избранное/ })).toBeInTheDocument();
  });

  it("hides the My listings card for BUYER and shows it for SELLER", () => {
    const { unmount } = renderPage(base);
    expect(screen.queryByRole("link", { name: /Мои объявления/ })).not.toBeInTheDocument();
    unmount();
    renderPage({ ...base, role: "SELLER" });
    expect(screen.getByRole("link", { name: /Мои объявления/ })).toBeInTheDocument();
  });
});
```

`"Покупатель"` — значение `Status.BUYER` в `ru.json`, которое рендерит `StatusBadge`.

Создать `src/tests/admin-placeholder.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import AdminPage from "@/app/[locale]/(admin)/admin/page";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const admin: UserProfile = {
  id: "u1", email: "a@b.co", role: "ADMIN", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

describe("Admin placeholder", () => {
  it("renders admin title", () => {
    render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="ru" messages={ru}>
          <SessionContext.Provider value={{ user: admin, status: "authenticated" }}>
            <AdminPage />
          </SessionContext.Provider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Админ-панель")).toBeInTheDocument();
  });
});
```

Удалить старый файл:

```bash
git rm src/tests/dashboard-placeholders.test.tsx
```

- [ ] **Step 2: Запустить тесты и убедиться, что обзорные падают**

```bash
pnpm test -- src/tests/dashboard-overview.test.tsx src/tests/admin-placeholder.test.tsx
```

Ожидается: `admin-placeholder` — PASS; `dashboard-overview` — FAIL (нет `count-favorites`, нет бейджа роли, страница ещё старая).

- [ ] **Step 3: Переписать страницу обзора**

Заменить `src/app/[locale]/(dashboard)/dashboard/page.tsx` целиком:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n";
import { useSession } from "@/components/auth/useSession";
import { listFavorites } from "@/lib/api/endpoints/catalog";
import { getConversations } from "@/lib/api/endpoints/messages";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import type { Conversation, Favorite } from "@/types/api";

interface OverviewCard {
  href: string;
  labelKey: string;
  count?: number;
  loading?: boolean;
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user } = useSession();

  const favorites = useQuery<Favorite[]>({
    queryKey: ["favorites"],
    queryFn: () => listFavorites(),
    enabled: !!user,
    retry: false,
  });
  const conversations = useQuery<Conversation[]>({
    queryKey: ["messages", "conversations"],
    queryFn: () => getConversations(),
    enabled: !!user,
    retry: false,
  });

  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.email ?? "");
  const initials = (
    (user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)
  ).toUpperCase();
  const unread = conversations.data?.reduce((sum, c) => sum + c.unreadCount, 0);

  const cards: OverviewCard[] = [
    { href: "/dashboard/profile", labelKey: "profile" },
    ...(user.role === "SELLER" || user.role === "ADMIN"
      ? [{ href: "/dashboard/listings", labelKey: "myListings" }]
      : []),
    { href: "/dashboard/bookings", labelKey: "bookings" },
    {
      href: "/dashboard/messages",
      labelKey: "messages",
      count: conversations.isError ? undefined : unread,
      loading: conversations.isLoading,
    },
    {
      href: "/favorites",
      labelKey: "favorites",
      count: favorites.isError ? undefined : favorites.data?.length,
      loading: favorites.isLoading,
    },
    { href: "/dashboard/subscriptions", labelKey: "subscriptions" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("welcome", { email: user.email ?? "" })}</h1>

      <Card className="flex items-center gap-4 p-4">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
            {initials}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <div className="truncate font-medium">{name}</div>
          <StatusBadge value={user.role} />
          {user.totalReviews ? (
            <div className="text-sm text-muted-foreground">
              {t("ratingLine", { rating: String(user.rating ?? 0), count: user.totalReviews })}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border p-4 transition-colors hover:bg-muted">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{t(c.labelKey as never)}</span>
              {c.loading ? (
                <span
                  data-testid={`skeleton-${c.labelKey}`}
                  className="h-5 w-8 shrink-0 animate-pulse rounded bg-muted"
                />
              ) : c.count != null ? (
                <span
                  data-testid={`count-${c.labelKey}`}
                  className="shrink-0 rounded bg-muted px-2 py-0.5 text-sm tabular-nums"
                >
                  {c.count}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(`cards.${c.labelKey}` as never)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

```bash
pnpm test -- src/tests/dashboard-overview.test.tsx src/tests/admin-placeholder.test.tsx
```

Ожидается: PASS, 6 кейсов.

- [ ] **Step 5: Прогнать весь сьют и типы**

```bash
pnpm test && pnpm exec tsc --noEmit
```

Ожидается: обе команды успешны.

- [ ] **Step 6: Коммит**

```bash
git add -A "src/app/[locale]/(dashboard)/dashboard/page.tsx" src/tests && git commit -m "feat(dashboard): implement overview page with profile card and section counters"
```

---

### Task 6: Страница профиля `/dashboard/profile`

**Files:**
- Create: `src/lib/validation/profile-schemas.ts`
- Create: `src/app/[locale]/(dashboard)/dashboard/profile/page.tsx`
- Test: `src/tests/profile-page.test.tsx`

**Interfaces:**
- Consumes: `updateProfile`, `uploadAvatar` (Task 3); `ProfileUpdate`, `UserProfile` (Task 2); `Input`, `Textarea`, `Button`, `Card` из `@/components/ui/*`.
- Produces:
  - `profileSchema` — zod-схема, `ProfileInput = z.infer<typeof profileSchema>`
  - `toProfileUpdate(input: ProfileInput): ProfileUpdate` — пустые строки → `null`
  - `MAX_AVATAR_BYTES = 5 * 1024 * 1024`
  - страница `/dashboard/profile`

- [ ] **Step 1: Написать падающий тест страницы профиля**

Создать `src/tests/profile-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import ProfilePage from "@/app/[locale]/(dashboard)/dashboard/profile/page";
import { profileSchema, toProfileUpdate } from "@/lib/validation/profile-schemas";
import ru from "@/messages/ru.json";
import type { UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard/profile",
}));

const putBodies: unknown[] = [];
let avatarUploadCalls = 0;
let putFailsWithViolation = false;
const server = setupServer(
  http.put("*/api/proxy/users/me", async ({ request }) => {
    putBodies.push(await request.json());
    if (putFailsWithViolation) {
      return HttpResponse.json(
        { status: 400, title: "Validation failed", detail: "bad", violations: [{ field: "phone", message: "Слишком длинный телефон" }] },
        { status: 400 },
      );
    }
    return HttpResponse.json({ id: "u1", email: "a@b.co", role: "BUYER" });
  }),
  http.post("*/api/proxy/users/me/avatar", () => {
    avatarUploadCalls += 1;
    return HttpResponse.json({ id: "u1", avatarUrl: "/a.png" });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { putBodies.length = 0; avatarUploadCalls = 0; putFailsWithViolation = false; server.resetHandlers(); });
afterAll(() => server.close());

const base: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: "Иван", lastName: "Петров", phone: "+79990000000", avatarUrl: null,
  bio: "О себе", country: "Россия", city: "Самара", address: "ул. Ленина, 1",
  latitude: null, longitude: null, rating: null, totalReviews: null,
  createdAt: "t", updatedAt: "t",
};

const renderPage = (user: UserProfile = base) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <ProfilePage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("toProfileUpdate", () => {
  it("turns blank strings into null", () => {
    const parsed = profileSchema.parse({ firstName: "", lastName: "Петров", phone: "  ", bio: "", country: "", city: "", address: "" });
    expect(toProfileUpdate(parsed)).toEqual({
      firstName: null, lastName: "Петров", phone: null, bio: null, country: null, city: null, address: null,
    });
  });
  it("rejects an over-long phone", () => {
    expect(profileSchema.safeParse({ phone: "x".repeat(21) }).success).toBe(false);
  });
});

describe("Profile page", () => {
  it("prefills the form from the session", () => {
    renderPage();
    expect(screen.getByLabelText("Имя")).toHaveValue("Иван");
    expect(screen.getByLabelText("Фамилия")).toHaveValue("Петров");
    expect(screen.getByLabelText("Город")).toHaveValue("Самара");
  });

  it("submits the whole profile, sending blanks as null", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.clear(screen.getByLabelText("Адрес"));
    await u.clear(screen.getByLabelText("Имя"));
    await u.type(screen.getByLabelText("Имя"), "Пётр");
    await u.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toEqual({
      firstName: "Пётр", lastName: "Петров", phone: "+79990000000",
      bio: "О себе", country: "Россия", city: "Самара", address: null,
    });
  });

  it("maps server violations onto their fields", async () => {
    putFailsWithViolation = true;
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Слишком длинный телефон")).toBeInTheDocument();
  });

  it("refuses an avatar larger than 5 MB without calling the API", async () => {
    const u = userEvent.setup();
    renderPage();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await u.upload(screen.getByLabelText("Аватар"), big);
    expect(await screen.findByText("Файл больше 5 МБ")).toBeInTheDocument();
    expect(avatarUploadCalls).toBe(0);
  });
});
```

Отступление от исходного плана (обнаружено при реализации): исходная версия этого теста проверяла только текст ошибки. Файл всё равно проходит по маске `accept="image/*"` и совпадает с зарегистрированным MSW-хендлером, так что регрессия, которая пропускала бы загрузку на сервер несмотря на превышение лимита, прошла бы этот тест незамеченной. Добавлен счётчик `avatarUploadCalls` (инкрементируется в хендлере `http.post("*/api/proxy/users/me/avatar", ...)`, сбрасывается в `afterEach`) и утверждение `expect(avatarUploadCalls).toBe(0)`, чтобы тест ловил именно эту регрессию.

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

```bash
pnpm test -- src/tests/profile-page.test.tsx
```

Ожидается: FAIL с `Failed to resolve import "@/lib/validation/profile-schemas"`.

- [ ] **Step 3: Написать схему валидации**

Создать `src/lib/validation/profile-schemas.ts`:

```ts
import { z } from "zod";
import type { ProfileUpdate } from "@/types/api";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Ограничения зеркалят Bean Validation в ProfileUpdateRequest на бэкенде.
const optional = (max: number) => z.string().max(max).optional();

export const profileSchema = z.object({
  firstName: optional(100),
  lastName: optional(100),
  phone: optional(20),
  bio: optional(2000),
  country: optional(100),
  city: optional(100),
  address: optional(255),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Пустая (в т. ч. состоящая из пробелов) строка означает «поле не задано» → null. */
export function toProfileUpdate(input: ProfileInput): ProfileUpdate {
  const v = (s?: string): string | null => (s != null && s.trim() !== "" ? s : null);
  return {
    firstName: v(input.firstName),
    lastName: v(input.lastName),
    phone: v(input.phone),
    bio: v(input.bio),
    country: v(input.country),
    city: v(input.city),
    address: v(input.address),
  };
}
```

- [ ] **Step 4: Написать страницу профиля**

Создать `src/app/[locale]/(dashboard)/dashboard/profile/page.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/components/auth/useSession";
import { updateProfile, uploadAvatar } from "@/lib/api/endpoints/profile";
import { profileSchema, toProfileUpdate, MAX_AVATAR_BYTES, type ProfileInput } from "@/lib/validation/profile-schemas";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const FIELDS = ["firstName", "lastName", "phone", "country", "city", "address"] as const;

export default function ProfilePage() {
  const t = useTranslations("Dashboard.profilePage");
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    // `values` (а не defaultValues) перезаполняет форму, когда сессия догрузится;
    // `keepDirtyValues` не даёт этому перезаполнению затереть поля, которые
    // пользователь уже успел отредактировать, но ещё не отправил.
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      bio: user?.bio ?? "",
      country: user?.country ?? "",
      city: user?.city ?? "",
      address: user?.address ?? "",
    },
    resetOptions: { keepDirtyValues: true },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      toast.success(t("avatarSaved"));
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e) => toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" })),
  });

  const onSubmit = async (data: ProfileInput) => {
    try {
      await updateProfile(toProfileUpdate(data));
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["session"] });
    } catch (e) {
      if (e instanceof ApiError && e.violations.length) {
        for (const v of e.violations) setError(v.field as keyof ProfileInput, { message: v.message });
      } else {
        toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" }));
      }
    }
  };

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      // Бэкенд отклонит такой файл сам, но проверяем локально, чтобы не гонять его по сети.
      setAvatarError(t("avatarTooLarge"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setAvatarError(null);
    avatarMutation.mutate(file);
  };

  if (!user) return null;

  const initials = (
    (user.firstName ?? user.email ?? "?").slice(0, 1) + (user.lastName ?? "").slice(0, 1)
  ).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-medium">{t("avatarTitle")}</h2>
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
              {initials}
            </span>
          )}
          <label className="block text-sm">
            <span className="sr-only">{t("avatarTitle")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label={t("avatarTitle")}
              disabled={avatarMutation.isPending}
              onChange={(e) => onPickAvatar(e.target.files?.[0])}
              className="block text-sm"
            />
          </label>
        </div>
        {avatarError && <p className="text-sm text-destructive">{avatarError}</p>}
      </Card>

      <Card className="p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f} className="block space-y-1">
                <span className="text-sm">{t(f)}</span>
                <Input id={`profile-${f}`} aria-label={t(f)} {...register(f)} />
                {errors[f] && <span className="text-xs text-destructive">{errors[f]?.message}</span>}
              </label>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-sm">{t("bio")}</span>
            <Textarea rows={5} aria-label={t("bio")} {...register("bio")} />
            {errors.bio && <span className="text-xs text-destructive">{errors.bio.message}</span>}
          </label>
          <Button type="submit" disabled={isSubmitting}>{t("save")}</Button>
        </form>
      </Card>
    </div>
  );
}
```

Отступление от исходного плана (обнаружено при реализации): исходная версия `useForm` не передавала `resetOptions: { keepDirtyValues: true }`. Без этой опции react-hook-form's `values` при изменении объекта сессии вызывает внутренний `_reset` и стирает правки, которые пользователь уже набрал в форме, но ещё не отправил (см. тест `"keeps an in-progress edit when the session refetch resolves with different data"` в Task 6 Step 1).

- [ ] **Step 5: Запустить тест и убедиться, что он проходит**

```bash
pnpm test -- src/tests/profile-page.test.tsx
```

Ожидается: PASS, 6 кейсов. Если `getByLabelText` не находит поле, проверить, что у `Input`/`Textarea` проброшен `aria-label` (компоненты в `@/components/ui/*` пробрасывают `...props`).

- [ ] **Step 6: Прогнать весь сьют, типы и сборку**

```bash
pnpm test && pnpm exec tsc --noEmit && pnpm build
```

Ожидается: всё успешно; в выводе `next build` появляется маршрут `/[locale]/dashboard/profile`.

- [ ] **Step 7: Коммит**

```bash
git add src/lib/validation/profile-schemas.ts "src/app/[locale]/(dashboard)/dashboard/profile/page.tsx" src/tests/profile-page.test.tsx && git commit -m "feat(dashboard): implement profile page with avatar upload and details form"
```

---

### Task 7: Страница подписок `/dashboard/subscriptions`

**Files:**
- Create: `src/lib/subscriptions/filters.ts`
- Modify: `src/components/catalog/FiltersPanel.tsx` (добавить проп `showSort`)
- Create: `src/app/[locale]/(dashboard)/dashboard/subscriptions/page.tsx`
- Test: `src/tests/subscription-filters.test.ts`
- Test: `src/tests/subscriptions-page.test.tsx`

**Interfaces:**
- Consumes: `listSubscriptions`, `createSubscription`, `deleteSubscription` (Task 3); `getCategories`, `getBreeds` из `@/lib/api/endpoints/catalog`; `FiltersPanel`, `CatalogFilters`; `Dialog*` из `@/components/ui/dialog`; ключи `Dashboard.subscriptionsPage.*` (Task 2).
- Produces (все из `src/lib/subscriptions/filters.ts`):
  - `type Translate = (key: string, values?: Record<string, string | number>) => string`
  - `interface DescribeDeps { t: Translate; genderLabel: (g: ListingGender) => string; categoryName: string | null; breedName: string | null }`
  - `describeSubscription(f: SubscriptionFilters, d: DescribeDeps): string[]`
  - `subscriptionToCatalogQuery(f: SubscriptionFilters): string` — путь вида `/catalog?...`
  - `filtersToSubscriptionCreate(f: ListingSearchParams): SubscriptionCreate`
  - `hasAnyFilter(c: SubscriptionCreate): boolean`
- Produces (компонент): `FiltersPanel` получает необязательный проп `showSort?: boolean` со значением по умолчанию `true`.

Отступление от спека: спек утверждал, что `FiltersPanel` переиспользуется «без правок», но панель рендерит селект сортировки, которому в диалоге создания подписки не место. Добавляем обратносовместимый проп `showSort` — поведение каталога не меняется.

`hasVaccination`/`hasDocuments` в `subscriptionToCatalogQuery` не переносятся: страница каталога таких query-параметров не читает.

- [ ] **Step 1: Написать падающий тест чистых функций**

Создать `src/tests/subscription-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  describeSubscription, subscriptionToCatalogQuery, filtersToSubscriptionCreate, hasAnyFilter,
} from "@/lib/subscriptions/filters";
import type { SubscriptionFilters } from "@/types/api";

const empty: SubscriptionFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
};

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(",")})` : key;
const deps = { t, genderLabel: (g: string) => `gender:${g}`, categoryName: null, breedName: null };

describe("describeSubscription", () => {
  it("returns an empty list when nothing is set", () => {
    expect(describeSubscription(empty, deps)).toEqual([]);
  });

  it("uses resolved category and breed names", () => {
    const f = { ...empty, categoryId: "c1", breedId: "b1" };
    expect(describeSubscription(f, { ...deps, categoryName: "Собаки", breedName: "Лабрадор" }))
      .toEqual(["Собаки", "Лабрадор"]);
  });

  it("falls back to a placeholder when a name is not resolved", () => {
    expect(describeSubscription({ ...empty, categoryId: "c1" }, deps)).toEqual(["unknownRef"]);
  });

  it("renders city, price range, age range, gender and flags", () => {
    const f: SubscriptionFilters = {
      ...empty, city: "Самара", minPrice: "100", maxPrice: "900",
      gender: "MALE", minAge: 2, maxAge: null, hasVaccination: true, hasDocuments: true,
    };
    expect(describeSubscription(f, deps)).toEqual([
      "filterCity(Самара)",
      "filterPrice(rangeBetween(100,900))",
      "gender:MALE",
      "filterAge(rangeFrom(2))",
      "filterVaccination",
      "filterDocuments",
    ]);
  });

  it("renders one-sided ranges", () => {
    expect(describeSubscription({ ...empty, maxPrice: "500" }, deps)).toEqual(["filterPrice(rangeTo(500))"]);
  });

  it("skips flags that are false", () => {
    expect(describeSubscription({ ...empty, hasVaccination: false }, deps)).toEqual([]);
  });
});

describe("subscriptionToCatalogQuery", () => {
  it("returns a bare catalog path when nothing is set", () => {
    expect(subscriptionToCatalogQuery(empty)).toBe("/catalog");
  });

  it("maps every catalog-supported filter", () => {
    const f: SubscriptionFilters = {
      ...empty, categoryId: "c1", breedId: "b1", city: "Самара",
      minPrice: "100", maxPrice: "900", gender: "FEMALE", minAge: 1, maxAge: 12,
      hasVaccination: true, hasDocuments: true,
    };
    const url = new URL(subscriptionToCatalogQuery(f), "http://t");
    expect(url.pathname).toBe("/catalog");
    expect(url.searchParams.get("categoryId")).toBe("c1");
    expect(url.searchParams.get("breedId")).toBe("b1");
    expect(url.searchParams.get("city")).toBe("Самара");
    expect(url.searchParams.get("minPrice")).toBe("100");
    expect(url.searchParams.get("maxPrice")).toBe("900");
    expect(url.searchParams.get("gender")).toBe("FEMALE");
    expect(url.searchParams.get("minAge")).toBe("1");
    expect(url.searchParams.get("maxAge")).toBe("12");
    // каталог не читает эти параметры — они намеренно не переносятся
    expect(url.searchParams.get("hasVaccination")).toBeNull();
    expect(url.searchParams.get("hasDocuments")).toBeNull();
  });
});

describe("filtersToSubscriptionCreate", () => {
  it("drops sorting and pagination", () => {
    const body = filtersToSubscriptionCreate({
      categoryId: "c1", city: "Самара", minPrice: 100,
      sortBy: "price", sortDirection: "ASC", page: 3, size: 12,
    });
    expect(body).toEqual({
      categoryId: "c1", breedId: null, city: "Самара", minPrice: 100, maxPrice: null,
      gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
    });
  });
});

describe("hasAnyFilter", () => {
  it("is false for an all-null body", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ sortBy: "price", page: 2, size: 12 }))).toBe(false);
  });
  it("is false when only a blank city is set", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ city: "" }))).toBe(false);
  });
  it("is true when at least one filter is set", () => {
    expect(hasAnyFilter(filtersToSubscriptionCreate({ minAge: 0 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

```bash
pnpm test -- src/tests/subscription-filters.test.ts
```

Ожидается: FAIL с `Failed to resolve import "@/lib/subscriptions/filters"`.

- [ ] **Step 3: Написать модуль чистых функций**

Создать `src/lib/subscriptions/filters.ts`:

```ts
import type { ListingGender, ListingSearchParams, SubscriptionCreate, SubscriptionFilters } from "@/types/api";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface DescribeDeps {
  /** Переводчик секции Dashboard.subscriptionsPage. */
  t: Translate;
  /** Переводчик пола живёт в другой секции (Status.*), поэтому приходит отдельно. */
  genderLabel: (g: ListingGender) => string;
  categoryName: string | null;
  breedName: string | null;
}

/**
 * BigDecimal приезжает с бэкенда числом, а в типах помечен как Money = string,
 * поэтому приводим значение к строке явно вместо того, чтобы полагаться на тип.
 */
function range(t: Translate, min: unknown, max: unknown): string {
  if (min != null && max != null) return t("rangeBetween", { min: String(min), max: String(max) });
  if (min != null) return t("rangeFrom", { min: String(min) });
  return t("rangeTo", { max: String(max) });
}

export function describeSubscription(f: SubscriptionFilters, d: DescribeDeps): string[] {
  const parts: string[] = [];
  if (f.categoryId) parts.push(d.categoryName ?? d.t("unknownRef"));
  if (f.breedId) parts.push(d.breedName ?? d.t("unknownRef"));
  if (f.city) parts.push(d.t("filterCity", { value: f.city }));
  if (f.minPrice != null || f.maxPrice != null) {
    parts.push(d.t("filterPrice", { value: range(d.t, f.minPrice, f.maxPrice) }));
  }
  if (f.gender) parts.push(d.genderLabel(f.gender));
  if (f.minAge != null || f.maxAge != null) {
    parts.push(d.t("filterAge", { value: range(d.t, f.minAge, f.maxAge) }));
  }
  if (f.hasVaccination) parts.push(d.t("filterVaccination"));
  if (f.hasDocuments) parts.push(d.t("filterDocuments"));
  return parts;
}

/**
 * Собирает ссылку на каталог. hasVaccination/hasDocuments опущены намеренно:
 * страница каталога такие query-параметры не читает.
 */
export function subscriptionToCatalogQuery(f: SubscriptionFilters): string {
  const sp = new URLSearchParams();
  if (f.categoryId) sp.set("categoryId", f.categoryId);
  if (f.breedId) sp.set("breedId", f.breedId);
  if (f.city) sp.set("city", f.city);
  if (f.minPrice != null) sp.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) sp.set("maxPrice", String(f.maxPrice));
  if (f.gender) sp.set("gender", f.gender);
  if (f.minAge != null) sp.set("minAge", String(f.minAge));
  if (f.maxAge != null) sp.set("maxAge", String(f.maxAge));
  const q = sp.toString();
  return q ? `/catalog?${q}` : "/catalog";
}

/** Отбрасывает sortBy/sortDirection/page/size — бэкенд их в подписке не принимает. */
export function filtersToSubscriptionCreate(f: ListingSearchParams): SubscriptionCreate {
  return {
    categoryId: f.categoryId ?? null,
    breedId: f.breedId ?? null,
    city: f.city && f.city.trim() !== "" ? f.city : null,
    minPrice: f.minPrice ?? null,
    maxPrice: f.maxPrice ?? null,
    gender: f.gender ?? null,
    minAge: f.minAge ?? null,
    maxAge: f.maxAge ?? null,
    hasVaccination: null,
    hasDocuments: null,
  };
}

export function hasAnyFilter(c: SubscriptionCreate): boolean {
  return Object.values(c).some((v) => v !== null && v !== undefined && v !== "");
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

```bash
pnpm test -- src/tests/subscription-filters.test.ts
```

Ожидается: PASS, 12 кейсов.

- [ ] **Step 5: Коммит чистых функций**

```bash
git add src/lib/subscriptions/filters.ts src/tests/subscription-filters.test.ts && git commit -m "feat(subscriptions): add filter description, catalog link and payload helpers"
```

- [ ] **Step 6: Написать падающий тест страницы подписок**

Создать `src/tests/subscriptions-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionContext } from "@/components/auth/SessionProvider";
import SubscriptionsPage from "@/app/[locale]/(dashboard)/dashboard/subscriptions/page";
import ru from "@/messages/ru.json";
import type { Subscription, SubscriptionFilters, UserProfile } from "@/types/api";

vi.mock("@/i18n", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/dashboard/subscriptions",
}));

const emptyFilters: SubscriptionFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null, hasVaccination: null, hasDocuments: null,
};

let items: Subscription[] = [];
const createdBodies: unknown[] = [];
const deletedIds: string[] = [];

const server = setupServer(
  http.get("*/api/proxy/categories", () =>
    HttpResponse.json([{ id: "c1", name: "Собаки", slug: "dogs", children: [], breeds: [] }]),
  ),
  http.get("*/api/proxy/categories/:id/breeds", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Собаки", slug: "dogs", breeds: [{ id: "b1", name: "Лабрадор" }] }),
  ),
  http.get("*/api/proxy/subscriptions", () => HttpResponse.json(items)),
  http.post("*/api/proxy/subscriptions", async ({ request }) => {
    createdBodies.push(await request.json());
    return HttpResponse.json({ id: "new", filters: emptyFilters, active: true, createdAt: "2026-02-01T00:00:00Z" });
  }),
  http.delete("*/api/proxy/subscriptions/:id", ({ params }) => {
    deletedIds.push(String(params.id));
    items = [];
    return new HttpResponse(null, { status: 204 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { items = []; createdBodies.length = 0; deletedIds.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const user: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="ru" messages={ru}>
        <SessionContext.Provider value={{ user, status: "authenticated" }}>
          <SubscriptionsPage />
        </SessionContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

describe("Subscriptions page", () => {
  it("shows the empty state when there are no subscriptions", async () => {
    renderPage();
    expect(await screen.findByText("Сохранённых поисков пока нет")).toBeInTheDocument();
  });

  it("describes stored filters and links to the catalog", async () => {
    items = [{
      id: "s1",
      filters: { ...emptyFilters, categoryId: "c1", city: "Самара", minPrice: "100", maxPrice: "900" },
      active: true,
      createdAt: "2026-02-01T00:00:00Z",
    }];
    renderPage();
    expect(await screen.findByText(/Собаки/)).toBeInTheDocument();
    expect(screen.getByText(/Город: Самара/)).toBeInTheDocument();
    expect(screen.getByText(/Цена: 100 — 900/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Открыть в каталоге" });
    expect(link.getAttribute("href")).toContain("categoryId=c1");
    expect(link.getAttribute("href")).toContain("city=%D0%A1%D0%B0%D0%BC%D0%B0%D1%80%D0%B0");
  });

  it("creates a subscription from the dialog once a filter is set", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole("button", { name: "Новая подписка" }));
    const submit = await screen.findByRole("button", { name: "Сохранить" });
    expect(submit).toBeDisabled();
    await u.type(screen.getByLabelText("Город"), "Самара");
    await waitFor(() => expect(submit).toBeEnabled());
    await u.click(submit);
    await waitFor(() => expect(createdBodies).toHaveLength(1));
    expect(createdBodies[0]).toMatchObject({ city: "Самара" });
    expect(createdBodies[0]).not.toHaveProperty("sortBy");
    expect(createdBodies[0]).not.toHaveProperty("page");
  });

  it("deletes only after confirmation", async () => {
    items = [{ id: "s1", filters: { ...emptyFilters, city: "Самара" }, active: true, createdAt: "2026-02-01T00:00:00Z" }];
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole("button", { name: "Удалить" }));
    expect(await screen.findByText("Удалить подписку?")).toBeInTheDocument();
    expect(deletedIds).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    await u.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(deletedIds).toEqual(["s1"]));
  });
});
```

- [ ] **Step 7: Запустить тест и убедиться, что он падает**

```bash
pnpm test -- src/tests/subscriptions-page.test.tsx
```

Ожидается: FAIL с `Failed to resolve import "@/app/[locale]/(dashboard)/dashboard/subscriptions/page"`.

- [ ] **Step 8: Добавить проп `showSort` в FiltersPanel**

В `src/components/catalog/FiltersPanel.tsx` заменить сигнатуру компонента:

```tsx
export function FiltersPanel({ filters, onChange, onReset, showSort = true }: {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  onReset: () => void;
  /** В диалоге создания подписки сортировка не нужна — она не входит в подписку. */
  showSort?: boolean;
}) {
```

и обернуть блок сортировки (последний `<div className="space-y-1">` перед кнопкой сброса):

```tsx
      {showSort && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("sortBy")}</label>
          <Select aria-label={t("sortBy")} value={sortValue} className="h-9 w-full"
            onChange={(e) => {
              const s = SORTS.find((x) => x.value === e.target.value);
              if (s) set({ sortBy: s.sortBy, sortDirection: s.sortDirection });
            }}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey as never)}</option>)}
          </Select>
        </div>
      )}
```

- [ ] **Step 9: Написать страницу подписок**

Создать `src/app/[locale]/(dashboard)/dashboard/subscriptions/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n";
import { listSubscriptions, createSubscription, deleteSubscription } from "@/lib/api/endpoints/subscriptions";
import { getCategories, getBreeds } from "@/lib/api/endpoints/catalog";
import { FiltersPanel, type CatalogFilters } from "@/components/catalog/FiltersPanel";
import {
  describeSubscription, subscriptionToCatalogQuery, filtersToSubscriptionCreate, hasAnyFilter,
  type Translate,
} from "@/lib/subscriptions/filters";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/errors";
import type { Category, ListingGender, Subscription } from "@/types/api";
import type { Locale } from "@/lib/i18n/config";

const EMPTY_FILTERS: CatalogFilters = {
  categoryId: null, breedId: null, city: null, minPrice: null, maxPrice: null,
  gender: null, minAge: null, maxAge: null,
};

/** Плоский список категорий: дерево может быть вложенным. */
function flatten(categories: Category[]): Category[] {
  return categories.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

export default function SubscriptionsPage() {
  const t = useTranslations("Dashboard.subscriptionsPage");
  const tStatus = useTranslations("Status");
  const locale = useLocale() as Locale;
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilters>({ ...EMPTY_FILTERS });
  const [pendingDelete, setPendingDelete] = useState<Subscription | null>(null);

  const subs = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => listSubscriptions(),
  });
  const categories = useQuery<Category[]>({
    queryKey: ["catalog", "categories", locale],
    queryFn: () => getCategories(locale),
  });

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of flatten(categories.data ?? [])) map.set(c.id, c.name);
    return map;
  }, [categories.data]);

  // Породы нужны только для тех категорий, которые реально встречаются в подписках.
  const breedCategoryIds = useMemo(
    () => Array.from(new Set((subs.data ?? []).map((s) => s.filters.categoryId).filter((id): id is string => !!id))),
    [subs.data],
  );
  const breedQueries = useQuery({
    queryKey: ["subscriptions", "breeds", breedCategoryIds, locale],
    enabled: breedCategoryIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const pages = await Promise.all(breedCategoryIds.map((id) => getBreeds(id, locale).catch(() => null)));
      for (const p of pages) for (const b of p?.breeds ?? []) map.set(b.id, b.name);
      return map;
    },
  });

  const onApiError = (e: unknown) => toast.error(t("error", { detail: e instanceof ApiError ? e.detail : "—" }));

  const createMutation = useMutation({
    mutationFn: () => createSubscription(filtersToSubscriptionCreate(draft)),
    onSuccess: () => {
      toast.success(t("created"));
      setCreateOpen(false);
      setDraft({ ...EMPTY_FILTERS });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: onApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubscription(id),
    onSuccess: () => {
      toast.success(t("deleted"));
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: onApiError,
  });

  const canSubmit = hasAnyFilter(filtersToSubscriptionCreate(draft));
  const genderLabel = (g: ListingGender) => tStatus(g as never);
  // next-intl типизирует ключ узким литеральным объединением, а Translate принимает
  // любую строку — приводим явно, как это уже делает StatusBadge через `as never`.
  const describeT = t as unknown as Translate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("create")}</Button>
      </div>

      {subs.isError ? (
        <EmptyState>
          <div className="space-y-2">
            <div>{t("loadError")}</div>
            <Button variant="outline" size="sm" onClick={() => subs.refetch()}>{t("retry")}</Button>
          </div>
        </EmptyState>
      ) : subs.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : (subs.data ?? []).length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(subs.data ?? []).map((s) => {
            const parts = describeSubscription(s.filters, {
              t: describeT,
              genderLabel,
              categoryName: s.filters.categoryId ? categoryNames.get(s.filters.categoryId) ?? null : null,
              breedName: s.filters.breedId ? breedQueries.data?.get(s.filters.breedId) ?? null : null,
            });
            return (
              <li key={s.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm">{parts.join(" · ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("createdAt", { date: new Date(s.createdAt).toLocaleDateString(locale) })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={subscriptionToCatalogQuery(s.filters)} className="text-sm underline">
                      {t("openInCatalog")}
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => setPendingDelete(s)}>{t("delete")}</Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("needFilter")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <FiltersPanel
              filters={draft}
              onChange={(f) => setDraft(f)}
              onReset={() => setDraft({ ...EMPTY_FILTERS })}
              showSort={false}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {t("createSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 10: Запустить тест и убедиться, что он проходит**

```bash
pnpm test -- src/tests/subscriptions-page.test.tsx
```

Ожидается: PASS, 4 кейса. Если вариант `destructive` у `Button` отсутствует, посмотреть доступные варианты в `src/components/ui/button.tsx` и подставить существующий.

- [ ] **Step 11: Прогнать сьют каталога — проп `showSort` не должен ничего сломать**

```bash
pnpm test -- src/tests/catalog-components.test.tsx src/tests/catalog-page.test.tsx
```

Ожидается: PASS без изменений — по умолчанию `showSort` равен `true`.

- [ ] **Step 12: Коммит**

```bash
git add "src/app/[locale]/(dashboard)/dashboard/subscriptions/page.tsx" src/components/catalog/FiltersPanel.tsx src/tests/subscriptions-page.test.tsx && git commit -m "feat(dashboard): implement subscriptions page with create dialog and delete confirmation"
```

---

### Task 8: Кнопка «Сохранить поиск» на `/catalog`

**Files:**
- Modify: `src/app/[locale]/catalog/page.tsx`
- Test: `src/tests/catalog-page.test.tsx`

**Interfaces:**
- Consumes: `createSubscription` (Task 3); `filtersToSubscriptionCreate`, `hasAnyFilter` (Task 7); `useSession`; ключи `Catalog.saveSearch*` (Task 2).
- Produces: изменений в публичном API нет.

- [ ] **Step 1: Дописать падающие кейсы в тест каталога**

Открыть `src/tests/catalog-page.test.tsx`. Файл уже поднимает MSW через `setupServer()` без глобальных обработчиков (каждый тест регистрирует свои через `server.use`), а `renderPage()` жёстко подставляет `user: null`. Нужны три правки.

Первая — добавить тип `UserProfile` в импорты:

```tsx
import type { UserProfile } from "@/types/api";
```

Вторая — сделать `renderPage` параметризуемым по сессии (существующие вызовы `renderPage()` продолжат работать благодаря значению по умолчанию), заменив блок:

```tsx
const mkQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderPage = (user: UserProfile | null = null) => render(
  <QueryClientProvider client={mkQc()}>
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SessionContext.Provider value={{ user, status: user ? "authenticated" : "unauthenticated" }}>
        <CatalogPage />
      </SessionContext.Provider>
    </NextIntlClientProvider>
  </QueryClientProvider>,
);

const authedUser: UserProfile = {
  id: "u1", email: "a@b.co", role: "BUYER", verified: true, active: true,
  firstName: null, lastName: null, phone: null, avatarUrl: null, bio: null,
  country: null, city: null, address: null, latitude: null, longitude: null,
  rating: null, totalReviews: null, createdAt: "t", updatedAt: "t",
};
```

Третья — добавить в конец файла новый блок:

```tsx
describe("Catalog save search", () => {
  const listingsAndCategories = () => {
    server.use(
      http.get("*/api/proxy/categories", () => HttpResponse.json([])),
      http.get("*/api/proxy/listings", () => HttpResponse.json(page([listing("l1", "Kitten")]))),
    );
  };

  it("hides the button for anonymous visitors", async () => {
    listingsAndCategories();
    renderPage();
    await screen.findByText("Kitten");
    expect(screen.queryByRole("button", { name: ru.Catalog.saveSearch })).not.toBeInTheDocument();
  });

  it("is disabled until at least one filter is set", async () => {
    listingsAndCategories();
    renderPage(authedUser);
    await screen.findByText("Kitten");
    expect(screen.getByRole("button", { name: ru.Catalog.saveSearch })).toBeDisabled();
  });

  it("posts the current filters without sorting or pagination", async () => {
    const savedSearches: unknown[] = [];
    listingsAndCategories();
    server.use(
      http.post("*/api/proxy/subscriptions", async ({ request }) => {
        savedSearches.push(await request.json());
        return HttpResponse.json({ id: "s1", filters: {}, active: true, createdAt: "2026-02-01T00:00:00Z" });
      }),
    );
    const user = userEvent.setup();
    renderPage(authedUser);
    await screen.findByText("Kitten");
    await user.type(screen.getByLabelText(ru.Catalog.city), "Самара");
    const btn = screen.getByRole("button", { name: ru.Catalog.saveSearch });
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    await waitFor(() => expect(savedSearches).toHaveLength(1));
    expect(savedSearches[0]).toMatchObject({ city: "Самара" });
    expect(savedSearches[0]).not.toHaveProperty("sortBy");
    expect(savedSearches[0]).not.toHaveProperty("page");
    expect(savedSearches[0]).not.toHaveProperty("size");
  });
});
```

Кнопка становится активной не сразу: страница дебаунсит `city` на 300 мс, а `saveBody` считается от дебаунсенного `params` — поэтому `waitFor(() => expect(btn).toBeEnabled())` обязателен.

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

```bash
pnpm test -- src/tests/catalog-page.test.tsx
```

Ожидается: FAIL — кнопка «Сохранить поиск» не найдена.

- [ ] **Step 3: Добавить кнопку на страницу каталога**

В `src/app/[locale]/catalog/page.tsx` дописать импорты:

```tsx
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/components/auth/useSession";
import { createSubscription } from "@/lib/api/endpoints/subscriptions";
import { filtersToSubscriptionCreate, hasAnyFilter } from "@/lib/subscriptions/filters";
import { ApiError } from "@/lib/api/errors";
```

Внутри `CatalogPage`, после объявления `params`, добавить:

```tsx
  const { user } = useSession();
  const saveBody = useMemo(() => filtersToSubscriptionCreate(params), [params]);
  const saveSearch = useMutation({
    mutationFn: () => createSubscription(saveBody),
    onSuccess: () => toast.success(t("saveSearchDone")),
    onError: (e) => toast.error(t("saveSearchError", { detail: e instanceof ApiError ? e.detail : "—" })),
  });
```

И заменить блок с `FiltersPanel` в разметке:

```tsx
        <div className="space-y-2">
          <FiltersPanel filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} onReset={onReset} />
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!hasAnyFilter(saveBody) || saveSearch.isPending}
              onClick={() => saveSearch.mutate()}
            >
              {t("saveSearch")}
            </Button>
          )}
        </div>
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

```bash
pnpm test -- src/tests/catalog-page.test.tsx
```

Ожидается: PASS, включая три новых кейса.

- [ ] **Step 5: Коммит**

```bash
git add "src/app/[locale]/catalog/page.tsx" src/tests/catalog-page.test.tsx && git commit -m "feat(catalog): add Save search button that stores current filters as a subscription"
```

---

### Task 9: E2E-сценарий кабинета и финальная проверка

**Files:**
- Create: `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: работающий стенд (`docker-compose up -d && gradle bootRun` в бэкенде, `pnpm dev` во фронтенде — Playwright поднимет dev-сервер сам) и демо-аккаунт `buyer@demo.local` / `Demo12345`.
- Produces: ничего для других задач.

- [ ] **Step 1: Написать e2e-сценарий**

Создать `e2e/dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/ru/login");
  await page.getByLabel("Email").fill("buyer@demo.local");
  await page.locator('input[type="password"]').fill("Demo12345");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/ru/dashboard");
}

test("dashboard navigation reaches profile and subscriptions", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("buyer@demo.local");

  await page.getByRole("link", { name: "Профиль" }).first().click();
  await page.waitForURL("**/ru/dashboard/profile");
  await expect(page.getByLabel("Имя")).toBeVisible();

  await page.getByRole("link", { name: "Подписки" }).first().click();
  await page.waitForURL("**/ru/dashboard/subscriptions");
  await expect(page.getByRole("button", { name: "Новая подписка" })).toBeVisible();
});

test("profile changes persist across a reload", async ({ page }) => {
  await login(page);
  await page.goto("/ru/dashboard/profile");
  const city = page.getByLabel("Город");
  const value = `Самара-${Date.now() % 100000}`;
  await city.fill(value);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Профиль сохранён")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Город")).toHaveValue(value);
});
```

Селектор поля пароля взят по `input[type="password"]`, потому что в форме входа поле подписано текстовым `<span>`, а не связанным `<label for>`.

- [ ] **Step 2: Поднять стенд и прогнать e2e**

В бэкенде (отдельный терминал):

```bash
cd /Users/vvnovg/pet-marketplace && docker-compose up -d && gradle bootRun
```

Во фронтенде:

```bash
pnpm exec playwright test e2e/dashboard.spec.ts
```

Ожидается: 2 passed. Если логин не проходит, проверить, что демо-данные засеяны (`docker compose down -v && docker compose up -d --build` пересоздаёт базу с сидом).

- [ ] **Step 3: Прогнать полный гейт**

Фронтенд:

```bash
pnpm test && pnpm exec tsc --noEmit && pnpm build && pnpm exec playwright test
```

Бэкенд:

```bash
cd /Users/vvnovg/pet-marketplace && gradle test
```

Ожидается: все четыре фронтенд-команды и `gradle test` успешны. Ни одну из них не пропускать: заявлять готовность можно только после того, как вывод каждой команды увиден.

- [ ] **Step 4: Коммит**

```bash
cd /Users/vvnovg/pet-marketplace-front && git add e2e/dashboard.spec.ts && git commit -m "test(e2e): dashboard navigation and profile persistence"
```

- [ ] **Step 5: Обновить документацию проекта**

В `/Users/vvnovg/pet-marketplace-front/CLAUDE.md` в раздел, описывающий слои фич, добавить абзац:

```markdown
### Личный кабинет

Route-группа `src/app/[locale]/(dashboard)` имеет собственный клиентский `layout.tsx`
с `DashboardNav` (`src/components/dashboard/DashboardNav.tsx`): сайдбар на десктопе,
лента вкладок на мобильных. Активный пункт вычисляет чистая функция `isNavItemActive`
(точное совпадение для `/dashboard`, префиксное для вложенных маршрутов). Пункт
«Избранное» намеренно ведёт на `/favorites` — страницу вне группы, поэтому сайдбар там
не рендерится.

Реализованы: обзор (`/dashboard`, счётчики избранного и непрочитанных сообщений),
профиль (`/dashboard/profile`, форма + загрузка аватара, лимит 5 МБ проверяется на
клиенте) и подписки (`/dashboard/subscriptions`, список/создание/удаление; создание
переиспользует `FiltersPanel` каталога с `showSort={false}`). Разделы «Мои
объявления», «Бронирования» и «Сообщения» — заглушки с `Dashboard.comingSoon`.

Чистая логика подписок вынесена в `src/lib/subscriptions/filters.ts`
(`describeSubscription`, `subscriptionToCatalogQuery`, `filtersToSubscriptionCreate`,
`hasAnyFilter`) и покрыта `src/tests/subscription-filters.test.ts` отдельно от JSX.
Кнопка «Сохранить поиск» на `/catalog` использует те же хелперы.
```

```bash
git add CLAUDE.md && git commit -m "docs(claude): document the dashboard feature layer"
```

---

## Порядок выполнения и зависимости

```
Task 1 (бэкенд) ─────────────────────────────────┐
Task 2 (типы + i18n) → Task 3 (API-модули) ──────┤
                     ↘ Task 4 (каркас) ──────────┤
                                 ↘ Task 5 (обзор)│
Task 3 + Task 1 ────────────────→ Task 6 (профиль)
Task 3 + Task 2 ────────────────→ Task 7 (подписки) → Task 8 (каталог)
                                                     ↘ Task 9 (e2e + гейт)
```

Task 1 не зависит ни от чего фронтового и может выполняться параллельно с Task 2–5, но должна быть готова до проверки Task 6 на живом стенде (без неё имя/фамилия/телефон не сохранятся).

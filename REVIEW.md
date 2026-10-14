# SYNKRA — Project Overview & Review Guide / Обзор проекта и инструкция по проверке

[English](#english) · [Русский](#русский)

## English

SYNKRA is a fitness platform with a Ukrainian interface. It includes club and workout catalogs, personal accounts, nutrition planning, class bookings, and an administration panel. You can review the application locally without a publicly hosted website.

### Website structure

| Section | What it includes | Route |
|---|---|---|
| Homepage | Platform introduction, activity categories, club search, program highlights, membership links, and FAQ | `/` |
| Clubs and map | City and region filters, search, sorting, comparison, favorites, club details, and an interactive map of Ukraine | `/clubs`, `/clubs/map` |
| Trainers | Profiles, specialties, format filters, and contextual inquiry forms | `/trainers` |
| Exercise library | Muscle groups, equipment, instructions, common mistakes, alternatives, and safety notes | `/exercises` |
| Workouts and programs | Ready-made workouts, exercise sequences, warm-up/cool-down guidance, and multiweek schedules | `/workouts`, `/programs` |
| Workout builder | Custom exercise selection, sets, repetitions, load, rest intervals, scheduling, workout timer, and saved results | `/workout-builder` |
| Recipes and nutrition | Ingredients, cooking steps, nutrition estimates, calorie calculator, daily/weekly diary, and shopping list | `/recipes`, `/nutrition` |
| Class schedule | Day/week views, filters, remaining capacity, booking, and calendar export | `/schedule` |
| Memberships and checkout | Club and plan selection, stored orders, payment status, and membership cards with QR codes after activation | `/membership`, `/checkout/<id>` |
| Personal account | Profile, favorites, bookings, workouts, progress measurements, orders, memberships, notifications, saved payment methods, and settings | `/account` |
| Support and contact | Contextual inquiries about clubs/trainers/memberships, private support tickets, and replies | `/contact`, `/support` |
| Administration | CRM, clients, roles, sales, bookings, support, catalog editing, and audit history | `/admin` |
| Editorial and service pages | Articles, platform information, FAQ, offers, policy drafts, cookie information, and photo attribution | `/blog`, `/about`, `/faq`, `/offers`, `/privacy`, `/terms`, `/cookies`, `/photo-credits` |

The interface adapts to desktop and mobile screens. Global search connects users to catalog records. Catalog detail pages link related exercises, workouts, clubs, trainers, and sessions.

### Project highlights

These are concrete aspects to evaluate when comparing the project with other portfolio applications:

- **Connected customer and staff workflows.** Registration and contact inquiries create CRM records. Bookings, orders, memberships, and support requests are backed by the same server database and visible to authorized staff.
- **A personal fitness workspace.** Workout planning, completed sessions, progress measurements, nutrition, favorites, and class bookings belong to the user's account and survive server restarts.
- **Administration of stored content.** Catalog records can be created, edited, copied, and removed through a JSON editor. Saved edits and deletion markers survive repeated seed initialization.
- **Access scoped to responsibilities.** Clients see their own private data; managers work with assigned clubs; administrators manage roles and central operations. TRAINER currently has client-level capabilities rather than a separate trainer console.
- **Payment processing with server-side checks.** The server fixes the price, verifies payment callbacks, prevents duplicate membership issuance, and cancels a membership on refund. A redirect from checkout alone cannot activate it.
- **Digital membership verification.** Activated memberships have a QR code leading to a validity endpoint, with status and expiry checks.
- **Geography and image traceability.** The local Ukraine map works without a Google Maps key. Registered catalog photographs have source, author, license, and checksum metadata, and administrator-supplied photographs take priority.
- **Inspectable implementation.** Versioned database migrations and automated checks cover authentication, role isolation, persistence, booking capacity, payments, catalogs, and image assets.

These points describe implemented behavior, not a claim that competing products lack these features or that this application is ready for a commercial launch.

### Automation and integrations

| Trigger | Implemented processing | Requirements or limits |
|---|---|---|
| Account registration | Creates a client and registration lead, queues verification email, creates a welcome notification and audit event | External delivery needs an email provider; localhost has a local mailbox |
| Contact inquiry | Saves a CRM lead with club/trainer/membership context and queues an acknowledgment | Email delivery requires configuration |
| Verified successful payment | Records payment, marks order paid, issues one membership, updates registration lead to WON, and queues confirmations | Requires configured LiqPay and a confirmed partner club; no live merchant acceptance test is claimed |
| Refund callback | Marks the order refunded and cancels the membership | Requires a valid signed provider callback |
| Membership nearing expiry | Creates a deduplicated in-app reminder within the final three days; queues email if enabled | Scheduled processing and email configuration are required |
| Upcoming booked class | Creates an in-app reminder within two hours; queues Telegram if linked and enabled | Scheduled processing; Telegram requires a configured bot |
| Scheduled maintenance | Expires memberships, removes expired sessions/tokens/rate-limit records, recovers stale delivery claims, and processes queued messages | Worker schedule is configured every 15 minutes; deployment must retain it |
| Message delivery failure | Retains messages in a database outbox, retries provider failures up to five attempts, and retains failed entries | Missing providers leave messages pending; delivery is not guaranteed exactly once |
| Staff activity | Records key actions in an audit log; administration refreshes through reconnecting server-sent events | Requires an authorized account; this is not a WebSocket service |

The scheduler also has a protected administrator endpoint and an authenticated external cron endpoint. Keeping a browser page open does not itself run scheduled jobs.

The Telegram adapter supports account linking and commands for profile, memberships, schedule, workout history, and unlinking. It does not implement payment or booking cancellation inside Telegram. Google Sheets integration is an optional **manual export** through the supplied Apps Script, not continuous synchronization. CSV exports work independently. Saved payment methods use encrypted provider tokens; card number and CVV entry stays in LiqPay's hosted form.

### Technical structure

The project uses React 19, TypeScript, Vinext/App Router, a Cloudflare Worker, D1/SQLite, Drizzle, and Zod.

| Folder/file | Responsibility |
|---|---|
| `app/` | Pages, metadata, and API entry route |
| `components/`, `components/product/` | Public interface, personal account, business workflows, and administration |
| `lib/catalog.ts` | Initial catalog data and class seed generation |
| `lib/server/` | Authentication, API dispatch, SQL access, commerce, payment methods, and automation |
| `db/schema.ts`, `drizzle/` | Database schema and versioned SQL migrations |
| `lib/geo.ts`, `lib/data/` | Map geometry, city data, and image registry |
| `public/images/` | Website photographs and illustrations |
| `scripts/` | Setup, startup, migrations, validation, and asset maintenance |
| `build/sites-worker.ts`, `vite.config.ts` | Worker entry point, build configuration, and scheduled trigger |
| `integrations/google-sheets.gs` | Optional Google Sheets export receiver |

The following steps explain how to run and evaluate these features locally.

### 1. Download the project

Open [the SYNKRA repository](https://github.com/egor12d/synkra), select **Code → Download ZIP**, and extract the archive. Open the `synkra-main` folder containing `package.json` and `Start-SYNKRA.cmd`.

Alternatively, clone the repository to access its Git history:

```powershell
git clone https://github.com/egor12d/synkra.git
cd synkra
```

### 2. Prepare your environment

Install [Node.js 24 LTS](https://nodejs.org/en/download), including npm. Internet access is required to download dependencies on the first run.

Open a new terminal after installation and check:

```powershell
node --version
npm --version
```

Docker and a separate PostgreSQL installation are not required for local review.

### 3. Start the application

**On Windows:** double-click `Start-SYNKRA.cmd`. It installs dependencies when needed, prepares the local database, and starts the server. Wait for `САЙТ ГОТОВ` (“SITE READY”) and keep the terminal window open while reviewing the application.

**From a terminal:** open the project folder and run these commands in order:

```powershell
npm ci
node scripts/init-local.mjs
node scripts/start-local.mjs
```

Open **http://127.0.0.1:5174/** once the server is ready. If your PORT environment variable specifies another port, use the address printed in the terminal. Press Ctrl+C in the server terminal to stop it.

### 4. Review the public sections

1. **Homepage:** navigation, search, and links to other sections.
2. **Clubs:** search, filters, detail pages, comparison, and the Ukraine map.
3. **Trainers, exercises, workouts, and programs:** catalogs and detailed descriptions.
4. **Recipes and nutrition:** recipes and the estimated daily energy calculator.
5. **Schedule and memberships:** class, club, and membership plan selection.

The initial catalog contains 100 cities, 250 sample clubs, 60 sample trainer profiles, 300 exercises, 120 workouts, 40 programs, and 150 recipes. Sample clubs and trainer profiles do not establish actual commercial partnerships.

### 5. Review a personal account

1. Open **http://127.0.0.1:5174/auth/register** and create your own test account with a password of at least 10 characters. No shared default login or password is provided.
2. If needed, verify your email using **«Відкрити локальні листи»** (“Open local emails”) on the registration page. Local messages are also available at `/api/dev/mailbox`. Without a configured email provider, they are not delivered to an external inbox.
3. Open `/account`, edit your profile, and save the changes.
4. Save a club or program as a favorite and check **«Обране»** (“Favorites”).
5. In `/workout-builder`, add exercises, configure sets, and save a plan. Start and finish a workout in the interface to check that its result is recorded. Physical exercise is not required to test the software.
6. In `/nutrition`, add a recipe to a selected day and check the diary and shopping list.
7. In `/schedule`, book an available future class, check the booking in your account, and cancel it.
8. Restart the server and sign in again: your saved data should remain available.

### 6. Review the administration panel

Create an account, then open the `.dev.vars` file generated during initialization. Set `BOOTSTRAP_ADMIN_EMAIL=` to that account's email address and save the file. Do not publish `.dev.vars`.

On Windows, run `Start-SYNKRA.cmd` again. If starting manually, run this command from the project folder:

```powershell
node scripts/configure-local-admin.mjs
```

Refresh the page and open **http://127.0.0.1:5174/admin** while signed in to the same account. Review CRM leads, clients, roles, sales, support tickets, the JSON content editor, and the audit log. Submit a test inquiry through `/contact` and find it in the CRM panel.

The local command grants the existing account administrator access without changing its password. This is a local operator setup mechanism; initial administrator setup on a public server follows a separate process.

### 7. Understand the local review boundaries

The repository includes source code and site assets, but not the author's personal database, accounts, or secrets. A separate database is created on your computer in `.wrangler/state`. Keep this folder if you want to retain your review data.

Live LiqPay payments, email delivery, Telegram, and Google Sheets exports require owner configuration. Creating an order does not charge a card or activate a membership. Live payments are blocked for unconfirmed clubs, and test payments are disabled by default. External service credentials are not required to review the interface, accounts, and main local workflows.

### 8. Optional technical checks

Run from the project folder:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import ./scripts/windows-os-compat.mjs scripts/test-backend.mjs
node --test scripts/test-catalog.mjs scripts/test-photo-assets.mjs scripts/test-local-admin.mjs
node --import ./scripts/windows-os-compat.mjs scripts/run-framework.mjs build
```

Validation on October 14, 2026: TypeScript and the production build passed; 157 backend assertions and 15 additional tests passed. Tests use separate review databases and do not perform real bank charges. ESLint had 80 errors and 29 warnings at the time of review; the project is not presented as having a clean lint result.

### Troubleshooting

- `node` is not found: install Node.js and reopen your terminal.
- `npm ci` fails: check your internet connection and the complete error message.
- Port 5174 is occupied: stop the previous SYNKRA server or specify another port using PORT.
- Windows startup fails: inspect `.sites-runtime/startup.log`.
- Catalogs open but saving is unavailable: sign in; some features require an account.

Documentation: [downloading a GitHub project](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives), [installing Node.js](https://nodejs.org/en/download).

---

## Русский

SYNKRA — фитнес-платформа с украинским интерфейсом. Проект включает каталоги клубов и тренировок, личный кабинет, планирование питания, запись на занятия и панель администратора. Его можно проверить локально без опубликованного сайта.

### Структура сайта

| Раздел | Что включает | Адрес |
|---|---|---|
| Главная | Знакомство с платформой, направления активности, поиск клубов, программы, переходы к абонементам и FAQ | `/` |
| Клубы и карта | Фильтры по городам и регионам, поиск, сортировка, сравнение, избранное, карточки и интерактивная карта Украины | `/clubs`, `/clubs/map` |
| Тренеры | Профили, специализации, фильтры по формату и заявки с контекстом выбранного тренера | `/trainers` |
| Библиотека упражнений | Мышечные группы, оборудование, техника, ошибки, альтернативы и рекомендации по безопасности | `/exercises` |
| Тренировки и программы | Готовые тренировки, последовательности упражнений, разминка, заминка и планы по неделям | `/workouts`, `/programs` |
| Конструктор тренировок | Выбор упражнений, подходы, повторения, нагрузка, отдых, дата занятия, таймер и сохранение результатов | `/workout-builder` |
| Рецепты и питание | Ингредиенты, приготовление, ориентировочное БЖУ, калькулятор калорий, дневник на день/неделю и список покупок | `/recipes`, `/nutrition` |
| Расписание | Просмотр по дням/неделям, фильтры, свободные места, запись и выгрузка занятия в календарь | `/schedule` |
| Абонементы и оформление | Выбор клуба и тарифа, сохранённые заказы, статус оплаты и цифровые карты с QR после активации | `/membership`, `/checkout/<id>` |
| Личный кабинет | Профиль, избранное, записи, тренировки, замеры прогресса, заказы, абонементы, уведомления, способы оплаты и настройки | `/account` |
| Поддержка и контакты | Заявки по клубам/тренерам/абонементам, личные обращения и переписка с поддержкой | `/contact`, `/support` |
| Панель администратора | CRM, клиенты, роли, продажи, записи, поддержка, редактирование каталогов и аудит | `/admin` |
| Материалы и служебные страницы | Статьи, информация о платформе, FAQ, предложения, проекты правовых текстов, cookies и авторство фотографий | `/blog`, `/about`, `/faq`, `/offers`, `/privacy`, `/terms`, `/cookies`, `/photo-credits` |

Интерфейс адаптируется к компьютерам и мобильным экранам. Общий поиск ведёт к записям каталогов. Подробные страницы связывают упражнения, тренировки, клубы, тренеров и занятия.

### Особенности проекта

При сравнении с другими работами в портфолио здесь можно оценить следующие реализованные решения:

- **Связанные процессы клиента и команды.** Регистрация и обращения создают записи CRM. Бронирования, заказы, абонементы и поддержка работают с общей серверной базой и доступны сотрудникам в пределах их прав.
- **Личное пространство для тренировок.** Планы, результаты, замеры прогресса, питание, избранное и записи привязаны к аккаунту и сохраняются после перезапуска сервера.
- **Управление действующим контентом.** Карточки можно создавать, изменять, копировать и удалять через JSON-редактор. Правки и отметки удаления сохраняются при повторной загрузке начального каталога.
- **Разделение прав по задачам.** Клиент видит свои личные данные, менеджер работает с назначенными клубами, администратор управляет ролями и общими процессами. Роль TRAINER пока имеет возможности клиента; отдельного кабинета тренера нет.
- **Проверяемый платёжный процесс.** Сервер фиксирует цену, проверяет уведомления провайдера, предотвращает повторную выдачу абонемента и отменяет его при возврате. Возвращение со страницы оплаты само по себе ничего не активирует.
- **Проверка цифрового абонемента.** После активации карта получает QR-код со ссылкой на проверку действительности, статуса и срока.
- **География и происхождение фотографий.** Локальная карта Украины работает без ключа Google Maps. Реестр фотографий содержит источники, авторов, лицензии и контрольные суммы; собственные фото администратора имеют приоритет.
- **Возможность оценить реализацию.** Миграции и автоматические проверки охватывают вход, разделение прав, сохранение данных, вместимость занятий, платежи, каталоги и фотографии.

Это описание реализованных возможностей, а не утверждение, что их нет у конкурентов или что проект уже готов к коммерческому запуску.

### Автоматизация и интеграции

| Событие | Что обрабатывается автоматически | Условия и ограничения |
|---|---|---|
| Регистрация | Создание клиента и заявки CRM, письмо подтверждения в очереди, приветственное уведомление и запись аудита | Для внешней почты нужен провайдер; на localhost есть локальный ящик |
| Заявка из формы | Сохранение заявки с контекстом клуба/тренера/абонемента и постановка подтверждения в очередь | Для отправки email нужна настройка |
| Подтверждённая успешная оплата | Запись платежа, статус paid, выдача одного абонемента, перевод регистрационной заявки в WON и подтверждения | Нужны LiqPay и подтверждённый клуб; проверка реального эквайринга владельца не заявляется |
| Уведомление о возврате | Статус refunded у заказа и отмена абонемента | Нужна действительная подпись провайдера |
| Приближение конца абонемента | Уведомление без повторов в последние три дня; email, если разрешён | Нужны запуск фоновой обработки и настройка почты |
| Предстоящее забронированное занятие | Уведомление в кабинете в пределах двух часов; Telegram при привязке и разрешении | Нужна фоновая обработка; для Telegram — настроенный бот |
| Фоновое обслуживание | Завершение просроченных абонементов, очистка истёкших сессий/токенов/ограничений, восстановление зависших отправок и обработка очереди | В Worker задан запуск раз в 15 минут; при размещении нужно сохранить расписание |
| Ошибка доставки | Сохранение сообщения в базе, до пяти попыток при ошибках провайдера, хранение неудачной отправки | Без провайдера сообщения остаются в ожидании; доставка ровно один раз не гарантируется |
| Действия сотрудников | Журнал ключевых операций и обновление панели через переподключаемые серверные события | Нужны соответствующие права; это не WebSocket-сервис |

Фоновую обработку также можно вызвать защищённой командой администратора или внешним планировщиком с секретом. Само открытие страницы в браузере не запускает фоновые задания.

Telegram-адаптер поддерживает привязку аккаунта, профиль, абонементы, расписание, историю тренировок и отключение. Оплата и отмена записи внутри Telegram не реализованы. Google Sheets — необязательный **ручной экспорт** через приложенный Apps Script, а не постоянная синхронизация. CSV работает отдельно. Сохранённые способы оплаты используют зашифрованные токены провайдера; номер карты и CVV вводятся только в форме LiqPay.

### Техническая структура

Стек: React 19, TypeScript, Vinext/App Router, Cloudflare Worker, D1/SQLite, Drizzle и Zod.

| Папка/файл | Назначение |
|---|---|
| `app/` | Страницы, метаданные и входной маршрут API |
| `components/`, `components/product/` | Публичный интерфейс, кабинет, рабочие процессы и админка |
| `lib/catalog.ts` | Начальный каталог и генерация исходного расписания |
| `lib/server/` | Вход, диспетчер API, SQL, заказы, способы оплаты и автоматизация |
| `db/schema.ts`, `drizzle/` | Структура базы и версионированные SQL-миграции |
| `lib/geo.ts`, `lib/data/` | Геометрия карты, города и реестр фотографий |
| `public/images/` | Фотографии и изображения сайта |
| `scripts/` | Настройка, запуск, миграции, проверки и обслуживание ресурсов |
| `build/sites-worker.ts`, `vite.config.ts` | Вход Worker, сборка и расписание фоновых задач |
| `integrations/google-sheets.gs` | Необязательный приёмник экспорта в Google Sheets |

Далее приведены шаги запуска и проверки этих возможностей на своём компьютере.

### 1. Скачайте проект

Откройте https://github.com/egor12d/synkra и нажмите **Code → Download ZIP**. Распакуйте архив и откройте папку `synkra-main`, содержащую `package.json` и `Start-SYNKRA.cmd`.

Для работы с историей изменений вместо архива можно клонировать репозиторий:

```powershell
git clone https://github.com/egor12d/synkra.git
cd synkra
```

### 2. Подготовьте окружение

Установите **Node.js 24 LTS** с https://nodejs.org/en/download. npm входит в установку Node.js. Для первого запуска нужен доступ к интернету для скачивания зависимостей.

После установки откройте новый терминал и проверьте:

```powershell
node --version
npm --version
```

Docker и отдельная установка PostgreSQL для локальной проверки не нужны.

### 3. Запустите сайт

**На Windows:** дважды нажмите `Start-SYNKRA.cmd`. Скрипт установит зависимости, подготовит локальную базу и запустит сайт. Не закрывайте его окно во время проверки. Дождитесь строки `САЙТ ГОТОВ`.

**Запуск через терминал:** откройте терминал в папке проекта и выполните команды по очереди:

```powershell
npm ci
node scripts/init-local.mjs
node scripts/start-local.mjs
```

Когда сервер будет готов, откройте **http://127.0.0.1:5174/**. Если переменная PORT в вашем окружении задаёт другой порт, используйте адрес из терминала. Для остановки сервера нажмите Ctrl+C в его терминале.

### 4. Проверьте публичные разделы

1. **Главная:** навигация, поиск, переходы между разделами.
2. **Клубы:** поиск, фильтры, карточки, сравнение и карта Украины.
3. **Тренеры, упражнения, тренировки и программы:** каталоги и подробные описания.
4. **Рецепты и питание:** рецепты и калькулятор ориентировочной потребности в энергии.
5. **Расписание и абонементы:** выбор занятий, клубов и тарифов.

Начальное наполнение включает 100 городов, 250 примеров клубов, 60 примеров тренеров, 300 упражнений, 120 тренировок, 40 программ и 150 рецептов. Примеры клубов и профили тренеров не подтверждают реальное партнёрство.

### 5. Проверьте личный кабинет

1. Откройте **http://127.0.0.1:5174/auth/register** и создайте собственный тестовый аккаунт. Пароль должен содержать не менее 10 символов. Предустановленного общего логина и пароля нет.
2. При необходимости подтвердите email через кнопку **«Відкрити локальні листи»** на странице регистрации. На localhost письма можно также посмотреть по адресу `/api/dev/mailbox`; без настроенного почтового провайдера они не доставляются во внешний почтовый ящик.
3. Откройте `/account`, измените профиль и сохраните изменения.
4. Добавьте клуб или программу в избранное и проверьте вкладку **«Обране»**.
5. В `/workout-builder` добавьте упражнения, настройте подходы и сохраните план. Начните тренировку в интерфейсе и завершите её, чтобы проверить запись результата; выполнять упражнения физически для проверки программы не требуется.
6. В `/nutrition` добавьте рецепт в выбранный день и проверьте дневник и список продуктов.
7. В `/schedule` запишитесь на доступное будущее занятие. Проверьте запись в кабинете и отмените её.
8. Перезапустите сервер и войдите снова: сохранённые данные должны остаться.

### 6. Проверьте админку

Для локальной проверки создайте аккаунт, затем откройте созданный при инициализации файл `.dev.vars`. В строке `BOOTSTRAP_ADMIN_EMAIL=` укажите email этого аккаунта и сохраните файл. Не публикуйте `.dev.vars`.

На Windows повторно запустите `Start-SYNKRA.cmd`. При ручном запуске выполните из папки проекта:

```powershell
node scripts/configure-local-admin.mjs
```

Обновите страницу и откройте **http://127.0.0.1:5174/admin** под тем же аккаунтом. Проверьте заявки CRM, клиентов, роли, продажи, обращения поддержки, JSON-редактор контента и журнал аудита. Для проверки CRM отправьте тестовое обращение через `/contact` и найдите его в панели.

Локальная команда назначает права существующему аккаунту и не меняет его пароль. Это механизм проверки на собственном компьютере; на публичном сервере назначение первоначального администратора работает отдельно.

### 7. Учитывайте границы локальной проверки

Архив содержит исходники и ресурсы сайта, но не личную базу автора, его аккаунты и секреты. На вашем компьютере создаётся отдельная база в `.wrangler/state`. Не удаляйте эту папку, если хотите сохранить проверочные данные.

Реальные платежи LiqPay, доставка email, Telegram и экспорт в Google Sheets требуют настроек владельца. Создание заказа не означает списание денег или выдачу абонемента. Для неподтверждённых клубов реальная оплата заблокирована; тестовые платежи по умолчанию выключены. Отсутствие ключей внешних сервисов не мешает оценить интерфейс, кабинеты и основные локальные сценарии.

### 8. Дополнительная техническая проверка

Из папки проекта:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import ./scripts/windows-os-compat.mjs scripts/test-backend.mjs
node --test scripts/test-catalog.mjs scripts/test-photo-assets.mjs scripts/test-local-admin.mjs
node --import ./scripts/windows-os-compat.mjs scripts/run-framework.mjs build
```

Проверка 14 октября 2026: TypeScript и сборка прошли; 157 серверных проверок и 15 дополнительных тестов прошли. Тесты используют отдельные проверочные базы и не выполняют реальные банковские списания. ESLint имеет известные замечания: 80 ошибок и 29 предупреждений на момент проверки; проект не заявляется как полностью прошедший lint.

### Если сайт не запускается

- `node` не найден: установите Node.js и заново откройте терминал.
- Ошибка `npm ci`: проверьте доступ к интернету и полный текст ошибки.
- Порт 5174 занят: завершите предыдущий сервер SYNKRA или запустите сервер на другом порту через переменную PORT.
- Ошибка запуска Windows: смотрите `.sites-runtime/startup.log`.
- Каталог открыт, но сохранение недоступно: войдите в аккаунт; часть функций требует авторизации.

Документация: [скачивание проекта с GitHub](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives), [установка Node.js](https://nodejs.org/en/download).

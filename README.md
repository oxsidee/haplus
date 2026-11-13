# Home Assistant — редизайн

Веб-интерфейс Home Assistant с редизайном. Основа — `home-assistant/frontend` `20261028.5`, ядро Home Assistant `2026.11.1`. Исходный README: [redesign/UPSTREAM_README.md](redesign/UPSTREAM_README.md).

## Запуск на сервере

Нужны Linux, Docker с плагином Compose и git. Для сборки нужно около 8 ГБ памяти (если не хватает, добавьте swap) и около 10 ГБ места на диске.

```bash
git clone https://github.com/oxsidee/haplus.git
cd haplus
mkdir -p config
cp redesign/config/configuration.yaml config/
docker compose up -d --build
```

Первая сборка идёт 10–20 минут. После неё интерфейс открывается по адресу `http://<адрес-сервера>:8123`, где нужно создать пользователя.

- `config/` — конфигурация и данные Home Assistant. Её не трогает git, её нужно сохранять при переносе и резервном копировании.
- `redesign/config/configuration.yaml` — пример конфигурации: Россия, русский язык, метрическая система. Если `config/` уже есть от другой установки Home Assistant, используйте его вместо примера.
- Часовой пояс: `TZ=Europe/Moscow` по умолчанию, меняется так: `TZ=Asia/Yekaterinburg docker compose up -d`.

## Команды

```bash
docker compose logs -f
docker compose restart
docker compose down
```

## Обновление

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## Что внутри

| Путь                                       | Что это                                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                               | Собирает фронтенд в контейнере Node.js и подменяет им фронтенд в официальном образе `ghcr.io/home-assistant/home-assistant` |
| `docker-compose.yml`                       | Запуск: `network_mode: host`, данные в `config/`                                                                            |
| `redesign/translations/ru.json`            | Русские строки новых экранов                                                                                                |
| `redesign/scripts/prepare-translations.py` | Берёт русский перевод из официального образа и добавляет новые строки                                                       |
| `redesign/scripts/add-strings.py`          | Добавляет строки в `src/translations/en.json` и `redesign/translations/ru.json`                                             |

Версия фронтенда привязана к версии ядра: `20261028.5` ↔ `2026.11.1`. `HA_VERSION` в `docker-compose.yml` менять отдельно от фронтенда нельзя.

## Что изменено

- Токены темы: палитра светлой и тёмной темы, цвета состояний, шрифт Inter Tight, радиусы, тени, высота шапки.
- Шапка дашборда, боковое меню, плитки, экран входа, настройки, энергия, журнал, история, календарь.
- Обзор (`/home`): приветствие, сводка, метрики, иллюстрация дома со светом по этажам, настраиваемый док, зоны по этажам, сцены, «Требует внимания». Прежний вид — `/home/classic`.
- Экран зоны: фокус на светильнике (яркость, цвет, температура, избранные цвета, эффекты), климате, шторах, медиаплеере. Панель устройств редактируется: порядок, свои группы, добавление, скрытие, сброс. Группа управляется как одно устройство, разные типы листаются галереей.
- Мультимедиа: блок «Сейчас играет» и колонка «Плееры».
- Устройства: карточки по пространствам.

## Разработка

Нужны Node.js 24 и pnpm 12.

```bash
pnpm install --frozen-lockfile
python3 redesign/scripts/prepare-translations.py
./node_modules/.bin/gulp develop-app
```

Готовая сборка попадает в `hass_frontend/`; Home Assistant подключает её через `frontend: development_repo:`.

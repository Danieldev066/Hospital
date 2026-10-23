# Hospital — учебный Django-бэкенд

Учебный REST API для медицинской клиники по ТЗ `tz_hospital.docx`. Реализованы все семь моделей: **UserProfile, Specialization, Doctor, Schedule, Appointment, MedicalRecord, DoctorReview**. Есть регистрация, вход, отзывы, расписание, история посещений, медицинские записи, административная панель и CRUD. Фронтенд не входит в проект.

## 1. Как открыть в PyCharm (Windows 11)

1. Распакуйте `Hospital_Backend.zip`.
2. Откройте **PyCharm → File → Open** и выберите папку `Hospital_Backend`, в которой находится `manage.py`.
3. Внизу откройте **Terminal** (PowerShell) и выполните команды **по очереди**:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py makemigrations clinic
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver
```

> Активация `.venv` необязательна: используется прямой путь к Python окружения, поэтому PowerShell ExecutionPolicy не мешает.

4. Откройте **http://127.0.0.1:8000/admin/** и войдите под суперпользователем.
5. API открывается по адресу **http://127.0.0.1:8000/api/**. Можно тестировать GET прямо в браузере или использовать DRF Browsable API, Postman и curl.

Если при работе в редакторе `django` подчёркивается красным: **Settings → Project → Python Interpreter → Add Interpreter → Existing Environment**, выберите `Hospital_Backend\.venv\Scripts\python.exe`.

**Важно:** установите зависимости *до* первого запуска. Свою модель `UserProfile` нужно использовать с самого первого `migrate`. Не запускайте `migrate` из другого проекта поверх старой БД. Если меняете `models.py`, используйте `makemigrations`, затем `migrate`.

## 2. API (все URL со слешем в конце)

| Метод | Адрес | Для чего | Доступ |
|---|---|---|---|
| POST | `/api/register/` | Регистрация пациента | Все |
| POST | `/api/login/` | Получение токена | Все |
| POST | `/api/logout/` | Отзыв токена | Пациент |
| GET, PATCH | `/api/me/` | Свой профиль | Пациент |
| GET | `/api/specializations/` | Специализации | Все |
| GET | `/api/doctors/` | Врачи | Все |
| GET | `/api/doctors/1/` | Профиль врача + рейтинг | Все |
| GET | `/api/schedules/?doctor=1` | Расписание врача | Все |
| GET, POST | `/api/appointments/` | Свои приёмы, новая запись | Пациент |
| GET, PATCH, DELETE | `/api/appointments/1/` | Просмотр, отмена, правка или удаление | Владелец или админ |
| GET | `/api/medical-records/` | Свои диагнозы и назначения | Пациент |
| GET, POST | `/api/reviews/` | Отзывы, оставить отзыв | GET всем; POST пациенту |
| GET | `/api/reviews/?doctor=1` | Отзывы конкретного врача | Все |
| POST / PUT, PATCH, DELETE | `/api/doctors/` / `/api/doctors/1/` | Добавление / правка и удаление врача | Админ |
| POST / PUT, PATCH, DELETE | `/api/medical-records/` / `/api/medical-records/1/` | Добавление / правка и удаление медкарты | Админ |

У каждого списка есть просмотр по ID, а у защищённых списков — редактирование по ID при наличии прав. Ответы списка постраничные: `?page=2`. Врачей можно фильтровать по `?specialization=1`, искать через `?search=кардио` и сортировать `?ordering=price`.

### Пример регистрации

**POST** `http://127.0.0.1:8000/api/register/`:

```json
{
  "username": "patient99",
  "password": "ExampleStrongPass123!",
  "password_confirm": "ExampleStrongPass123!",
  "first_name": "Бакыт",
  "phone_number": "+996700000000"
}
```

### Пример входа

**POST** `http://127.0.0.1:8000/api/login/`:

```json
{"username": "patient99", "password": "ExampleStrongPass123!"}
```

В ответе придёт `token`. Для защищённых запросов передайте HTTP-заголовок:

```
Authorization: Token ВАШ_ТОКЕН
```

### Пример создания записи

**POST** `http://127.0.0.1:8000/api/appointments/`:

```json
{
  "doctor": 1,
  "date_time": "2026-10-12T10:00:00+06:00",
  "complaint": "Хочу получить консультацию"
}
```

Дата в примере лишь иллюстрация; для нового приёма указывайте **будущую дату**, когда выбранный врач работает. Время работы задаёт администратор через `/admin/` или API. Новая запись получает статус `pending`. Пациент может отменить ожидающий или подтверждённый приём запросом **PATCH** `/api/appointments/1/` с `{"status":"cancelled"}`. Статусы `confirmed` и `completed` выставляет администратор. Медицинская запись (диагноз и назначения) добавляется администратором **после** завершения приёма и показывается пациенту в истории.

## 3. Правила доступа

- Публичны только специальности, врачи, расписания и отзывы.
- Пациент читает только **свои** записи на приём и медицинские записи; нельзя менять владельца записи.
- Добавлять врачей, специализации, расписание, создавать диагнозы и завершать приёмы может только администратор.
- Отзыв можно оставить один раз на врача, оценка 1–5; редактирует автор или администратор.
- Ожидающая и подтверждённая запись блокируют тот же момент времени у врача; отменённая освобождает его.
- Запись разрешена в будущем, в пределах расписания. **Длительность одного приёма ТЗ не задаёт**, поэтому занятость проверяется по совпадению даты и времени, а не по интервалу в 30 минут.

## 4. Запустить тесты

```powershell
.\.venv\Scripts\python.exe manage.py test
```

## 5. Файлы проекта

```text
Hospital_Backend/
├── manage.py
├── requirements.txt
├── README.md
├── .env.example
├── .gitignore
├── hospital_project/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
└── clinic/
    ├── __init__.py
    ├── apps.py
    ├── admin.py
    ├── models.py
    ├── serializers.py
    ├── permissions.py
    ├── views.py
    ├── urls.py
    ├── tests.py
    ├── management/commands/seed_demo.py
    └── migrations/
        ├── __init__.py
        └── 0001_initial.py   # создастся автоматически командой makemigrations
```

**Безопасность:** это учебный проект с SQLite, локальным секретным ключом для разработки и `DEBUG=1`. Не храните настоящие диагнозы/персональные данные и не выкладывайте его в интернет без дополнительной настройки безопасности, HTTPS, переменных окружения и системы ролей персонала.

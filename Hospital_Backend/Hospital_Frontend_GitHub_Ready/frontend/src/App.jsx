import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck2,
  CalendarDays, Check, CheckCircle2, ChevronDown, ClipboardList, Clock3,
  FileHeart, Heart, HeartPulse, LockKeyhole, LogOut, Mail, MapPin, Menu,
  MessageSquare, Phone, Search, ShieldCheck, Sparkles, Star, Stethoscope,
  UserRound, UsersRound, X, AlertCircle, RefreshCw, Send,
} from 'lucide-react'
import { getAll, getToken, mediaUrl, request, setToken } from './api'

const photoList = ['doctor-1', 'doctor-2', 'doctor-3', 'doctor-4', 'doctor-5', 'doctor-6']
const bloodGroups = ['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
const stateLabels = { pending: 'Ожидает подтверждения', confirmed: 'Подтверждена', cancelled: 'Отменена', completed: 'Завершена' }
const weekShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const fullName = (doc) => [doc?.last_name, doc?.first_name, doc?.patronymic].filter(Boolean).join(' ')
const formatMoney = (price) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(price) || 0)} сом`
const formatDate = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bishkek', ...options }).format(new Date(value)) : '—'
const timeFor = (value) => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
const dateInBishkek = (value) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
const specIcon = (name = '') => /кардио|сердц/i.test(name) ? HeartPulse : /хирург|ортопед/i.test(name) ? Activity : /терап|семейн/i.test(name) ? Stethoscope : /невро/i.test(name) ? Sparkles : /педиатр/i.test(name) ? Heart : FileHeart
const prettyError = (err) => err?.message || 'Не удалось выполнить действие'
const firstError = (err) => typeof err === 'string' ? err : prettyError(err)

function Photo({ doctor, index = 0, className = '' }) {
  const src = doctor?.photo ? mediaUrl(doctor.photo) : `/images/${photoList[index % photoList.length]}.webp`
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  return <img className={className} src={broken ? `/images/${photoList[index % photoList.length]}.webp` : src} alt={doctor ? `Врач ${fullName(doctor)}` : 'Врач клиники'} loading="lazy" onError={() => setBroken(true)} />
}

function Brand() {
  return <Link className="brand" to="/"><span className="brand-symbol"><HeartPulse size={20} strokeWidth={2.7} /></span><span>hospital<span className="brand-dot">.</span></span></Link>
}

function Header({ user, onAuth, onLogout }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])
  return <header className="site-header"><div className="container header-inner">
    <Brand />
    <nav className={`top-nav ${open ? 'nav-open' : ''}`} aria-label="Главная навигация">
      <NavLink to="/" end>Главная</NavLink><NavLink to="/doctors">Врачи</NavLink><NavLink to="/specializations">Направления</NavLink><NavLink to="/appointments">Мои записи</NavLink>
    </nav>
    <div className="header-actions">
      {user ? <><Link to="/profile" className="header-profile"><span className="user-avatar">{(user.first_name || user.username || 'П')[0].toUpperCase()}</span><span>{user.first_name || user.username}</span></Link><button className="icon-btn logout-icon" onClick={onLogout} title="Выйти" aria-label="Выйти"><LogOut size={18}/></button></>
        : <><button className="btn btn-text" onClick={() => onAuth('login')}>Войти</button><button className="btn btn-primary btn-small" onClick={() => onAuth('register')}>Регистрация <ArrowUpRight size={15}/></button></>}
    </div>
    <button className="mobile-menu icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Открыть меню">{open ? <X/> : <Menu/>}</button>
  </div></header>
}

function TitleLine({ eyebrow, title, desc, more, to }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>{more && <Link className="inline-link" to={to}>{more} <ArrowRight size={18}/></Link>}</div>
}

function Feature({ icon: Icon, title, desc }) {
  return <div className="feature"><div className="feature-icon"><Icon size={23}/></div><div><h3>{title}</h3><p>{desc}</p></div></div>
}

function SpecialtyCard({ spec, index }) {
  const Icon = specIcon(spec.name)
  return <Link className={`specialty-card s-${index % 6}`} to={`/doctors?specialization=${spec.id}`}>
    <div className="specialty-art"><Icon size={48} strokeWidth={1.65} /><span className="specialty-decoration" /></div>
    <div className="specialty-info"><h3>{spec.name}</h3><p>{spec.description || 'Консультация опытного специалиста'}</p><div className="specialty-more">Найти врача <ArrowUpRight size={16}/></div></div>
  </Link>
}

function Rating({ rating, showText = true }) {
  return <span className="rating"><Star size={15} fill="currentColor" /> {Number(rating) > 0 ? Number(rating).toFixed(1) : '—'}{showText && <span className="rating-muted">{Number(rating) ? ' рейтинг' : ' без отзывов'}</span>}</span>
}

function DoctorCard({ doctor, index, onBook }) {
  return <article className="doctor-card"><Link to={`/doctors/${doctor.id}`} className="doctor-photo"><Photo doctor={doctor} index={index}/><span className="doctor-tag"><BadgeCheck size={13}/> Врач клиники</span></Link>
    <div className="doctor-card-body"><span className="doctor-spec">{doctor.specialization_name || 'Врач'}</span><Link to={`/doctors/${doctor.id}`} className="doctor-name">{fullName(doctor)}</Link>
      <div className="doctor-meta"><Rating rating={doctor.avg_rating}/><span><Clock3 size={14}/> {doctor.experience_years} лет опыта</span></div>
      <div className="doctor-bottom"><div><span>Приём от</span><strong>{formatMoney(doctor.price)}</strong></div><button className="btn btn-primary btn-card" onClick={() => onBook(doctor)}>Записаться <ArrowRight size={17}/></button></div>
    </div></article>
}

function Notice({ text, onRetry }) {
  return <div className="notice-box"><AlertCircle size={26}/><div><strong>Не удалось получить данные</strong><p>{text}</p>{onRetry && <button className="btn btn-outline btn-small" onClick={onRetry}><RefreshCw size={15}/> Повторить</button>}</div></div>
}
function Empty({ icon: Icon = ClipboardList, title, text, action }) {
  return <div className="empty"><div className="empty-icon"><Icon size={31}/></div><h3>{title}</h3><p>{text}</p>{action}</div>
}

function Home({ doctors, specializations, error, loading, retry, onBook }) {
  return <>
    <section className="hero container"><div className="hero-body"><div className="hero-label"><span className="pulse-dot"/> Забота о вас каждый день</div><h1>Ваше здоровье —<br/><span>наша главная</span><br/>ценность.</h1><p>Современная медицина с человеческим подходом. Найдите своего врача и запишитесь на консультацию в несколько кликов.</p><div className="hero-buttons"><Link to="/doctors" className="btn btn-primary btn-large">Найти врача <ArrowUpRight size={19}/></Link><Link to="/specializations" className="btn btn-white btn-large">Направления <ArrowRight size={18}/></Link></div><div className="hero-note"><span className="circle-check"><Check size={14}/></span> Просто, удобно и без очередей</div></div>
      <div className="hero-visual"><div className="hero-blue-circle"/><div className="hero-grid"/><img src="/images/hero-doctor.webp" alt="Врач в современной клинике" className="hero-person"/><div className="floating-note"><span className="floating-note-icon"><HeartPulse size={23}/></span><div><strong>Забота рядом</strong><small>Ваше здоровье в надёжных руках</small></div></div></div>
      <span className="hero-shape hero-shape-a"/><span className="hero-shape hero-shape-b"/>
    </section>
    <section className="container benefits"><Feature icon={Stethoscope} title="Опытные специалисты" desc="Профессиональные врачи с проверенной практикой"/><Feature icon={CalendarCheck2} title="Быстрая запись" desc="Выбирайте удобный день и время онлайн"/><Feature icon={ShieldCheck} title="Всё в одном месте" desc="Расписание, визиты и история посещений"/></section>
    <section className="container page-section"><TitleLine eyebrow="Поможем подобрать врача" title="Медицинские направления" desc="Выберите нужную специализацию, чтобы найти подходящего специалиста." more="Все направления" to="/specializations"/>
      {error ? <Notice text={error} onRetry={retry}/> : <div className="specialty-grid">{loading ? <Loader/> : specializations.length ? specializations.slice(0, 6).map((s,i) => <SpecialtyCard key={s.id} spec={s} index={i}/>) : <Empty title="Направления пока не добавлены" text="Добавьте специализации через Django Admin."/>}</div>}
    </section>
    <section className="container page-section" id="doctors"><TitleLine eyebrow="Команда профессионалов" title="Врачи, которым доверяют" desc="Выбирайте по специализации, опыту и стоимости приёма." more="Все врачи" to="/doctors"/>
      {error ? <Notice text={error} onRetry={retry}/> : loading ? <Loader/> : doctors.length ? <div className="doctor-grid">{doctors.slice(0, 3).map((doc,i) => <DoctorCard key={doc.id} doctor={doc} index={i} onBook={onBook}/>)}</div> : <Empty title="Врачи пока не добавлены" text="В Django выполните python manage.py seed_demo или добавьте врачей в админ-панели."/>}
    </section>
    <section className="container cta-panel"><div className="cta-mark"><HeartPulse size={34}/></div><div><h2>Здоровье начинается с заботы о себе</h2><p>Запишитесь к специалисту в комфортное для вас время.</p></div><Link to="/doctors" className="btn btn-white btn-large">Выбрать врача <ArrowRight size={19}/></Link></section>
  </>
}

function Loader() { return <div className="loader"><span className="spinner"/> Загружаем данные...</div> }

function Directory({ doctors, specializations, onBook, error, loading, retry }) {
  const location = useLocation(); const navigate = useNavigate()
  const spec = new URLSearchParams(location.search).get('specialization') || ''
  const [query, setQuery] = useState(''); const [sort, setSort] = useState('default')
  const filtered = useMemo(() => {
    const list = doctors.filter((d) => (!spec || String(d.specialization) === spec) && `${fullName(d)} ${d.specialization_name}`.toLowerCase().includes(query.trim().toLowerCase()))
    if (sort === 'price') list.sort((a,b)=>Number(a.price)-Number(b.price))
    if (sort === 'experience') list.sort((a,b)=>b.experience_years-a.experience_years)
    if (sort === 'rating') list.sort((a,b)=>Number(b.avg_rating)-Number(a.avg_rating))
    return list
  }, [doctors, spec, query, sort])
  return <div className="container content-page"><div className="page-title"><div className="eyebrow">Наши специалисты</div><h1>Найдите своего врача</h1><p>Выберите специалиста, которому сможете доверить своё здоровье.</p></div>
    <div className="filter-bar"><div className="search-field"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по имени или специальности" aria-label="Поиск врачей"/></div><div className="select-wrap"><select value={spec} onChange={e=>navigate(e.target.value ? `/doctors?specialization=${e.target.value}` : '/doctors')} aria-label="Специализация"><option value="">Все направления</option>{specializations.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={16}/></div><div className="select-wrap"><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Сортировка"><option value="default">По умолчанию</option><option value="rating">По рейтингу</option><option value="experience">По опыту</option><option value="price">По цене</option></select><ChevronDown size={16}/></div></div>
    {!error && !loading && <p className="result-count">{filtered.length} {filtered.length === 1 ? 'специалист' : 'специалистов'} найдено</p>}
    {error ? <Notice text={error} onRetry={retry}/> : loading ? <Loader/> : filtered.length ? <div className="doctor-grid">{filtered.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} index={doctors.findIndex(d=>d.id===doctor.id)} onBook={onBook}/>)}</div> : <Empty icon={Search} title="Ничего не найдено" text="Попробуйте другое имя или выберите все направления." action={<button className="btn btn-outline" onClick={()=>{setQuery('');navigate('/doctors')}}>Сбросить фильтры</button>}/>}
  </div>
}

function SpecializationsPage({ specializations, error, loading, retry }) {
  return <div className="container content-page"><div className="page-title"><div className="eyebrow">Наша клиника</div><h1>Направления медицины</h1><p>Профессиональная помощь для вашего здоровья — выберите нужное направление.</p></div>
    {error ? <Notice text={error} onRetry={retry}/> : loading ? <Loader/> : specializations.length ? <div className="specialty-grid large-specialties">{specializations.map((s,i)=><SpecialtyCard key={s.id} spec={s} index={i}/>)}</div> : <Empty title="Направления пока не добавлены" text="Создайте специализации в панели администратора Django."/>}
  </div>
}

function DoctorDetails({ doctors, onBook, notify }) {
  const { id } = useParams(); const doctor = doctors.find(d=>String(d.id)===id)
  const [reviews, setReviews] = useState([]); const [schedule, setSchedule] = useState([])
  const [reviewForm, setReviewForm] = useState(false); const [reviewText, setReviewText] = useState(''); const [stars, setStars] = useState(5); const [sending, setSending] = useState(false)
  useEffect(()=>{if (!id) return;getAll(`/api/reviews/?doctor=${id}`).then(setReviews).catch(()=>setReviews([]));getAll(`/api/schedules/?doctor=${id}`).then(setSchedule).catch(()=>setSchedule([]))},[id])
  if (!doctor) return <div className="container content-page"><Empty title="Врач не найден" text="Проверьте адрес или вернитесь в каталог." action={<Link className="btn btn-primary" to="/doctors">Каталог врачей</Link>}/></div>
  const index = doctors.indexOf(doctor)
  const submitReview = async (e) => {e.preventDefault();setSending(true);try {await request('/api/reviews/',{method:'POST',data:{doctor:doctor.id,stars,comment:reviewText}});setReviewForm(false);setReviewText('');setReviews(await getAll(`/api/reviews/?doctor=${id}`));notify('Спасибо! Отзыв опубликован.')} catch(err){notify(prettyError(err),true)}finally{setSending(false)}}
  return <div className="container content-page doctor-detail-page"><Link to="/doctors" className="back-link"><ArrowLeft size={17}/> Назад к списку врачей</Link>
    <div className="doctor-detail"><div className="detail-photo"><Photo doctor={doctor} index={index}/></div><div className="detail-main"><div className="eyebrow">Наш специалист</div><h1>{fullName(doctor)}</h1><span className="specialization-badge"><Stethoscope size={15}/>{doctor.specialization_name}</span><p className="detail-intro">Профессиональный подход, внимательное отношение и индивидуальная консультация для каждого пациента.</p>
      <div className="detail-stats"><div><Star size={21}/><strong>{Number(doctor.avg_rating)>0?Number(doctor.avg_rating).toFixed(1):'—'}</strong><span>рейтинг</span></div><div><Clock3 size={21}/><strong>{doctor.experience_years}</strong><span>лет опыта</span></div><div><CalendarDays size={21}/><strong>{doctor.appointment_count ?? 0}</strong><span>записей</span></div></div>
      <div className="detail-bottom"><div><span>Стоимость консультации</span><strong>{formatMoney(doctor.price)}</strong></div><button className="btn btn-primary btn-large" onClick={()=>onBook(doctor)}>Записаться на приём <ArrowRight size={19}/></button></div>
    </div></div>
    <div className="details-sections"><section className="white-panel"><h2><CalendarDays size={21}/> График приёма</h2><p className="small-muted">Доступные дни и часы по времени Бишкека</p>{schedule.length ? <div className="schedule-list">{schedule.map(s=><div key={s.id}><span>{s.day_name}</span><strong>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</strong></div>)}</div>:<p className="small-muted">Расписание ещё не добавлено.</p>}</section>
      <section className="white-panel"><div className="panel-head"><h2><MessageSquare size={21}/> Отзывы пациентов <span className="number-pill">{reviews.length}</span></h2><button className="btn btn-outline btn-small" onClick={()=>setReviewForm(v=>!v)}>Оставить отзыв</button></div>
        {reviewForm && <form className="review-form" onSubmit={submitReview}><label>Ваша оценка</label><div className="star-selector">{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} звёзд`} onClick={()=>setStars(n)}><Star size={25} fill={n<=stars?'currentColor':'none'} className={n<=stars?'chosen':''}/></button>)}</div><textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Поделитесь впечатлениями (необязательно)" rows={3}/><button className="btn btn-primary btn-small" disabled={sending}>{sending?'Отправляем...':'Отправить отзыв'}</button></form>}
        {reviews.length ? <div className="review-list">{reviews.slice(0,8).map(r=><div className="review-item" key={r.id}><span className="review-stars">{'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</span><small>{formatDate(r.created_date)}</small>{r.comment && <p>{r.comment}</p>}</div>)}</div>:<p className="small-muted">Пока нет отзывов. Вы можете оставить первый.</p>}
      </section></div>
  </div>
}

function AuthModal({ mode, onClose, onSuccess, notify }) {
  const [tab, setTab] = useState(mode)
  const [form, setForm] = useState({username:'',password:'',password_confirm:'',first_name:'',last_name:'',email:'',phone_number:''})
  const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const update = (e)=>setForm(s=>({...s,[e.target.name]:e.target.value}))
  const submit = async(e)=>{e.preventDefault();setLoading(true);setError('');try {if(tab==='register'){await request('/api/register/',{method:'POST',data:form,token:null})} const auth=await request('/api/login/',{method:'POST',data:{username:form.username,password:form.password},token:null});setToken(auth.token);const me=await request('/api/me/');onSuccess(me);notify(tab==='register'?'Аккаунт создан. Добро пожаловать!':'Вы успешно вошли.')}catch(err){setError(prettyError(err))}finally{setLoading(false)}}
  return <Modal onClose={onClose} className="auth-modal"><div className="modal-top-brand"><span className="modal-brand-icon"><HeartPulse size={25}/></span><span>hospital<span className="brand-dot">.</span></span></div><h2>{tab==='login'?'С возвращением!':'Создайте аккаунт'}</h2><p className="modal-subtitle">{tab==='login'?'Войдите, чтобы управлять своими визитами':'Записывайтесь на приём и храните историю посещений'}</p>
    <div className="tabs"><button className={tab==='login'?'active':''} onClick={()=>{setTab('login');setError('')}}>Вход</button><button className={tab==='register'?'active':''} onClick={()=>{setTab('register');setError('')}}>Регистрация</button></div>
    <form onSubmit={submit} className="form-layout">{tab==='register' && <div className="form-row"><label>Имя<input name="first_name" value={form.first_name} onChange={update} placeholder="Ваше имя"/></label><label>Фамилия<input name="last_name" value={form.last_name} onChange={update} placeholder="Фамилия"/></label></div>}
      <label>Логин<input name="username" autoComplete="username" value={form.username} onChange={update} placeholder="Придумайте логин" required/></label>
      {tab==='register' && <><label>Электронная почта<input name="email" type="email" value={form.email} onChange={update} placeholder="example@mail.com"/></label><label>Номер телефона<input name="phone_number" value={form.phone_number} onChange={update} placeholder="+996 700 000 000"/></label></>}
      <label>Пароль<input name="password" type="password" autoComplete={tab==='register'?'new-password':'current-password'} value={form.password} onChange={update} placeholder="Введите пароль" required/></label>
      {tab==='register' && <label>Повторите пароль<input name="password_confirm" type="password" autoComplete="new-password" value={form.password_confirm} onChange={update} placeholder="Повторите пароль" required/></label>}
      {error && <div className="form-error"><AlertCircle size={16}/>{error}</div>}
      <button className="btn btn-primary btn-submit" disabled={loading}>{loading?'Подождите...':tab==='login'?'Войти в аккаунт':'Зарегистрироваться'} <ArrowRight size={18}/></button>
    </form><p className="auth-hint"><LockKeyhole size={14}/> Учебный проект. Не вводите реальные медицинские данные.</p>
  </Modal>
}

function Modal({ onClose, children, className = '' }) {
  useEffect(()=>{const onEsc=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onEsc);document.body.style.overflow='hidden';return()=>{window.removeEventListener('keydown',onEsc);document.body.style.overflow=''}},[onClose])
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><div className={`modal-card ${className}`} role="dialog" aria-modal="true"><button onClick={onClose} className="modal-close" aria-label="Закрыть"><X size={21}/></button>{children}</div></div>
}

function BookModal({ doctor, onClose, onBooked, notify }) {
  const [date, setDate] = useState(()=>dateInBishkek(new Date(Date.now()+86400000)))
  const [time, setTime] = useState('');const [complaint, setComplaint] = useState('');const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(false);const [error, setError] = useState('');const [scheduleError, setScheduleError] = useState('')
  useEffect(()=>{getAll(`/api/schedules/?doctor=${doctor.id}`).then(setSchedule).catch(e=>setScheduleError(prettyError(e)))},[doctor.id])
  const dayNumber = new Date(`${date}T12:00:00Z`).getUTCDay(); const dayIndex = (dayNumber+6)%7; // monday = 0
  const rawSlots = schedule.filter(s=>Number(s.day_of_week)===dayIndex).flatMap(s=>{
    const min=(v)=>{const[h,m]=v.split(':').map(Number);return h*60+m};const out=[];for(let i=min(s.start_time);i<min(s.end_time);i+=30){out.push(`${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`)}return out
  })
  const slots = [...new Set(rawSlots)].sort().filter(t=>new Date(`${date}T${t}:00+06:00`).getTime()>Date.now())
  const submit = async(e)=>{e.preventDefault();if(!time){setError('Выберите время приёма.');return}setLoading(true);setError('');try{await request('/api/appointments/',{method:'POST',data:{doctor:doctor.id,date_time:`${date}T${time}:00+06:00`,complaint:complaint.trim()}});notify('Вы записаны! Статус приёма: ожидает подтверждения.');onBooked();onClose()}catch(err){setError(prettyError(err))}finally{setLoading(false)}}
  return <Modal onClose={onClose} className="booking-modal"><div className="eyebrow">Онлайн-запись</div><h2>Запись на приём</h2><div className="booking-doctor"><Photo doctor={doctor} index={doctor.id%photoList.length}/><div><strong>{fullName(doctor)}</strong><span>{doctor.specialization_name}</span><b>{formatMoney(doctor.price)}</b></div></div>
    <form onSubmit={submit} className="form-layout"><label>Выберите дату<input type="date" min={dateInBishkek(new Date())} value={date} onChange={e=>{setDate(e.target.value);setTime('')}} required/></label>
      <div><label className="label-block">Время консультации <span className="hint-inline">(Бишкек, UTC+6)</span></label>{scheduleError ? <div className="form-error">{scheduleError}</div> : slots.length ? <div className="time-grid">{slots.map(t=><button type="button" key={t} onClick={()=>setTime(t)} className={time===t?'selected':''}>{t}</button>)}</div>:<p className="no-slots">На эту дату нет подходящих часов приёма. Попробуйте другой день.</p>}<p className="booking-hint">Предлагаемое время. Окончательную доступность проверит сервер при записи.</p></div>
      <label>Причина обращения<textarea rows="3" value={complaint} onChange={e=>setComplaint(e.target.value)} required placeholder="Кратко напишите, что вас беспокоит"/></label>{error && <div className="form-error"><AlertCircle size={16}/>{error}</div>}
      <button className="btn btn-primary btn-submit" disabled={loading || !time}>{loading?'Отправляем...':'Подтвердить запись'} <ArrowRight size={18}/></button></form>
  </Modal>
}

function Appointments({ user, onAuth, doctors, notify }) {
  const [list, setList] = useState([]);const [records, setRecords] = useState([]);const [filter, setFilter] = useState('all');const [loading, setLoading] = useState(true);const [error, setError] = useState('');const [busy, setBusy] = useState(null)
  const refresh = useCallback(async()=>{if(!user){setLoading(false);return}setLoading(true);setError('');try{const[a,r]=await Promise.all([getAll('/api/appointments/'),getAll('/api/medical-records/')]);setList(a);setRecords(r)}catch(err){setError(prettyError(err))}finally{setLoading(false)}},[user])
  useEffect(()=>{refresh()},[refresh])
  if(!user)return <div className="container content-page"><Empty icon={LockKeyhole} title="Войдите в аккаунт" text="Чтобы увидеть историю записей и медицинские записи, авторизуйтесь." action={<button className="btn btn-primary" onClick={()=>onAuth('login')}>Войти</button>}/></div>
  const filtered=list.filter(a=>filter==='all'||a.status===filter)
  const cancel=async(id)=>{if(!window.confirm('Отменить эту запись на приём?'))return;setBusy(id);try{await request(`/api/appointments/${id}/`,{method:'PATCH',data:{status:'cancelled'}});notify('Запись отменена.');await refresh()}catch(err){notify(prettyError(err),true)}finally{setBusy(null)}}
  const foundDoctor=id=>doctors.find(d=>d.id===id)
  return <div className="container content-page"><div className="page-title"><div className="eyebrow">Личный кабинет</div><h1>Мои записи</h1><p>Следите за приёмами и историей посещений в одном месте.</p></div>
    <div className="appointment-filter">{[['all','Все'],['pending','Ожидают'],['confirmed','Подтверждённые'],['completed','Завершённые'],['cancelled','Отменённые']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>
    {error ? <Notice text={error} onRetry={refresh}/> : loading?<Loader/>:filtered.length?<div className="appointment-list">{filtered.map((app)=>{const doctor=foundDoctor(app.doctor);const record=app.medical_record || records.find(r=>r.appointment===app.id);return <article key={app.id} className="appointment-card"><div className="appointment-doctor"><div className="appointment-avatar">{doctor?<Photo doctor={doctor} index={doctors.indexOf(doctor)}/>:<UserRound size={31}/>}</div><div><span className="doctor-spec">{doctor?.specialization_name||'Консультация'}</span><h3>{app.doctor_name||fullName(doctor)||`Врач №${app.doctor}`}</h3><span className="appointment-date"><CalendarDays size={16}/>{formatDate(app.date_time)} <Clock3 size={16}/>{timeFor(app.date_time)}</span></div></div><div className="appointment-actions"><span className={`status status-${app.status}`}>{stateLabels[app.status]||app.status}</span>{['pending','confirmed'].includes(app.status)&&<button className="btn btn-outline btn-small cancel-btn" disabled={busy===app.id} onClick={()=>cancel(app.id)}>{busy===app.id?'Отменяем...':'Отменить запись'}</button>}</div><div className="appointment-extra"><strong>Причина обращения:</strong> {app.complaint||'—'}{record&&<div className="medical-record"><strong><FileHeart size={18}/> Медицинская запись</strong><p><b>Диагноз:</b> {record.diagnosis}</p><p><b>Назначения:</b> {record.prescription}</p></div>}</div></article>})}</div>:<Empty icon={CalendarDays} title="Пока нет записей" text="Запишитесь к специалисту — ваши приёмы появятся здесь." action={<Link className="btn btn-primary" to="/doctors">Выбрать врача <ArrowRight size={18}/></Link>}/>}
  </div>
}

function Profile({ user, setUser, onAuth, onLogout, notify }) {
  const [form,setForm] = useState({});const [loading,setLoading] = useState(false);const [error,setError] = useState('')
  useEffect(()=>{if(user)setForm({first_name:user.first_name||'',last_name:user.last_name||'',email:user.email||'',phone_number:user.phone_number||'',birth_date:user.birth_date||'',address:user.address||'',blood_group:user.blood_group||''})},[user])
  if(!user)return <div className="container content-page"><Empty icon={UserRound} title="Профиль недоступен" text="Пожалуйста, войдите в аккаунт." action={<button className="btn btn-primary" onClick={()=>onAuth('login')}>Войти</button>}/></div>
  const submit=async(e)=>{e.preventDefault();setLoading(true);setError('');try{const me=await request('/api/me/',{method:'PATCH',data:form});setUser(me);notify('Профиль успешно обновлён.')}catch(err){setError(prettyError(err))}finally{setLoading(false)}}
  const update=e=>setForm(s=>({...s,[e.target.name]:e.target.value}))
  return <div className="container content-page"><div className="page-title"><div className="eyebrow">Личный кабинет</div><h1>Мой профиль</h1><p>Ваши личные данные и контактная информация.</p></div><div className="profile-layout"><aside className="profile-side white-panel"><div className="profile-avatar">{(user.first_name||user.username)[0].toUpperCase()}</div><h2>{[user.first_name,user.last_name].filter(Boolean).join(' ')||user.username}</h2><p>@{user.username}</p><div className="profile-divider"/><Link to="/appointments" className="profile-side-link"><CalendarDays size={18}/> Мои записи <ArrowRight size={16}/></Link><button onClick={onLogout} className="profile-side-link logout-side"><LogOut size={18}/> Выйти</button></aside>
    <section className="profile-form white-panel"><div className="panel-head"><h2>Личные данные</h2><span className="safe-badge"><ShieldCheck size={16}/> Личный кабинет</span></div><form onSubmit={submit} className="form-layout"><div className="form-row"><label>Имя<input name="first_name" value={form.first_name||''} onChange={update}/></label><label>Фамилия<input name="last_name" value={form.last_name||''} onChange={update}/></label></div><div className="form-row"><label>Электронная почта<input type="email" name="email" value={form.email||''} onChange={update}/></label><label>Номер телефона<input name="phone_number" value={form.phone_number||''} onChange={update}/></label></div><div className="form-row"><label>Дата рождения<input type="date" name="birth_date" value={form.birth_date||''} onChange={update}/></label><label>Группа крови<select name="blood_group" value={form.blood_group||''} onChange={update}>{bloodGroups.map(g=><option key={g} value={g}>{g||'Не указана'}</option>)}</select></label></div><label>Адрес<input name="address" value={form.address||''} onChange={update} placeholder="Ваш адрес"/></label>{error&&<div className="form-error"><AlertCircle size={17}/>{error}</div>}<button className="btn btn-primary profile-save" disabled={loading}>{loading?'Сохраняем...':'Сохранить изменения'} <Check size={18}/></button></form></section></div></div>
}

function Footer(){return <footer className="footer"><div className="container footer-top"><div><Brand/><p>Медицина с человеческим подходом.<br/>Забота о вашем здоровье начинается здесь.</p></div><div className="footer-links"><Link to="/doctors">Наши врачи</Link><Link to="/specializations">Направления</Link><Link to="/appointments">Мои записи</Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} hospital. Учебный проект</span><span>Демо-сайт · Не используйте реальные медицинские данные</span></div></footer>}

export default function App() {
  const [doctors,setDoctors] = useState([]);const [specializations,setSpecializations] = useState([])
  const [loading,setLoading] = useState(true);const [error,setError] = useState('')
  const [user,setUser] = useState(null);const [authMode,setAuthMode] = useState(null)
  const [bookDoc,setBookDoc] = useState(null);const [afterAuth,setAfterAuth] = useState(null)
  const [toast,setToast] = useState(null)
  const [visitsVersion,setVisitsVersion] = useState(0)
  const location=useLocation();const navigate=useNavigate()
  const notify=(message,isError=false)=>{setToast({message:String(message),isError});window.setTimeout(()=>setToast(null),5000)}
  const loadData=useCallback(async()=>{setLoading(true);setError('');try{const[d,s]=await Promise.all([getAll('/api/doctors/'),getAll('/api/specializations/')]);setDoctors(d);setSpecializations(s)}catch(err){setError(prettyError(err))}finally{setLoading(false)}},[])
  useEffect(()=>{loadData()},[loadData]);useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[location.pathname])
  useEffect(()=>{if(getToken())request('/api/me/').then(setUser).catch(()=>{setToken(null);setUser(null)})},[])
  const logout=async()=>{try{await request('/api/logout/',{method:'POST'})}catch{/* expire locally even when offline */}setToken(null);setUser(null);navigate('/');notify('Вы вышли из аккаунта.')}
  const askBook=(doctor)=>{if(!getToken()||!user){setAfterAuth(doctor);setAuthMode('login')}else setBookDoc(doctor)}
  const loginSuccess=(me)=>{setUser(me);setAuthMode(null);if(afterAuth){setBookDoc(afterAuth);setAfterAuth(null)}}
  return <><Header user={user} onAuth={setAuthMode} onLogout={logout}/><main><Routes>
    <Route path="/" element={<Home doctors={doctors} specializations={specializations} error={error} loading={loading} retry={loadData} onBook={askBook}/>}/>
    <Route path="/doctors" element={<Directory doctors={doctors} specializations={specializations} error={error} loading={loading} retry={loadData} onBook={askBook}/>}/>
    <Route path="/doctors/:id" element={loading?<Loader/>:<DoctorDetails doctors={doctors} onBook={askBook} notify={notify}/>}/>
    <Route path="/specializations" element={<SpecializationsPage specializations={specializations} error={error} loading={loading} retry={loadData}/>}/>
    <Route path="/appointments" element={<Appointments key={`${user?.id||'guest'}-${visitsVersion}`} user={user} onAuth={setAuthMode} doctors={doctors} notify={notify}/>}/>
    <Route path="/profile" element={<Profile user={user} setUser={setUser} onAuth={setAuthMode} onLogout={logout} notify={notify}/>}/>
    <Route path="*" element={<div className="container content-page"><Empty title="Страница не найдена" text="Такой страницы здесь нет." action={<Link className="btn btn-primary" to="/">На главную</Link>}/></div>}/>
  </Routes></main><Footer/>
    {authMode&&<AuthModal mode={authMode} onClose={()=>{setAuthMode(null);setAfterAuth(null)}} onSuccess={loginSuccess} notify={notify}/>}
    {bookDoc&&<BookModal doctor={bookDoc} onClose={()=>setBookDoc(null)} onBooked={()=>setVisitsVersion(v=>v+1)} notify={notify}/>}
    {toast&&<div className={`toast ${toast.isError?'toast-error':''}`} role="status">{toast.isError?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>} {toast.message}<button onClick={()=>setToast(null)} aria-label="Закрыть"><X size={16}/></button></div>}
  </>
}

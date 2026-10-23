const TOKEN_KEY = 'hospital_auth_token'
export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (value) => value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY)

function messageFromResponse(body) {
  if (!body || typeof body !== 'object') return 'Ошибка запроса. Попробуйте позже.'
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.non_field_errors)) return body.non_field_errors.join(' ')
  return Object.entries(body).map(([key, value]) => `${key === 'date_time' ? 'Дата и время' : key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : JSON.stringify(value)}`).join(' • ')
}

export async function request(path, { method = 'GET', data, token = getToken() } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    })
  } catch {
    throw new Error('Нет соединения с сервером Django. Запустите python manage.py runserver на порту 8000.')
  }
  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('json') ? await response.json() : null
  if (!response.ok) {
    const error = new Error(messageFromResponse(result) || `Ошибка ${response.status}`)
    error.status = response.status
    throw error
  }
  return result
}

/** Django REST Framework uses 10-item pagination and returns absolute next URLs. */
export async function getAll(path) {
  const output = []
  let next = path
  for (let page = 0; next && page < 50; page++) {
    // Normalize absolute http://127.0.0.1:8000/api/... links to relative paths
    // so every request goes through Vite's local proxy.
    const normalized = next.startsWith('http') ? new URL(next).pathname + new URL(next).search : next
    const result = await request(normalized)
    if (Array.isArray(result)) return [...output, ...result]
    if (!result || !Array.isArray(result.results)) throw new Error('Сервер вернул неожиданный ответ.')
    output.push(...result.results)
    next = result.next
  }
  return output
}

export function mediaUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.pathname.startsWith('/media/')) return parsed.pathname + parsed.search
    return url
  } catch { return url }
}

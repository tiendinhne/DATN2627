const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function register(data: { email: string; username: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'Đăng ký thất bại');
  return res.json(); // { accessToken, user }
}

export async function login(data: { identifier: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'Sai tài khoản hoặc mật khẩu');
  return res.json(); // { accessToken, user }
}

// Nút "Đăng nhập với Google" chỉ cần redirect thẳng sang backend, không cần fetch
export function loginWithGoogle() {
  window.location.href = `${API_URL}/auth/google`;
}

export async function getCurrentUser(token: string) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Chưa đăng nhập hoặc token hết hạn');
  return res.json();
}

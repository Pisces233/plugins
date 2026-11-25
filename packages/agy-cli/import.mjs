// Accounts brought in from a sign-in made with Antigravity's own Google
// OAuth client, so agy, which signs in with that same client, takes them
// as its own: nothing is sent anywhere but where agy already sends its
// sign-in (Google), and no other client is spoken for.
//
// Two kinds are taken, and only these, since each is known to come from
// that client:
//   - the retired Antigravity plugin's (@magpie-community/opencode-
//     antigravity-auth, provider "antigravity") saved sign-in: an oauth
//     entry whose refresh is "<refresh token>|<Code Assist project>", with
//     the access token, its expiry (ms) and the email as accountId; one,
//     a list, or a map of them (magpie's plugin-auth.json);
//   - agy's own stored sign-in, the JSON of its token file
//     ({"token":{access_token, refresh_token, expiry, …}, "id_token_email"}).
// A refresh token pasted or typed on its own ("Sign in with a refresh
// token", a Cockpit Tools export's rt) is Antigravity's own too: agy
// signs in with Antigravity's OAuth client, so it takes only a token that
// client's, and another client's is refused by Google when agy trades it,
// which the account's check says.
//
// Each account becomes the value agy keeps in its token file
// (.gemini/antigravity-cli/antigravity-oauth-token), the same JSON agy
// writes: agy renews the access token itself on its first run.

function str(v) {
  return typeof v === "string" ? v.trim() : ""
}

// fromPlugin is the account a retired Antigravity plugin's entry holds, or
// null when the value isn't one.
function fromPlugin(v) {
  if (!v || typeof v !== "object" || v.type !== "oauth" || typeof v.refresh !== "string") return null
  const refresh = v.refresh.split("|")[0].trim()
  if (!refresh) return null
  const expires = Number(v.expires)
  return {
    email: str(v.accountId) || str(v.metadata?.email),
    refresh,
    access: str(v.access),
    expires: Number.isFinite(expires) && expires > 0 ? expires : 0,
  }
}

// fromAgy is the account agy's own stored sign-in holds, or null.
function fromAgy(v) {
  const t = v?.token
  if (!t || typeof t !== "object" || typeof t.refresh_token !== "string" || !t.refresh_token.trim()) return null
  const at = Date.parse(t.expiry ?? "")
  return {
    email: str(v.id_token_email),
    refresh: t.refresh_token.trim(),
    access: str(t.access_token),
    expires: Number.isFinite(at) && at > 0 ? at : 0,
  }
}

// fromRefreshText is the account one text holds when it is a refresh
// token alone (an export's rt, a copied line): "1//…", one unbroken run,
// never a key, an address or a page of text. Email may follow it on the
// same line or be said nowhere: it only names the account; agy says who
// it is signed in to when it isn't given.
export function fromRefreshText(text) {
	const t = String(text ?? "").trim()
	if (!t) return null
	const parts = t.split(/\s+/)
	if (parts.length > 2) return null
	const token = parts[0]
	if (!/^1\/\/[A-Za-z0-9_-]+$/.test(token)) return null
	const extra = parts[1] ?? ""
	if (extra && !/^[^\s@]+@[^\s@]+$/.test(extra)) return null
	return {
		email: extra.slice(0, 200),
		refresh: token,
		access: "",
		expires: 0,
	}
}

function decode(text) {
  let value = String(text ?? "").trim()
  if (value.startsWith("go-keyring-base64:")) value = Buffer.from(value.slice(18), "base64").toString("utf8")
  try { return JSON.parse(value) } catch { return undefined }
}

// importedAccounts is every account the texts hold, one per refresh token,
// in order: [{ email, refresh, access, expires }].
export function importedAccounts(texts) {
  const out = []
  const seen = new Set()
  const add = (a) => {
    if (!a || seen.has(a.refresh)) return
    seen.add(a.refresh)
    out.push(a)
  }
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 2) return
    const a = fromPlugin(v) ?? fromAgy(v)
    if (a) return add(a)
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, depth + 1)
  }
  for (const text of Array.isArray(texts) ? texts : [texts]) walk(decode(text), 0)
	for (const text of Array.isArray(texts) ? texts : [texts]) {
		if (decode(text) === undefined) add(fromRefreshText(text))
	}
  return out
}

// tokenFileText is what agy keeps in its token file for the account a.
export function tokenFileText(a) {
  return JSON.stringify({
    token: {
      access_token: a.access,
      token_type: "Bearer",
      refresh_token: a.refresh,
      // with no expiry said, the access token is taken as ended (not Go's
      // zero time, which agy reads as "never ends"): agy renews it first
      expiry: new Date(a.expires || 0).toISOString(),
    },
    auth_method: "consumer",
    ...(a.email ? { id_token_email: a.email } : {}),
  })
}

// IMPORT_FROM says what magpie's "Import accounts from a file…" takes.
export const IMPORT_FROM = {
	en: "Choose or paste a sign-in from the retired Antigravity plugin, agy's own token file (antigravity-oauth-token), or a Google OAuth refresh token (1//…) on a line of its own. They are Antigravity's own Google sign-ins, which agy takes as they are; each account is checked with agy before it is added.",
  froms: {
		zh: "选择或粘贴已退役的 Antigravity 插件的登录记录、agy 自己的令牌文件（antigravity-oauth-token），或单独一行的 Google OAuth refresh token（1//…）。它们本就是 Antigravity 自己的 Google 登录，agy 可以直接使用；每个账号先由 agy 检查再添加。",
		"zh-TW": "選擇或貼上已退役的 Antigravity 外掛的登入記錄、agy 自己的權杖檔（antigravity-oauth-token），或單獨一行的 Google OAuth refresh token（1//…）。它們本就是 Antigravity 自己的 Google 登入，agy 可以直接使用；每個帳號先由 agy 檢查再加入。",
		ja: "引退した Antigravity プラグインのサインイン、agy 自身のトークンファイル（antigravity-oauth-token）、または単独1行の Google OAuth リフレッシュトークン（1//…）を選ぶか貼り付けてください。どれも Antigravity 自身の Google サインインなので、agy はそのまま使えます。各アカウントは追加前に agy で確認します。",
  },
}

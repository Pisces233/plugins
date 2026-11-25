import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import path from "node:path"
import { createBridgeKit } from "./testkit.mjs"

const RT = "1//gE_refresh_token_for_test"

test("a pasted refresh token becomes the account home's sign-in, checked by agy models", async () => {
  const kit = await createBridgeKit()
  try {
    const method = kit.plugin.auth.methods[2]
    assert.equal(method.type, "api")
    const r = await method.authorize({ refresh_token: RT, email: "rt@example.com" })
    assert.equal(r.type, "success", JSON.stringify(r))
    assert.match(r.key, /^agy:[a-z0-9]{16}$/)
    assert.equal(r.metadata.email, "rt@example.com")
    const homeId = r.metadata.agyHome
    const token = JSON.parse(fs.readFileSync(path.join(kit.env.XDG_STATE_HOME, "magpie-agy-bridge", "accounts", homeId, ".gemini", "antigravity-cli", "antigravity-oauth-token"), "utf8"))
    assert.equal(token.token.refresh_token, RT)
    assert.equal(token.id_token_email, "rt@example.com")
    assert.equal(kit.modelsSpawns.length >= 1, true)
  } finally { await kit.dispose() }
})

test("a bad rt is refused before agy runs; a refused one drops the home", async () => {
  const kit = await createBridgeKit({ modelsBehavior: { code: 1, stderr: "unauthorized_client: bad token" } })
  try {
    const method = kit.plugin.auth.methods[2]
    assert.equal((await method.authorize({ refresh_token: "sk-ant-oat1" })).type, "failed")
    const r = await method.authorize({ refresh_token: RT })
    assert.equal(r.type, "failed")
    const dir = path.join(kit.env.XDG_STATE_HOME, "magpie-agy-bridge", "accounts")
    assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir) : [], [])
  } finally { await kit.dispose() }
})

test("an rt line imports the same way as a file", async () => {
  const kit = await createBridgeKit()
  try {
    const results = await kit.plugin.auth.import(["1//rt_imported imp@example.com", "not a token"])
    const ok = results.find(x => x.type === "success")
    assert.equal(ok.metadata.email, "imp@example.com")
    assert.equal(results.length, 1) // invalid line is ignored, not an account
  } finally { await kit.dispose() }
})

import assert from "node:assert/strict";
import test from "node:test";
import handler from "../src/main.js";

const res = { json: (body, status = 200, headers = {}) => ({ body, status, headers }) };
const context = (path, method = "GET") => ({
  req: { path, url: `https://function.local${path}`, method, headers: {} },
  res,
  log: () => {},
  error: () => {},
});

test("returns 404 for an unknown route", async () => {
  const response = await handler(context("/unknown"));
  assert.equal(response.status, 404);
});

test("rejects malformed QR tokens before accessing Appwrite", async () => {
  const response = await handler(context("/pets/not-a-token"));
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Invalid QR token.");
});

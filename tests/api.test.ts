import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../server/app";
async function fixture(t: TestContext) {
  const { app, db } = createApp(":memory:", false),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return async (
    path: string,
    method = "GET",
    body?: unknown,
    headers?: Record<string, string>,
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api${path}`,
      {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  };
}
test("booking rejects overlapping and contained intervals; accepts adjacency and different resource", async (t) => {
  const call = await fixture(t),
    payload = {
      resource: "Room A",
      guest: "Alex",
      starts_at: "2026-11-01T10:00:00Z",
      ends_at: "2026-11-01T11:00:00Z",
    };
  assert.equal((await call("/bookings", "POST", payload)).status, 201);
  assert.equal(
    (
      await call("/bookings", "POST", {
        ...payload,
        starts_at: "2026-11-01T10:30:00Z",
        ends_at: "2026-11-01T12:00:00Z",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/bookings", "POST", {
        ...payload,
        starts_at: "2026-11-01T10:15:00Z",
        ends_at: "2026-11-01T10:45:00Z",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/bookings", "POST", {
        ...payload,
        starts_at: "2026-11-01T11:00:00Z",
        ends_at: "2026-11-01T12:00:00Z",
      })
    ).status,
    201,
  );
  assert.equal(
    (await call("/bookings", "POST", { ...payload, resource: "Room B" }))
      .status,
    201,
  );
});

test("booking validates date order and malformed timestamps; cancellation releases resource", async (t) => {
  const call = await fixture(t),
    payload = {
      resource: "Room",
      guest: "Sam",
      starts_at: "2026-11-01T10:00:00Z",
      ends_at: "2026-11-01T11:00:00Z",
    };
  assert.equal(
    (
      await call("/bookings", "POST", {
        ...payload,
        ends_at: payload.starts_at,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/bookings", "POST", { ...payload, starts_at: "tomorrow" }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("/bookings", "POST", {
        ...payload,
        starts_at: "2026-02-30T10:00:00Z",
      })
    ).status,
    400,
  );
  const b = await call("/bookings", "POST", payload);
  assert.equal((await call("/bookings/" + b.data.id, "DELETE")).status, 204);
  assert.equal((await call("/bookings", "POST", payload)).status, 201);
});

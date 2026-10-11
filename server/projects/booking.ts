import type { Express } from "express";
import type { Store } from "../store";
import { fail, text, integer, date } from "../validation";

export function registerBooking(
  app: Express,
  { all, one, run, transaction }: Store,
) {
  app.get("/api/bookings", (_req, res) =>
    res.json(all("SELECT * FROM bookings ORDER BY starts_at")),
  );
  app.post("/api/bookings", (req, res) => {
    const resource = text(req.body.resource, "Resource", 80),
      guest = text(req.body.guest, "Guest", 80);
    const start = date(req.body.starts_at, "Start"),
      end = date(req.body.ends_at, "End");
    if (end <= start) fail(400, "End must be after start.");
    const id = transaction(() => {
      if (
        one(
          "SELECT id FROM bookings WHERE resource=? AND starts_at<? AND ends_at>?",
          resource,
          end,
          start,
        )
      )
        fail(409, "This resource already has an overlapping booking.");
      return Number(
        run(
          "INSERT INTO bookings(resource,guest,starts_at,ends_at) VALUES(?,?,?,?)",
          resource,
          guest,
          start,
          end,
        ).lastInsertRowid,
      );
    });
    res.status(201).json(one("SELECT * FROM bookings WHERE id=?", id));
  });
  app.delete("/api/bookings/:id", (req, res) => {
    if (
      !run(
        "DELETE FROM bookings WHERE id=?",
        integer(Number(req.params.id), "Booking ID", 1),
      ).changes
    )
      fail(404, "Booking not found.");
    res.status(204).end();
  });
}

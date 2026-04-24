// Bearer-token auth middleware. Token is compared with a constant-time
// check against process.env.CONTROL_PLANE_TOKEN. Skips /health so an
// unauthenticated liveness probe is possible.

import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function bearerAuth(token) {
  if (!token) {
    throw new Error("bearerAuth: token is required");
  }
  return (req, res, next) => {
    if (req.path === "/health") return next();
    const header = req.header("authorization") ?? "";
    const [scheme, provided] = header.split(" ");
    if (scheme !== "Bearer" || !provided) {
      return res.status(401).json({ error: "Unauthorized", message: "missing bearer token" });
    }
    if (!safeEqual(provided, token)) {
      return res.status(401).json({ error: "Unauthorized", message: "invalid token" });
    }
    next();
  };
}

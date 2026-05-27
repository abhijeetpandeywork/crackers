import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import http from "http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestId } from "./middleware/request-id";
import { UPLOAD_DIR } from "./routes/v1/media.js";

const app: Express = express();

// Trust the upstream Replit proxy so the rate-limiter sees real client IPs.
app.set("trust proxy", 1);

// Lightweight Subdomain Reverse Proxy Middleware
// Only active in local development — in production, Nginx handles all routing.
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    const url = req.url || "";

    // Force local environment domain resolving logic
    // API server handles its own subdomain, /api endpoints, and public /uploads
    if (
      host.startsWith("api.") ||
      url.startsWith("/api") ||
      url.startsWith("/uploads") ||
      url.startsWith("/healthz")
    ) {
      return next();
    }

    let targetPort = 0;
    if (host.startsWith("erp.")) {
      targetPort = 5173;
    } else if (host.startsWith("pos.")) {
      targetPort = 5174;
    } else if (host.startsWith("warehouse.")) {
      targetPort = 5175;
    } else {
      // Default to Website storefront
      targetPort = 5176;
    }

    const options = {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      logger.warn({ err, host, url }, "Subdomain proxy request failed");
      res.status(502).send("Frontend server is starting up or unavailable. Please reload in a few seconds.");
    });

    req.pipe(proxyReq, { end: true });
  });
}

// Security headers: HSTS, X-Frame-Options, no-sniff, referrer policy, etc.
// CSP is left unset because the API is consumed cross-origin by 4 frontends
// and a custom CSP would belong on each frontend's static host.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Generous default limit to absorb burst traffic from POS terminals while
// stopping single-source flooders. Tighter limits are applied per-route
// (see routes/v1/auth.ts).
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests, please slow down." } },
});
app.use(generalLimiter);

// Stamp every request with a stable id (honoring upstream X-Request-Id) so
// log lines and error responses can be correlated end-to-end.
app.use(requestId);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Dev-mode fallback: Serve uploaded media at root /uploads path
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "30d",
    immutable: true,
  })
);

app.use("/api", router);

export default app;

const cors = require("cors");

const allowed = new Set([
  "https://lakeridepros.xyz",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    cb(null, allowed.has(origin));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Auth-Token"]
});

module.exports = { corsMiddleware };

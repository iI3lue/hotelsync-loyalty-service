import express from "express";
import { startConsumer } from "./lib/consumer";
import { errorHandler } from "./middleware/error-handler";
import { levelsRouter } from "./routes/levels";
import { loyaltyRouter } from "./routes/loyalty";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Registrar rutas (montaje directo bajo /v1, como el resto de servicios,
// para que el rewrite /api/loyalty/:path* del front resuelva 1:1)
app.use("/v1/levels", levelsRouter); // GET /v1/levels
app.use("/v1/me", loyaltyRouter); // GET /v1/me y POST /v1/me/redeem
app.use("/v1/admin", adminRouter); // /v1/admin/users/:userId/loyalty y /v1/admin/points

// Manejador centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3009;

app.listen(PORT, async () => {
  console.log(`[loyalty-service] Servidor corriendo en puerto ${PORT}`);
  try {
    await startConsumer();
  } catch (error) {
    console.error("[loyalty-service] Error iniciando RabbitMQ consumer:", error);
  }
});

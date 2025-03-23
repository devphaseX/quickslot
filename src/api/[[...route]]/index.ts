import app from "@/server";
import { handle } from "hono/vercel";

const handler = handle(app);
export { handler as POST, handler as GET, handler as PUT, handler as DELETE };

import { clearSessionCookie } from "@/lib/auth";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function POST() {
  try {
    const response = jsonOk({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

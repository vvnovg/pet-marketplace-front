import { useContext } from "react";
import { SessionContext } from "@/components/auth/SessionProvider";

export function useSession() {
  return useContext(SessionContext);
}
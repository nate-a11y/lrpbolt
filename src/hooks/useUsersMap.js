/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { subscribeUsersMap } from "@/services/usersService.js";

export default function useUsersMap() {
  const [map, setMap] = useState({});

  useEffect(() => subscribeUsersMap(setMap), []);

  return map;
}

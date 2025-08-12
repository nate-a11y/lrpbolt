import { useCallback, useState } from "react";

export default function useMenuAnchor() {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);
  return { anchorEl, open, handleOpen, handleClose, setAnchorEl };
}

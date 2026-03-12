import { forwardRef } from "react";
import { useNavigate } from "react-router";
import { useDetailModal, type DetailTarget } from "../detail-modal/DetailModalProvider";

interface AppLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  detail?: DetailTarget;
  epicKey?: string;
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink({ detail, epicKey, onClick, ...props }, ref) {
    const { open } = useDetailModal();
    const navigate = useNavigate();

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (epicKey) {
        e.preventDefault();
        navigate(`/epic?epic=${encodeURIComponent(epicKey)}`);
        return;
      }
      if (!detail) return;
      e.preventDefault();
      open(detail);
    }

    return (
      <a
        ref={ref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        {...props}
      />
    );
  },
);

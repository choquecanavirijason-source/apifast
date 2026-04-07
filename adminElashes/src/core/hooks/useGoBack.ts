import { useNavigate } from "react-router";

const useGoBack = () => {
  const navigate = useNavigate();

  const goBack = () => {
    const hasHistory = (window.history?.length ?? 0) > 1 ||
      (window.history?.state && (window.history.state as any).idx > 0);

    if (hasHistory) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return goBack;
};

export default useGoBack;

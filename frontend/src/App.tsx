import { Navigate, Route, Routes } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import LoginScreen from "./screens/LoginScreen";
import SetupScreen from "./screens/SetupScreen";
import MainScreen from "./screens/MainScreen";

function RequireLogin({ children }: { children: JSX.Element }) {
  const name = useAppStore((s) => s.agentName);
  if (!name) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/setup"
        element={
          <RequireLogin>
            <SetupScreen />
          </RequireLogin>
        }
      />
      <Route
        path="/"
        element={
          <RequireLogin>
            <MainScreen />
          </RequireLogin>
        }
      />
    </Routes>
  );
}
